/**
 * 대법원 사건 동기화 API
 *
 * POST /api/admin/scourt/sync
 * - 캡챠 인증 후 상세 조회 + 진행내용 조회 → 스냅샷 저장
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

    // 3. 사건번호 파싱
    const caseNumberPattern = /(\d{4})([가-힣]+)(\d+)/;
    const match = caseNumber.match(caseNumberPattern);
    if (!match) {
      return NextResponse.json(
        { error: '사건번호 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }
    const [, csYear, csDvsNm, csSerial] = match;

    // 5. searchAndRegisterCase로 캡챠 인증 + 상세/진행내용 조회
    // (진행내용 API는 캡챠 인증된 세션 필요)
    const apiClient = getScourtApiClient();

    console.log(`🔄 동기화 시작: ${caseNumber} (캡챠 인증 포함)`);

    // 법원코드 변환 (한글 → 숫자)
    const effectiveCourtName = courtName || legalCase.court_name || '';
    const cortCdNum = getCourtCodeByName(effectiveCourtName) || effectiveCourtName;

    // 첫 연동 여부 확인 (enc_cs_no 없으면 첫 연동)
    const isFirstLink = !legalCase.enc_cs_no;

    // 첫 연동 시 당사자명 필수
    if (isFirstLink && !partyName) {
      return NextResponse.json(
        { error: '첫 연동 시 당사자명이 필요합니다' },
        { status: 400 }
      );
    }

    // searchAndRegisterCase: 캡챠 인증 → 검색 → 상세조회 → 진행내용 조회 (전체 플로우)
    const searchResult = await apiClient.searchAndRegisterCase({
      cortCd: cortCdNum,
      csYr: csYear,
      csDvsCd: csDvsNm,
      csSerial,
      btprNm: partyName || '',  // 첫 연동 시 당사자명 사용
    });

    if (!searchResult.success) {
      return NextResponse.json(
        { error: searchResult.error || '상세 조회 실패' },
        { status: 500 }
      );
    }

    const detailData = searchResult.detailData;
    const progressData = searchResult.progressData || [];

    // encCsNo/WMONID 업데이트 (새로 발급받은 것으로 갱신)
    if (searchResult.encCsNo && searchResult.wmonid) {
      await supabase
        .from('legal_cases')
        .update({
          enc_cs_no: searchResult.encCsNo,
          scourt_wmonid: searchResult.wmonid,
        })
        .eq('id', legalCaseId);
    }

    console.log(`✅ 동기화 조회 완료: 상세=${detailData ? 'OK' : 'FAIL'}, 진행=${progressData.length}건`);

    // 제출서류 (원본 응답에서 추출)
    const rawDocs = detailData?.raw?.data?.dlt_rcntSbmsnDocmtLst || [];
    const documentsData = rawDocs.map((d: { ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }) => ({
      ofdocRcptYmd: d.ofdocRcptYmd || '',
      content: d.content2 || d.content3 || d.content1 || '',
    }));
    console.log(`📄 제출서류 ${documentsData.length}건 추출`)

    // 5-1. 종국결과 추출 (API 응답 또는 진행내용에서)
    let extractedEndRslt = detailData?.endRslt || null;
    let extractedEndDt = detailData?.endDt || null;

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
      .select('id')
      .eq('legal_case_id', legalCaseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    // 스냅샷 데이터 (한글 라벨로 저장)
    const basicInfoKorean: Record<string, string> = {
      '사건번호': detailData?.csNo || caseNumber,
      '사건명': detailData?.csNm || '',
      '법원': detailData?.cortNm || legalCase.court_name,
      '원고': detailData?.aplNm || '',
      '피고': detailData?.rspNm || '',
    };

    // 추가 필드가 있으면 포함 (DB에 저장, UI에서 일부 필터링)
    if (detailData?.jdgNm) basicInfoKorean['재판부'] = detailData.jdgNm;
    if (detailData?.rcptDt) basicInfoKorean['접수일'] = detailData.rcptDt;
    if (extractedEndDt) basicInfoKorean['종국일'] = extractedEndDt;
    if (extractedEndRslt) basicInfoKorean['종국결과'] = extractedEndRslt;
    if (detailData?.cfrmDt) basicInfoKorean['확정일'] = detailData.cfrmDt;
    if (detailData?.stmpAmnt) basicInfoKorean['인지액'] = detailData.stmpAmnt;
    if (detailData?.mrgrDvs) basicInfoKorean['병합구분'] = detailData.mrgrDvs;
    if (detailData?.aplDt) basicInfoKorean['상소일'] = detailData.aplDt;
    if (detailData?.aplDsmsDt) basicInfoKorean['상소각하일'] = detailData.aplDsmsDt;
    if (detailData?.jdgArvDt) basicInfoKorean['판결도달일'] = detailData.jdgArvDt;
    if (detailData?.prcdStsNm) basicInfoKorean['진행상태'] = detailData.prcdStsNm;
    if (detailData?.caseLevelDesc) basicInfoKorean['심급'] = detailData.caseLevelDesc;

    // 추가 필드: 소가, 수리구분, 보존여부
    if (detailData?.aplSovAmt) basicInfoKorean['원고소가'] = detailData.aplSovAmt;
    if (detailData?.rspSovAmt) basicInfoKorean['피고소가'] = detailData.rspSovAmt;
    if (detailData?.rcptDvsNm) basicInfoKorean['수리구분'] = detailData.rcptDvsNm;
    if (detailData?.prsrvYn || detailData?.prsrvCtt) {
      // 보존여부는 Y/N 또는 내용으로 표시
      basicInfoKorean['보존여부'] = detailData.prsrvCtt || (detailData.prsrvYn === 'Y' ? '기록보존됨' : '');
    }
    if (detailData?.jdgTelno) basicInfoKorean['재판부전화'] = detailData.jdgTelno;

    // 당사자 정보 (판결도달일, 확정일 포함)
    const partiesData = detailData?.parties || [];

    // 대리인 정보
    const representativesData = detailData?.representatives || [];

    // basic_info에 당사자/대리인 정보 포함 (search API와 동일하게)
    const basicInfoWithParties = {
      ...basicInfoKorean,
      parties: partiesData,
      representatives: representativesData,
    };

    console.log(`📋 당사자 ${partiesData.length}명, 대리인 ${representativesData.length}명 추출`);

    // 시스템 내 사건 연결을 위해 tenant_id 조회
    const tenantId = legalCase.tenant_id;

    // 연관사건 정보 가공 (UI 필드명에 맞춤: caseNo, caseName, relation)
    // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
    const relatedCasesData = await Promise.all(
      (detailData?.relatedCases || []).map(async rc => {
        let linkedCaseId = null;
        if (rc.userCsNo && tenantId) {
          const { data: linkedCase } = await supabase
            .from('legal_cases')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('court_case_number', `%${rc.userCsNo}%`)
            .single();
          linkedCaseId = linkedCase?.id || null;
        }
        return {
          caseNo: rc.userCsNo,
          caseName: rc.reltCsCortNm,
          relation: rc.reltCsDvsNm,
          encCsNo: rc.encCsNo || null,
          linkedCaseId,
        };
      })
    );

    // 심급내용/원심 사건 정보 가공 (UI 필드명에 맞춤)
    const lowerCourtData = await Promise.all(
      (detailData?.lowerCourtCases || []).map(async lc => {
        let linkedCaseId = null;
        if (lc.userCsNo && tenantId) {
          const { data: linkedCase } = await supabase
            .from('legal_cases')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('court_case_number', `%${lc.userCsNo}%`)
            .single();
          linkedCaseId = linkedCase?.id || null;
        }
        return {
          caseNo: lc.userCsNo,
          courtName: lc.cortNm,
          result: lc.ultmtDvsNm,
          resultDate: lc.ultmtYmd,
          encCsNo: lc.encCsNo || null,
          linkedCaseId,
        };
      })
    );
    console.log(`📋 심급내용 (원심) ${lowerCourtData.length}건, 연관사건 ${relatedCasesData.length}건 추출`);

    const snapshotData = {
      legal_case_id: legalCaseId,
      basic_info: basicInfoWithParties,
      hearings: detailData?.hearings || [],
      progress: progressData,  // 기일 + 제출서류 합성
      documents: documentsData,  // 제출서류 원본
      lower_court: lowerCourtData,  // 심급내용 (원심 사건 정보)
      related_cases: relatedCasesData,  // 연관사건 (반소, 항소심, 본안 등)
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
    if (detailData?.hearings && detailData.hearings.length > 0) {
      const hearingsForSync = detailData.hearings.map((h: {
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
          // 시스템에 이미 존재하는 사건인지 확인 (court_case_number로 매칭)
          const { data: existingLowerCase } = await supabase
            .from('legal_cases')
            .select('id, case_level, court_case_number, main_case_id')
            .eq('tenant_id', currentCase.tenant_id)
            .ilike('court_case_number', `%${lowerCase.caseNo}%`)
            .single();

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
              const { error: relationError } = await supabase
                .from('case_relations')
                .insert({
                  case_id: legalCaseId,
                  related_case_id: existingLowerCase.id,
                  relation_type: '하심사건',
                  relation_type_code: 'appeal',
                  direction: 'child',
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
        // linkedCaseId가 이미 조회된 경우 사용
        if (relatedCase.linkedCaseId) {
          console.log(`  ✅ 관련사건 발견: ${relatedCase.caseNo} → ID: ${relatedCase.linkedCaseId}`);

          // 이미 연결되어 있는지 확인
          const { data: existingRelation } = await supabase
            .from('case_relations')
            .select('id')
            .or(`and(case_id.eq.${legalCaseId},related_case_id.eq.${relatedCase.linkedCaseId}),and(case_id.eq.${relatedCase.linkedCaseId},related_case_id.eq.${legalCaseId})`)
            .single();

          if (!existingRelation) {
            // case_relations에 자동 연결
            const { error: relationError } = await supabase
              .from('case_relations')
              .insert({
                case_id: legalCaseId,
                related_case_id: relatedCase.linkedCaseId,
                relation_type: relatedCase.relation || '관련사건',
                relation_type_code: 'related',
                direction: 'sibling',
                auto_detected: true,
                detected_at: new Date().toISOString(),
                scourt_enc_cs_no: relatedCase.encCsNo,
              });

            if (!relationError) {
              console.log(`  📎 관련사건 case_relations 자동 등록: ${relatedCase.relation || '관련사건'}`);

              // 본소/반소 주사건 결정: 본소가 주사건
              if (relatedCase.relation === '반소') {
                // 현재 사건이 반소 → 관련 사건(본소)이 주사건
                console.log(`  👑 본소가 주사건: ${relatedCase.linkedCaseId}`);
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: relatedCase.linkedCaseId })
                  .eq('id', legalCaseId);
                // 본소도 자기 자신을 주사건으로
                await supabase
                  .from('legal_cases')
                  .update({ main_case_id: relatedCase.linkedCaseId })
                  .eq('id', relatedCase.linkedCaseId);
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
                  .eq('id', relatedCase.linkedCaseId);
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
    // 신청/집행/가사신청 사건은 심급 표시 안함
    const caseCategory = getCaseCategory(caseNumber);
    const shouldSetCaseLevel = !['신청', '집행', '가사신청'].includes(caseCategory);

    // extractedEndRslt, extractedEndDt는 위에서 이미 추출됨 (API 또는 진행내용에서)

    await supabase
      .from('legal_cases')
      .update({
        scourt_last_sync: new Date().toISOString(),
        scourt_sync_status: 'synced',
        scourt_case_name: detailData?.csNm,
        court_name: detailData?.cortNm || null,  // 법원명 (SCOURT에서 가져온 값으로 업데이트)
        case_result: extractedEndRslt,  // 종국결과 (원고일부승, 원고패, 청구인용 등) - API 또는 진행내용에서 추출
        case_result_date: extractedEndDt,  // 종국일
        case_level: shouldSetCaseLevel ? (detailData?.caseLevelDesc || null) : null,  // 심급 (1심, 항소심 등) - 신청/집행 사건은 제외
      })
      .eq('id', legalCaseId);

    // 9. 응답
    return NextResponse.json({
      success: true,
      caseNumber,
      caseName: detailData?.csNm,
      snapshotId,
      hearingsCount: detailData?.hearings?.length || 0,
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
