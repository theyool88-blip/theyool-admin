/**
 * 대법원 사건 동기화 API
 *
 * POST /api/admin/scourt/sync
 * - 캡챠 인증 후 일반내용 조회 + 진행내용 조회 → 스냅샷 저장
 * - REST API 기반 (Puppeteer 불필요)
 *
 * 진행내용(getCaseProgress)은 캡챠 인증된 세션이 필요하므로
 * searchAndRegisterCase를 사용하여 전체 플로우를 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync';
import { syncPartiesFromScourtServer } from '@/lib/scourt/party-sync';
import { getCourtCodeByName } from '@/lib/scourt/court-codes';
import { getCaseCategory } from '@/lib/scourt/party-labels';
import { ensureXmlCacheForCase } from '@/lib/scourt/xml-fetcher';
import { SCOURT_RELATION_MAP, determineRelationDirection } from '@/lib/scourt/case-relations';
import {
  detectCaseTypeFromApiResponse,
  detectCaseTypeFromCaseNumber,
  detectCaseTypeFromTemplateId,
  extractTemplateIdFromResponse,
} from '@/lib/scourt/xml-mapping';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { legalCaseId, caseNumber, courtName, partyName, forceRefresh = false } = body;

    if (!legalCaseId || !caseNumber) {
      return NextResponse.json(
        { error: '필수 파라미터 누락: legalCaseId, caseNumber' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. 사건 정보 조회 (enc_cs_no, scourt_wmonid 확인)
    const { data: legalCase, error: caseError } = await supabase
      .from('legal_cases')
      .select('*, scourt_last_sync, enc_cs_no, scourt_wmonid, court_name')
      .eq('id', legalCaseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    let resolvedPartyName = (partyName || '').trim();
    const ensurePartyName = async () => {
      if (resolvedPartyName) return resolvedPartyName;

      if (legalCase.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('name')
          .eq('id', legalCase.client_id)
          .single();
        if (client?.name) {
          resolvedPartyName = client.name;
          return resolvedPartyName;
        }
      }

      const { data: party } = await supabase
        .from('case_parties')
        .select('party_name, is_our_client')
        .eq('case_id', legalCaseId)
        .order('is_our_client', { ascending: false })
        .limit(1)
        .single();
      resolvedPartyName = party?.party_name || '';
      return resolvedPartyName;
    };

    // 2. 최근 동기화 확인 (5분 이내면 스킵, forceRefresh가 아닌 경우)
    if (!forceRefresh && legalCase.scourt_last_sync) {
      const lastSync = new Date(legalCase.scourt_last_sync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

      if (diffMinutes < 5) {
        return NextResponse.json({
          success: true,
          message: '최근 동기화됨',
          lastSync: legalCase.scourt_last_sync,
          skipped: true,
        });
      }
    }

    // 3. 사건번호 정규화 및 파싱 (공통 유틸리티 사용)
    const parsed = parseCaseNumber(caseNumber);
    if (!parsed.valid) {
      return NextResponse.json(
        { error: `사건번호 형식이 올바르지 않습니다: ${caseNumber}` },
        { status: 400 }
      );
    }
    const { year: csYear, caseType: csDvsNm, serial: csSerial } = parsed;

    // 5. SCOURT API 조회
    const apiClient = getScourtApiClient();

    // 법원코드 변환 (한글 → 숫자)
    const effectiveCourtName = courtName || legalCase.court_name || '';
    const cortCdNum = getCourtCodeByName(effectiveCourtName) || effectiveCourtName;

    // 첫 연동 여부 확인 (enc_cs_no 없으면 첫 연동)
    const isFirstLink = !legalCase.enc_cs_no;

    let generalData: any = null;
    let progressData: any[] = [];
    let progressFetched = false;
    let newEncCsNo: string | undefined;
    let newWmonid: string | undefined;

    if (isFirstLink) {
      // === 첫 연동: 캡챠 인증 필요 ===
      console.log(`🔄 첫 연동 시작: ${caseNumber} (캡챠 인증 필요)`);

      // 첫 연동 시 당사자명 필수
      if (!partyName) {
        return NextResponse.json(
          { error: '첫 연동 시 당사자명이 필요합니다' },
          { status: 400 }
        );
      }

      // searchAndRegisterCase: 캡챠 인증 → 검색 → 일반내용 조회 → 진행내용 조회
      const searchResult = await apiClient.searchAndRegisterCase({
        cortCd: cortCdNum,
        csYr: csYear,
        csDvsCd: csDvsNm,
        csSerial,
        btprNm: partyName,
      });

      if (!searchResult.success) {
        return NextResponse.json(
          { error: searchResult.error || '일반내용 조회 실패' },
          { status: 500 }
        );
      }

      generalData = searchResult.generalData;
      progressData = searchResult.progressData || [];
      progressFetched = Array.isArray(searchResult.progressData);
      newEncCsNo = searchResult.encCsNo;
      newWmonid = searchResult.wmonid;

      // encCsNo/WMONID 저장 (이후 갱신에서 재사용)
      if (newEncCsNo && newWmonid) {
        await supabase
          .from('legal_cases')
          .update({
            enc_cs_no: newEncCsNo,
            scourt_wmonid: newWmonid,
          })
          .eq('id', legalCaseId);
      }
    } else {
      // === 갱신: 저장된 encCsNo로 직접 조회 (캡챠 불필요) ===
      console.log(`🔄 갱신 시작: ${caseNumber} (저장된 encCsNo 사용)`);

      const storedEncCsNo = legalCase.enc_cs_no;
      const storedWmonid = legalCase.scourt_wmonid;

      if (!storedWmonid) {
        // WMONID 없으면 새로 검색 (이전 버전 데이터 호환)
        console.log(`⚠️ WMONID 없음, 새로 검색합니다`);
        const fallbackPartyName = await ensurePartyName();
        if (!fallbackPartyName) {
          return NextResponse.json(
            { error: '당사자명을 찾을 수 없습니다. 사건 상세에서 당사자명을 입력해주세요.' },
            { status: 400 }
          );
        }
        const searchResult = await apiClient.searchAndRegisterCase({
          cortCd: cortCdNum,
          csYr: csYear,
          csDvsCd: csDvsNm,
          csSerial,
          btprNm: fallbackPartyName,
        });

        if (!searchResult.success) {
          return NextResponse.json(
            { error: searchResult.error || '일반내용 조회 실패' },
            { status: 500 }
          );
        }

        generalData = searchResult.generalData;
        progressData = searchResult.progressData || [];

        // 새 encCsNo/WMONID 저장
        if (searchResult.encCsNo && searchResult.wmonid) {
          await supabase
            .from('legal_cases')
            .update({
              enc_cs_no: searchResult.encCsNo,
              scourt_wmonid: searchResult.wmonid,
            })
            .eq('id', legalCaseId);
        }
      } else {
        // 저장된 encCsNo+WMONID로 직접 일반내용 조회 (캡챠 불필요!)
        const generalResult = await apiClient.getCaseGeneralWithStoredEncCsNo(
          storedWmonid,
          storedEncCsNo,
          {
            cortCd: cortCdNum,
            csYear: csYear,
            csDvsCd: csDvsNm,
            csSerial: csSerial,
          }
        );

        if (generalResult.success && generalResult.data) {
          // CaseGeneralResult.data를 generalData로 사용
          generalData = generalResult.data;
          // 진행내용은 별도 조회 필요 - getCaseProgress 호출
          try {
            const progressResult = await apiClient.getCaseProgress({
              cortCd: cortCdNum,
              csYear,
              csDvsCd: csDvsNm,  // 한글 사건유형 전달 (내부에서 코드로 변환)
              csSerial,
              encCsNo: storedEncCsNo,
            });
            if (progressResult.success) {
              progressData = progressResult.progress || [];
              progressFetched = true;
            }
          } catch (progressError) {
            console.warn('⚠️ 진행내용 조회 실패:', progressError);
            progressData = [];
            progressFetched = false;
          }
        } else {
          // 실패 시 새로 검색
          console.log(`⚠️ 저장된 encCsNo 만료, 새로 검색합니다`);
          const fallbackPartyName = await ensurePartyName();
          if (!fallbackPartyName) {
            return NextResponse.json(
              { error: '당사자명을 찾을 수 없습니다. 사건 상세에서 당사자명을 입력해주세요.' },
              { status: 400 }
            );
          }
          const searchResult = await apiClient.searchAndRegisterCase({
            cortCd: cortCdNum,
            csYr: csYear,
            csDvsCd: csDvsNm,
            csSerial,
            btprNm: fallbackPartyName,
          });

          if (!searchResult.success) {
            return NextResponse.json(
              { error: searchResult.error || '일반내용 조회 실패' },
              { status: 500 }
            );
          }

          generalData = searchResult.generalData;
          progressData = searchResult.progressData || [];
          progressFetched = Array.isArray(searchResult.progressData);

          // 새 encCsNo/WMONID 저장
          if (searchResult.encCsNo && searchResult.wmonid) {
            await supabase
              .from('legal_cases')
              .update({
                enc_cs_no: searchResult.encCsNo,
                scourt_wmonid: searchResult.wmonid,
              })
              .eq('id', legalCaseId);
          }
        }
      }
    }

    console.log(`✅ 동기화 조회 완료: 일반내용=${generalData ? 'OK' : 'FAIL'}, 진행=${progressData.length}건`);

    const apiResponseForXml = generalData?.raw || generalData?.raw?.data || {};
    const templateId = extractTemplateIdFromResponse(apiResponseForXml);
    const caseTypeFromTemplate = templateId ? detectCaseTypeFromTemplateId(templateId) : null;
    const caseTypeFromApi = detectCaseTypeFromApiResponse(apiResponseForXml);
    const caseType = caseTypeFromTemplate || caseTypeFromApi || detectCaseTypeFromCaseNumber(caseNumber);

    // XML 캐시 확보
    // - 첫 연동: 모든 동적 추출 경로 캐시 (데이터 유무 무관)
    // - 갱신: 데이터가 있는 항목 중 미캐시된 것만 다운로드 (이전 버전 호환)
    try {
      console.log(`📄 XML 캐시 확인 중 (사건유형: ${caseType}, 첫연동: ${isFirstLink})...`);
      // 첫 연동: cacheAllOnFirstLink=true (모든 경로 캐시)
      // 갱신: cacheAllOnFirstLink=false (데이터 있는 것만 캐시)
      await ensureXmlCacheForCase(caseType, apiResponseForXml, isFirstLink);
      console.log(`✅ XML 캐시 확보 완료`);
    } catch (xmlError) {
      // XML 캐시 실패해도 동기화는 계속 진행
      console.warn(`⚠️ XML 캐시 실패 (동기화는 계속):`, xmlError);
    }

    // 제출서류 (원본 응답에서 추출)
    const rawDocs = generalData?.raw?.data?.dlt_rcntSbmsnDocmtLst || [];
    const documentsData = rawDocs.map((d: { ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }) => ({
      ofdocRcptYmd: d.ofdocRcptYmd || '',
      content: d.content2 || d.content3 || d.content1 || '',
      submitter: d.content1 || '',  // 제출자 (원고/피고/신청인 등) - 알림 기능용
    }));
    console.log(`📄 제출서류 ${documentsData.length}건 추출`)

    // 5-1. 종국결과 추출 (API 응답 또는 진행내용에서)
    let extractedEndRslt = generalData?.endRslt || null;
    let extractedEndDt = generalData?.endDt || null;

    // API 응답에 종국결과가 없으면 진행내용에서 "종국 : " 항목 찾기
    if (!extractedEndRslt && progressData.length > 0) {
      const endProgressItem = progressData.find((item: { prcdNm?: string; prcdDt?: string }) =>
        item.prcdNm?.startsWith('종국 : ')
      );
      if (endProgressItem && endProgressItem.prcdNm) {
        // "종국 : 원고일부승" → "원고일부승"
        extractedEndRslt = endProgressItem.prcdNm.replace('종국 : ', '').trim();
        extractedEndDt = extractedEndDt || endProgressItem.prcdDt || null;
        console.log(`📋 진행내용에서 종국결과 추출: ${extractedEndRslt}`);
      }
    }

    // 6. 스냅샷 저장 (upsert)
    const { data: existingSnapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id, raw_data, progress')
      .eq('legal_case_id', legalCaseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    const progressForSnapshot = progressFetched
      ? progressData
      : (
          (Array.isArray(generalData?.progress) && generalData.progress.length > 0)
            ? generalData.progress
            : (existingSnapshot?.progress || [])
        );

    // 사건 카테고리 결정 (당사자 라벨용)
    const caseCategoryForLabel = getCaseCategory(caseNumber);
    const isProtectionCase = ['가정보호', '소년보호'].includes(caseCategoryForLabel);

    // 스냅샷 데이터 (한글 라벨로 저장)
    // 보호사건은 "행위자" 라벨 사용, 일반사건은 "원고/피고"
    const basicInfoKorean: Record<string, string> = {
      '사건번호': generalData?.csNo || caseNumber,
      '사건명': generalData?.csNm || '',
      '법원': generalData?.cortNm || legalCase.court_name,
      [isProtectionCase ? '행위자' : '원고']: generalData?.aplNm || '',
      [isProtectionCase ? '' : '피고']: generalData?.rspNm || '',
    };
    // 빈 키 제거 (보호사건의 피고 라벨)
    if (basicInfoKorean[''] !== undefined) delete basicInfoKorean[''];

    // 추가 필드가 있으면 포함 (DB에 저장, UI에서 일부 필터링)
    if (generalData?.jdgNm) basicInfoKorean['재판부'] = generalData.jdgNm;
    if (generalData?.rcptDt) basicInfoKorean['접수일'] = generalData.rcptDt;
    if (extractedEndDt) basicInfoKorean['종국일'] = extractedEndDt;
    // 종국결과: 항상 표시 (값이 없어도 빈 문자열로)
    basicInfoKorean['종국결과'] = extractedEndRslt || '';
    if (generalData?.cfrmDt) basicInfoKorean['확정일'] = generalData.cfrmDt;
    if (generalData?.stmpAmnt) basicInfoKorean['인지액'] = generalData.stmpAmnt;
    if (generalData?.mrgrDvs) basicInfoKorean['병합구분'] = generalData.mrgrDvs;
    if (generalData?.aplDt) basicInfoKorean['상소일'] = generalData.aplDt;
    if (generalData?.aplDsmsDt) basicInfoKorean['상소각하일'] = generalData.aplDsmsDt;
    if (generalData?.jdgArvDt) basicInfoKorean['판결도달일'] = generalData.jdgArvDt;
    if (generalData?.prcdStsNm) basicInfoKorean['진행상태'] = generalData.prcdStsNm;
    // 심급: 보호사건은 심급 표시 안함
    if (!isProtectionCase && generalData?.caseLevelDesc) basicInfoKorean['심급'] = generalData.caseLevelDesc;

    // 추가 필드: 소가, 수리구분, 보존여부
    if (generalData?.aplSovAmt) basicInfoKorean['원고소가'] = generalData.aplSovAmt;
    if (generalData?.rspSovAmt) basicInfoKorean['피고소가'] = generalData.rspSovAmt;
    if (generalData?.rcptDvsNm) basicInfoKorean['수리구분'] = generalData.rcptDvsNm;
    if (generalData?.prsrvYn || generalData?.prsrvCtt) {
      // 보존여부는 Y/N 또는 내용으로 표시
      basicInfoKorean['보존여부'] = generalData.prsrvCtt || (generalData.prsrvYn === 'Y' ? '기록보존됨' : '');
    }
    if (generalData?.jdgTelno) basicInfoKorean['재판부전화'] = generalData.jdgTelno;

    // 형사/보호 사건 전용: 형제번호 (검찰사건번호)
    if (generalData?.siblingCsNo || generalData?.crmcsNo) {
      basicInfoKorean['형제사건번호'] = generalData.siblingCsNo || generalData.crmcsNo || '';
    }

    // 당사자 정보 (판결도달일, 확정일 포함)
    const partiesData = generalData?.parties || [];

    // 대리인 정보
    const representativesData = generalData?.representatives || [];

    // basic_info에 당사자/대리인 정보 포함 (search API와 동일하게)
    const basicInfoWithParties = {
      ...basicInfoKorean,
      parties: partiesData,
      representatives: representativesData,
    };

    console.log(`📋 당사자 ${partiesData.length}명, 대리인 ${representativesData.length}명 추출`);

    // 시스템 내 사건 연결을 위해 tenant_id 조회
    const tenantId = legalCase.tenant_id;
    const buildCaseNumberPattern = (caseNo: string) => {
      const parsed = parseCaseNumber(caseNo);
      if (parsed.valid) {
        return `%${parsed.year}%${parsed.caseType}%${parsed.serial}%`;
      }
      if (parsed.normalized) {
        return `%${parsed.normalized}%`;
      }
      return null;
    };

    const findCaseByNumber = async (caseNo?: string) => {
      if (!caseNo || !tenantId) return null;
      const pattern = buildCaseNumberPattern(caseNo);
      if (!pattern) return null;

      const { data, error } = await supabase
        .from('legal_cases')
        .select('id, case_level, court_case_number, main_case_id')
        .eq('tenant_id', tenantId)
        .ilike('court_case_number', pattern)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('관련 사건 매칭 실패:', error);
        return null;
      }

      return data || null;
    };

    // 연관사건 정보 가공 (UI 필드명에 맞춤: caseNo, caseName, relation)
    // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
    const relatedCasesData = await Promise.all(
      (generalData?.relatedCases || []).map(async (rc: { userCsNo?: string; reltCsCortNm?: string; reltCsDvsNm?: string; encCsNo?: string }) => {
        const linkedCase = await findCaseByNumber(rc.userCsNo);
        return {
          caseNo: rc.userCsNo,
          caseName: rc.reltCsCortNm,
          relation: rc.reltCsDvsNm,
          encCsNo: rc.encCsNo || null,
          linkedCaseId: linkedCase?.id || null,
        };
      })
    );

    // 심급내용/원심 사건 정보 가공 (UI 필드명에 맞춤)
    const lowerCourtData = await Promise.all(
      (generalData?.lowerCourtCases || []).map(async (lc: { userCsNo?: string; cortNm?: string; ultmtDvsNm?: string; ultmtYmd?: string; encCsNo?: string }) => {
        const linkedCase = await findCaseByNumber(lc.userCsNo);
        return {
          caseNo: lc.userCsNo,
          courtName: lc.cortNm,
          result: lc.ultmtDvsNm,
          resultDate: lc.ultmtYmd,
          encCsNo: lc.encCsNo || null,
          linkedCaseId: linkedCase?.id || null,
        };
      })
    );
    console.log(`📋 심급내용 (원심) ${lowerCourtData.length}건, 연관사건 ${relatedCasesData.length}건 추출`);

    const rawDataForSnapshot = generalData?.raw || existingSnapshot?.raw_data || null;
    const snapshotData = {
      legal_case_id: legalCaseId,
      case_type: caseType,
      basic_info: basicInfoWithParties,
      hearings: generalData?.hearings || [],
      progress: progressForSnapshot,  // 진행내용 (실패 시 기존/일반내용 fallback)
      documents: documentsData,  // 제출서류 원본
      lower_court: lowerCourtData,  // 심급내용 (원심 사건 정보)
      related_cases: relatedCasesData,  // 연관사건 (반소, 항소심, 본안 등)
      raw_data: rawDataForSnapshot,  // XML 렌더링용 원본 API 데이터
      case_number: caseNumber,
      court_code: legalCase.court_name,
      scraped_at: new Date().toISOString(),
    };

    let snapshotId: string;
    if (existingSnapshot) {
      // 기존 스냅샷 업데이트
      const { error: updateError } = await supabase
        .from('scourt_case_snapshots')
        .update(snapshotData)
        .eq('id', existingSnapshot.id);

      if (updateError) {
        console.error('스냅샷 업데이트 에러:', updateError);
      }
      snapshotId = existingSnapshot.id;
    } else {
      // 새 스냅샷 생성
      const { data: newSnapshot, error: insertError } = await supabase
        .from('scourt_case_snapshots')
        .insert(snapshotData)
        .select('id')
        .single();

      if (insertError) {
        console.error('스냅샷 생성 에러:', insertError);
        return NextResponse.json(
          { error: '스냅샷 저장 실패' },
          { status: 500 }
        );
      }
      snapshotId = newSnapshot.id;
    }

    // 7. 기일 동기화 (court_hearings 테이블)
    let hearingSyncResult = null;
    if (generalData?.hearings && generalData.hearings.length > 0) {
      const hearingsForSync = generalData.hearings.map((h: {
        trmDt?: string;
        trmHm?: string;
        trmNm?: string;
        trmPntNm?: string;
        rslt?: string;
      }) => ({
        date: h.trmDt || '',
        time: h.trmHm || '',
        type: h.trmNm || '',
        location: h.trmPntNm || '',
        result: h.rslt || '',
      }));

      hearingSyncResult = await syncHearingsToCourtHearings(
        legalCaseId,
        caseNumber,
        hearingsForSync
      );
      console.log('📅 기일 동기화 결과:', hearingSyncResult);
    }

    // 7-1. 당사자/대리인 동기화 (case_parties, case_representatives 테이블)
    let partySyncResult = null;
    if ((partiesData && partiesData.length > 0) || (representativesData && representativesData.length > 0)) {
      partySyncResult = await syncPartiesFromScourtServer(supabase, {
        legalCaseId,
        tenantId,
        parties: partiesData,
        representatives: representativesData,
      });
      console.log(`👥 당사자 동기화 결과: ${partySyncResult.partiesUpserted}명, 대리인: ${partySyncResult.representativesUpserted}명`);
    }

    // 8. 심급내용(원심) 자동 연결 로직
    if (lowerCourtData.length > 0) {
      console.log(`🔗 심급내용(원심) ${lowerCourtData.length}건 발견, 자동 연결 시도...`);

      // 현재 사건의 tenant_id 조회
      const { data: currentCase } = await supabase
        .from('legal_cases')
        .select('tenant_id')
        .eq('id', legalCaseId)
        .single();

      if (currentCase?.tenant_id) {
        for (const lowerCase of lowerCourtData) {
          const existingLowerCase = await findCaseByNumber(lowerCase.caseNo);

          if (existingLowerCase) {
            console.log(`  ✅ 원심사건 발견: ${lowerCase.caseNo} → ID: ${existingLowerCase.id}`);

            // 이미 연결되어 있는지 확인
            const { data: existingRelation } = await supabase
              .from('case_relations')
              .select('id')
              .or(`and(case_id.eq.${legalCaseId},related_case_id.eq.${existingLowerCase.id}),and(case_id.eq.${existingLowerCase.id},related_case_id.eq.${legalCaseId})`)
              .single();

            if (!existingRelation) {
              // case_relations에 자동 연결 (현재 사건 → 원심: 하심사건 관계)
              const relationType = '하심사건';
              const relationTypeCode = SCOURT_RELATION_MAP[relationType] || 'appeal';
              const direction = determineRelationDirection(relationType);
              const { error: relationError } = await supabase
                .from('case_relations')
                .insert({
                  case_id: legalCaseId,
                  related_case_id: existingLowerCase.id,
                  relation_type: relationType,
                  relation_type_code: relationTypeCode,
                  direction,
                  auto_detected: true,
                  detected_at: new Date().toISOString(),
                  scourt_enc_cs_no: lowerCase.encCsNo,
                });

              if (!relationError) {
                console.log(`  📎 심급내용 case_relations 자동 등록: 하심사건`);

                // 주사건 업데이트: 현재 사건(상위심급)이 주사건
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: legalCaseId })
                  .eq('id', existingLowerCase.id);

                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: legalCaseId })
                  .eq('id', legalCaseId);
              }
            } else {
              console.log(`  ⏭️ 이미 연결됨: ${lowerCase.caseNo}`);
            }
          } else {
            console.log(`  ⚠️ 미등록 원심사건: ${lowerCase.caseNo}`);
          }
        }
      }
    }

    // 9. 관련사건(반소 등) 자동 연결 로직
    if (relatedCasesData.length > 0) {
      console.log(`🔗 관련사건 ${relatedCasesData.length}건 발견, 자동 연결 시도...`);

      for (const relatedCase of relatedCasesData) {
        const linkedCaseId = relatedCase.linkedCaseId || (await findCaseByNumber(relatedCase.caseNo))?.id;
        if (linkedCaseId) {
          console.log(`  ✅ 관련사건 발견: ${relatedCase.caseNo} → ID: ${linkedCaseId}`);

          // 이미 연결되어 있는지 확인
          const { data: existingRelation } = await supabase
            .from('case_relations')
            .select('id')
            .or(`and(case_id.eq.${legalCaseId},related_case_id.eq.${linkedCaseId}),and(case_id.eq.${linkedCaseId},related_case_id.eq.${legalCaseId})`)
            .single();

          if (!existingRelation) {
            // case_relations에 자동 연결
            const relationType = relatedCase.relation || '관련사건';
            const relationTypeCode = SCOURT_RELATION_MAP[relationType] || 'related';
            const direction = determineRelationDirection(relationType);
            const { error: relationError } = await supabase
              .from('case_relations')
              .insert({
                case_id: legalCaseId,
                related_case_id: linkedCaseId,
                relation_type: relationType,
                relation_type_code: relationTypeCode,
                direction,
                auto_detected: true,
                detected_at: new Date().toISOString(),
                scourt_enc_cs_no: relatedCase.encCsNo,
              });

            if (!relationError) {
              console.log(`  📎 관련사건 case_relations 자동 등록: ${relationType}`);

              // 본소/반소 주사건 결정: 본소가 주사건
              if (relatedCase.relation === '반소') {
                // 현재 사건이 반소 → 관련 사건(본소)이 주사건
                console.log(`  👑 본소가 주사건: ${linkedCaseId}`);
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: linkedCaseId })
                  .eq('id', legalCaseId);
                // 본소도 자기 자신을 주사건으로
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: linkedCaseId })
                  .eq('id', linkedCaseId);
              } else if (relatedCase.relation === '본소') {
                // 현재 사건이 본소 → 현재 사건이 주사건
                console.log(`  👑 현재 사건(본소)이 주사건: ${legalCaseId}`);
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: legalCaseId })
                  .eq('id', legalCaseId);
                // 반소도 본소를 주사건으로
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: legalCaseId })
                  .eq('id', linkedCaseId);
              }
            }
          } else {
            console.log(`  ⏭️ 이미 연결됨: ${relatedCase.caseNo}`);
          }
        } else {
          console.log(`  ⚠️ 미등록 관련사건: ${relatedCase.caseNo}`);
        }
      }
    }

    // 10. legal_cases 업데이트 (종국결과, 심급 포함)
    // 신청/집행/가사신청/보호 사건은 심급 표시 안함
    const shouldSetCaseLevel = !['신청', '집행', '가사신청', '가정보호', '소년보호'].includes(caseCategoryForLabel);

    // extractedEndRslt, extractedEndDt는 위에서 이미 추출됨 (API 또는 진행내용에서)

    await supabase
      .from('legal_cases')
      .update({
        scourt_last_sync: new Date().toISOString(),
        scourt_sync_status: 'synced',
        scourt_case_name: generalData?.csNm,
        court_name: generalData?.cortNm || null,  // 법원명 (SCOURT에서 가져온 값으로 업데이트)
        case_result: extractedEndRslt,  // 종국결과 (원고일부승, 원고패, 청구인용 등) - API 또는 진행내용에서 추출
        case_result_date: extractedEndDt,  // 종국일
        case_level: shouldSetCaseLevel ? (generalData?.caseLevelDesc || null) : null,  // 심급 (1심, 항소심 등) - 신청/집행 사건은 제외
      })
      .eq('id', legalCaseId);

    // 9. 응답
    return NextResponse.json({
      success: true,
      caseNumber,
      caseName: generalData?.csNm,
      snapshotId,
      hearingsCount: generalData?.hearings?.length || 0,
      progressCount: progressData.length,
      documentsCount: documentsData.length,
      partiesCount: partiesData.length,
      representativesCount: representativesData.length,
      basicInfo: snapshotData.basic_info,
      hearingSync: hearingSyncResult,
      partySync: partySyncResult,
    });

  } catch (error) {
    console.error('동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '동기화 실패' },
      { status: 500 }
    );
  }
}

/**
 * 배치 동기화 (여러 사건)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseIds } = body;

    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: 'caseIds 배열이 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 사건 목록 조회
    const { data: cases, error } = await supabase
      .from('legal_cases')
      .select('id, court_case_number')
      .in('id', caseIds);

    if (error || !cases) {
      return NextResponse.json(
        { error: '사건 조회 실패' },
        { status: 500 }
      );
    }

    // 순차 동기화 (너무 빠르면 차단될 수 있음)
    const results = [];
    for (const c of cases) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/scourt/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              legalCaseId: c.id,
              caseNumber: c.court_case_number,
            }),
          }
        );
        const result = await response.json();
        results.push({ caseId: c.id, ...result });

        // 요청 간격 (2초)
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        results.push({
          caseId: c.id,
          success: false,
          error: err instanceof Error ? err.message : '동기화 실패',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalCount: cases.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('배치 동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '배치 동기화 실패' },
      { status: 500 }
    );
  }
}
