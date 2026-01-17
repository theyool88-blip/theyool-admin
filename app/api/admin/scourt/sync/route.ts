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

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScourtApiClient } from '@/lib/scourt/api-client'
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync'
import { syncPartiesFromScourtServer } from '@/lib/scourt/party-sync'
import { getCourtCodeByName, getCourtFullName } from '@/lib/scourt/court-codes'
import { getCaseCategory } from '@/types/case-party'
import { ensureXmlCacheForCase } from '@/lib/scourt/xml-fetcher'
import { SCOURT_RELATION_MAP, determineRelationDirection } from '@/lib/scourt/case-relations'
import { linkRelatedCases } from '@/lib/scourt/related-case-linker'
import { CaseChangeDetector } from '@/lib/scourt/change-detector'
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings'
import { generateGeneralHash, generateProgressHash, toChangeDetectorSnapshot } from '@/lib/scourt/sync-utils'
import {
  detectCaseTypeFromApiResponse,
  detectCaseTypeFromCaseNumber,
  detectCaseTypeFromTemplateId,
  extractTemplateIdFromResponse,
} from '@/lib/scourt/xml-mapping';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';
import { isMaskedPartyName } from '@/types/case-party'

type SyncType = 'progress' | 'general' | 'full'

const VALID_SYNC_TYPES = new Set<SyncType>(['progress', 'general', 'full'])

function normalizeSyncType(value: unknown): SyncType {
  if (typeof value === 'string' && VALID_SYNC_TYPES.has(value as SyncType)) {
    return value as SyncType
  }
  return 'full'
}

function resolveTriggerSource(value: unknown, forceRefresh: boolean): string {
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  return forceRefresh ? 'manual' : 'auto'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      legalCaseId,
      caseNumber,
      courtName,
      partyName,
      forceRefresh = false,
      syncType,
      triggerSource,
    } = body;
    const resolvedSyncType = normalizeSyncType(syncType);
    const resolvedTriggerSource = resolveTriggerSource(triggerSource, forceRefresh);

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
      .select('*, scourt_last_sync, scourt_last_progress_sync_at, scourt_last_general_sync_at, scourt_progress_hash, scourt_general_hash, scourt_sync_enabled, scourt_sync_cooldown_until, scourt_next_progress_sync_at, scourt_next_general_sync_at, enc_cs_no, scourt_wmonid, court_name')
      .eq('id', legalCaseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const normalizePartyName = (name: string) => name.replace(/^\d+\.\s*/, '').trim();
    let resolvedPartyName = normalizePartyName(partyName || '');
    const ensurePartyName = async () => {
      if (resolvedPartyName) return resolvedPartyName;

      const { data: parties } = await supabase
        .from('case_parties')
        .select('party_name, is_primary, manual_override')
        .eq('case_id', legalCaseId)
        .order('is_primary', { ascending: false })
        .order('party_order', { ascending: true });

      const unmaskedParties = (parties || []).filter(party => !isMaskedPartyName(party.party_name));
      const manualUnmaskedParties = unmaskedParties.filter(party => party.manual_override);
      const pickFrom = (list: typeof unmaskedParties) => {
        const clientParty = list.find(party => party.is_primary);
        return clientParty?.party_name || list[0]?.party_name || '';
      };
      const preferredPartyName = pickFrom(manualUnmaskedParties) || pickFrom(unmaskedParties);
      if (preferredPartyName) {
        resolvedPartyName = normalizePartyName(preferredPartyName);
        return resolvedPartyName;
      }

      // primary_client_name 캐시 필드 사용
      if (legalCase.primary_client_name) {
        resolvedPartyName = normalizePartyName(legalCase.primary_client_name);
        return resolvedPartyName;
      }

      // primary_client_id로 clients 테이블 조회
      if (legalCase.primary_client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('name')
          .eq('id', legalCase.primary_client_id)
          .single();
        if (client?.name) {
          resolvedPartyName = normalizePartyName(client.name);
          return resolvedPartyName;
        }
      }

      const fallbackPartyName = pickFrom(parties || []);
      resolvedPartyName = normalizePartyName(fallbackPartyName);
      return resolvedPartyName;
    };

    // 2. 최근 동기화 확인 (5분 이내면 스킵, forceRefresh가 아닌 경우)
    const lastSyncForType =
      resolvedSyncType === 'progress'
        ? legalCase.scourt_last_progress_sync_at
        : resolvedSyncType === 'general'
          ? legalCase.scourt_last_general_sync_at
          : legalCase.scourt_last_sync;

    if (!forceRefresh && lastSyncForType) {
      const lastSync = new Date(lastSyncForType);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

      if (diffMinutes < 5) {
        return NextResponse.json({
          success: true,
          message: '최근 동기화됨',
          lastSync: lastSyncForType,
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
    const normalizedCourtName = getCourtFullName(effectiveCourtName, csDvsNm);
    const cortCdNum = getCourtCodeByName(normalizedCourtName) || normalizedCourtName;

    // 첫 연동 여부 확인 (enc_cs_no 없으면 첫 연동)
    const isFirstLink = !legalCase.enc_cs_no;
    let effectiveSyncType: SyncType = resolvedSyncType;
    if (effectiveSyncType !== 'full' && isFirstLink) {
      effectiveSyncType = 'full';
    }

    interface GeneralDataType {
      raw?: Record<string, unknown>;
      hearings?: ScourtHearing[];
      progress?: ScourtProgressItem[];
      parties?: ScourtParty[];
      representatives?: ScourtRepresentative[];
      relatedCases?: ScourtRelatedCase[];
      lowerCourtCases?: ScourtLowerCourtCase[];
      csNo?: string;
      csNm?: string;
      cortNm?: string;
      aplNm?: string;
      rspNm?: string;
      jdgNm?: string;
      rcptDt?: string;
      endRslt?: string;
      endDt?: string;
      cfrmDt?: string;
      stmpAmnt?: string;
      mrgrDvs?: string;
      aplDt?: string;
      aplDsmsDt?: string;
      jdgArvDt?: string;
      prcdStsNm?: string;
      caseLevelDesc?: string;
      aplSovAmt?: string;
      rspSovAmt?: string;
      rcptDvsNm?: string;
      prsrvYn?: string;
      prsrvCtt?: string;
      jdgTelno?: string;
      siblingCsNo?: string;
      crmcsNo?: string;
      // 당사자 라벨 (SCOURT API 절대값)
      titRprsPtnr?: string;   // 원고측 라벨 (신청인, 원고, 채권자 등)
      titRprsRqstr?: string;  // 피고측 라벨 (피신청인, 피고, 채무자 등)
    }

    interface ScourtHearing {
      trmDt?: string;
      trmHm?: string;
      trmNm?: string;
      trmPntNm?: string;
      rslt?: string;
    }

    interface ScourtProgressItem {
      prcdNm?: string;
      prcdDt?: string;
    }

    interface ScourtParty {
      partyName?: string;
      partyType?: string;
      [key: string]: unknown;
    }

    interface ScourtRepresentative {
      name?: string;
      type?: string;
      [key: string]: unknown;
    }

    interface ScourtRelatedCase {
      userCsNo?: string;
      reltCsCortNm?: string;
      reltCsDvsNm?: string;
      encCsNo?: string;
    }

    interface ScourtLowerCourtCase {
      userCsNo?: string;
      cortNm?: string;
      ultmtDvsNm?: string;
      ultmtYmd?: string;
      encCsNo?: string;
    }

    let generalData: GeneralDataType | null = null;
    let progressData: ScourtProgressItem[] = [];
    let progressFetched = false;
    let newEncCsNo: string | undefined;
    let newWmonid: string | undefined;

    const shouldFetchGeneral = effectiveSyncType !== 'progress';
    const shouldFetchProgress = effectiveSyncType !== 'general';

    if (isFirstLink) {
      // === 첫 연동: 캡챠 인증 필요 ===
      console.log(`🔄 첫 연동 시작: ${caseNumber} (캡챠 인증 필요)`);

      // 첫 연동 시 당사자명 필수
      if (!resolvedPartyName) {
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
        btprNm: resolvedPartyName,
      });

      if (!searchResult.success) {
        return NextResponse.json(
          { error: searchResult.error || '일반내용 조회 실패' },
          { status: 500 }
        );
      }

      generalData = searchResult.generalData as GeneralDataType | null;
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

      if (shouldFetchGeneral) {
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

          generalData = searchResult.generalData as GeneralDataType | null;
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
            generalData = generalResult.data as GeneralDataType | null;
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

            generalData = searchResult.generalData as GeneralDataType | null;
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

      if (shouldFetchProgress && !progressFetched) {
        if (!storedEncCsNo || !storedWmonid) {
          return NextResponse.json(
            { error: '저장된 encCsNo/WMONID가 없습니다. 전체 동기화를 먼저 실행해주세요.' },
            { status: 400 }
          );
        }

        const sessionOk = await apiClient.initSession(storedWmonid);
        if (!sessionOk) {
          return NextResponse.json(
            { error: '세션 초기화 실패' },
            { status: 500 }
          );
        }

        try {
          const progressResult = await apiClient.getCaseProgress({
            cortCd: cortCdNum,
            csYear,
            csDvsCd: csDvsNm,
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
      }
    }

    if (effectiveSyncType === 'progress' && !progressFetched) {
      return NextResponse.json(
        { error: '진행내용 조회 실패' },
        { status: 500 }
      );
    }

    console.log(`✅ 동기화 조회 완료: 일반내용=${generalData ? 'OK' : 'FAIL'}, 진행=${progressData.length}건`);

    const { data: existingSnapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id, raw_data, progress, basic_info, hearings, documents, lower_court, related_cases, case_type, content_hash')
      .eq('legal_case_id', legalCaseId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    const apiResponseForXml: Record<string, unknown> | null = (generalData?.raw as Record<string, unknown> | undefined) || null;
    const templateId = apiResponseForXml ? extractTemplateIdFromResponse(apiResponseForXml) : null;
    const caseTypeFromTemplate = templateId ? detectCaseTypeFromTemplateId(templateId) : null;
    const caseTypeFromApi = apiResponseForXml ? detectCaseTypeFromApiResponse(apiResponseForXml) : null;
    const caseType = caseTypeFromTemplate || caseTypeFromApi || existingSnapshot?.case_type || detectCaseTypeFromCaseNumber(caseNumber);

    if (apiResponseForXml) {
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
    }

    // 제출서류 (원본 응답에서 추출)
    const rawData = (generalData?.raw as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    const rawDocs = (rawData?.dlt_rcntSbmsnDocmtLst as Array<{ ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }>) || [];
    const documentsData = rawDocs.map((d) => ({
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
      const endProgressItem = progressData.find((item) =>
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

    const progressForSnapshot = progressFetched
      ? progressData
      : (
          (Array.isArray(generalData?.progress) && generalData.progress.length > 0)
            ? generalData.progress
            : (existingSnapshot?.progress || [])
        );

    const progressHash = generateProgressHash(progressForSnapshot);
    const progressChanged = progressHash !== legalCase.scourt_progress_hash;

    const shouldUseGeneralData = Boolean(generalData);
    const baseBasicInfo = (existingSnapshot?.basic_info || {}) as Record<string, unknown>;
    const baseParties = (baseBasicInfo as { parties?: ScourtParty[] }).parties || [];
    const baseRepresentatives = (baseBasicInfo as { representatives?: ScourtRepresentative[] }).representatives || [];

    // 사건 카테고리 결정 (당사자 라벨용)
    const caseCategoryForLabel = getCaseCategory(caseNumber);
    const isProtectionCase = ['가정보호', '소년보호'].includes(caseCategoryForLabel);

    let basicInfoForSnapshot: Record<string, unknown> = shouldUseGeneralData ? {} : { ...baseBasicInfo };
    let partiesData: ScourtParty[] = baseParties;
    let representativesData: ScourtRepresentative[] = baseRepresentatives;

    if (shouldUseGeneralData) {
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
      partiesData = generalData?.parties || [];

      // 대리인 정보
      representativesData = generalData?.representatives || [];

      // basic_info에 당사자/대리인 정보 포함 (search API와 동일하게)
      basicInfoForSnapshot = {
        ...basicInfoKorean,
        parties: partiesData,
        representatives: representativesData,
        // 당사자 라벨 (SCOURT API 절대값) - 히어로/일반탭에서 사용
        titRprsPtnr: generalData?.titRprsPtnr,   // 원고측 라벨 (신청인, 원고, 채권자 등)
        titRprsRqstr: generalData?.titRprsRqstr, // 피고측 라벨 (피신청인, 피고, 채무자 등)
      };

      console.log(`📋 당사자 ${partiesData.length}명, 대리인 ${representativesData.length}명 추출`);
      if (generalData?.titRprsPtnr || generalData?.titRprsRqstr) {
        console.log(`📋 당사자 라벨 저장: 원고측="${generalData?.titRprsPtnr}", 피고측="${generalData?.titRprsRqstr}"`);
      }
    } else {
      if (extractedEndDt) basicInfoForSnapshot['종국일'] = extractedEndDt;
      if (extractedEndRslt !== null) {
        basicInfoForSnapshot['종국결과'] = extractedEndRslt || '';
      }
    }

    if (!basicInfoForSnapshot['사건번호']) {
      basicInfoForSnapshot['사건번호'] = caseNumber;
    }
    if (!basicInfoForSnapshot['법원'] && legalCase.court_name) {
      basicInfoForSnapshot['법원'] = legalCase.court_name;
    }

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

    let relatedCasesData = existingSnapshot?.related_cases || [];
    let lowerCourtData = existingSnapshot?.lower_court || [];

    if (shouldUseGeneralData) {

      // 연관사건 정보 가공 (UI 필드명에 맞춤: caseNo, caseName, relation)
      // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
      relatedCasesData = await Promise.all(
        (generalData?.relatedCases || []).map(async (rc) => {
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
      lowerCourtData = await Promise.all(
        (generalData?.lowerCourtCases || []).map(async (lc) => {
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
    }

    const hearingsForSnapshot = shouldUseGeneralData
      ? (generalData?.hearings || [])
      : (existingSnapshot?.hearings || []);
    const documentsForSnapshot = shouldUseGeneralData
      ? documentsData
      : (existingSnapshot?.documents || []);
    const rawDataForSnapshot = shouldUseGeneralData
      ? (generalData?.raw || existingSnapshot?.raw_data || null)
      : (existingSnapshot?.raw_data || null);

    const previousChangeSnapshot = existingSnapshot
      ? toChangeDetectorSnapshot({
          basicInfo: existingSnapshot.basic_info || {},
          hearings: existingSnapshot.hearings || [],
          progress: existingSnapshot.progress || [],
          documents: existingSnapshot.documents || [],
          lowerCourt: existingSnapshot.lower_court || [],
          relatedCases: existingSnapshot.related_cases || [],
        })
      : null;

    const currentChangeSnapshot = toChangeDetectorSnapshot({
      basicInfo: basicInfoForSnapshot,
      hearings: hearingsForSnapshot,
      progress: progressForSnapshot,
      documents: documentsForSnapshot,
      lowerCourt: lowerCourtData,
      relatedCases: relatedCasesData,
    });

    const contentHash = CaseChangeDetector.generateHash(currentChangeSnapshot);
    const generalHash = shouldUseGeneralData
      ? generateGeneralHash({
          basicInfo: basicInfoForSnapshot,
          hearings: hearingsForSnapshot,
          documents: documentsForSnapshot,
          parties: partiesData,
          representatives: representativesData,
        })
      : legalCase.scourt_general_hash;
    const detectedUpdates = CaseChangeDetector.detectChanges(previousChangeSnapshot, currentChangeSnapshot);
    const snapshotData = {
      legal_case_id: legalCaseId,
      case_type: caseType,
      tenant_id: tenantId,
      basic_info: basicInfoForSnapshot,
      hearings: hearingsForSnapshot,
      progress: progressForSnapshot,  // 진행내용 (실패 시 기존/일반내용 fallback)
      documents: documentsForSnapshot,  // 제출서류 원본
      lower_court: lowerCourtData,  // 심급내용 (원심 사건 정보)
      related_cases: relatedCasesData,  // 연관사건 (반소, 항소심, 본안 등)
      raw_data: rawDataForSnapshot,  // XML 렌더링용 원본 API 데이터
      content_hash: contentHash,
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

    if (detectedUpdates.length > 0) {
      const updatesPayload = detectedUpdates.map((update) => ({
        legal_case_id: legalCaseId,
        tenant_id: tenantId,
        snapshot_id: snapshotId,
        update_type: update.updateType,
        update_summary: update.updateSummary,
        details: update.details || {},
        old_value: update.oldValue || null,
        new_value: update.newValue || null,
        importance: update.importance,
        detected_at: new Date().toISOString(),
      }));

      const { error: updatesError } = await supabase
        .from('scourt_case_updates')
        .insert(updatesPayload);

      if (updatesError) {
        console.error('업데이트 저장 실패:', updatesError.message);
      }
    }

    // 7. 기일 동기화 (court_hearings 테이블)
    let hearingSyncResult = null;
    if (shouldUseGeneralData && generalData?.hearings && generalData.hearings.length > 0) {
      const hearingsForSync = generalData.hearings.map((h) => ({
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
    if (shouldUseGeneralData && ((partiesData && partiesData.length > 0) || (representativesData && representativesData.length > 0))) {
      partySyncResult = await syncPartiesFromScourtServer(supabase, {
        legalCaseId,
        tenantId,
        parties: partiesData as Parameters<typeof syncPartiesFromScourtServer>[1]['parties'],
        representatives: representativesData as Parameters<typeof syncPartiesFromScourtServer>[1]['representatives'],
      });
      console.log(`👥 당사자 동기화 결과: ${partySyncResult.partiesUpserted}명, 대리인: ${partySyncResult.representativesUpserted}명`);
    }

    // 8. 심급내용(원심) 및 연관사건 자동 연결 (공통 모듈 사용)
    // shouldUseGeneralData 여부와 관계없이 relatedCasesData/lowerCourtData를 사용
    // (shouldUseGeneralData=false면 기존 스냅샷 데이터가 사용됨)
    let linkResult: { unlinkedRelatedCases: typeof relatedCasesData; unlinkedLowerCourt: typeof lowerCourtData } | null = null;
    if (lowerCourtData.length > 0 || relatedCasesData.length > 0) {
      try {
        // 사건번호에서 caseType 추출
        const parsedCaseNumber = parseCaseNumber(caseNumber);
        const caseType = parsedCaseNumber.caseType || '';

        linkResult = await linkRelatedCases({
          supabase,
          legalCaseId,
          tenantId,
          caseNumber,
          caseType,
          relatedCases: relatedCasesData,
          lowerCourt: lowerCourtData,
        });
      } catch (linkError) {
        console.error('연관사건 연결 실패:', linkError);
        // 연관사건 연결 실패는 동기화 실패로 처리하지 않음
      }
    }

    // 10. legal_cases 업데이트 (종국결과, 심급 포함)
    // 신청/집행/가사신청/보호 사건은 심급 표시 안함
    const shouldSetCaseLevel = !['신청', '집행', '가사신청', '가정보호', '소년보호'].includes(caseCategoryForLabel);
    const nowIso = new Date().toISOString();
    const updateData: Record<string, string | null | undefined> = {
      scourt_sync_status: 'synced',
      scourt_last_snapshot_id: snapshotId,
      scourt_progress_hash: progressHash,
    };

    if (shouldUseGeneralData) {
      updateData.scourt_general_hash = generalHash;
    }

    if (effectiveSyncType === 'progress') {
      updateData.scourt_last_progress_sync_at = nowIso;
    }
    if (effectiveSyncType === 'general') {
      updateData.scourt_last_general_sync_at = nowIso;
      updateData.scourt_last_sync = nowIso;
    }
    if (effectiveSyncType === 'full') {
      updateData.scourt_last_progress_sync_at = nowIso;
      updateData.scourt_last_general_sync_at = nowIso;
      updateData.scourt_last_sync = nowIso;
    }

    if (shouldUseGeneralData) {
      updateData.scourt_case_name = generalData?.csNm;
      updateData.court_name = generalData?.cortNm || null;  // 법원명 (SCOURT에서 가져온 값으로 업데이트)
      updateData.case_level = shouldSetCaseLevel ? (generalData?.caseLevelDesc || null) : null;  // 심급 (1심, 항소심 등) - 신청/집행 사건은 제외
    }
    if (!shouldUseGeneralData && normalizedCourtName && normalizedCourtName !== legalCase.court_name) {
      updateData.court_name = normalizedCourtName;
    }

    if (extractedEndRslt !== null) {
      updateData.case_result = extractedEndRslt;  // 종국결과 (원고일부승, 원고패, 청구인용 등) - API 또는 진행내용에서 추출
    }
    if (extractedEndDt) {
      updateData.case_result_date = extractedEndDt;  // 종국일
    }

    const needsSettings = resolvedTriggerSource === 'manual' || effectiveSyncType === 'progress'
    const syncSettings: Awaited<ReturnType<typeof getScourtSyncSettings>> | null = needsSettings ? await getScourtSyncSettings() : null

    if (resolvedTriggerSource === 'manual' && syncSettings) {
      updateData.scourt_last_manual_sync_at = nowIso;
      updateData.scourt_sync_cooldown_until = new Date(
        Date.now() + syncSettings.manualCooldownMinutes * 60 * 1000
      ).toISOString();

      if (effectiveSyncType !== 'general') {
        updateData.scourt_next_progress_sync_at = new Date(
          Date.now() + syncSettings.progressIntervalHours * 60 * 60 * 1000
        ).toISOString();
      }
    }

    if (resolvedTriggerSource !== 'manual' && effectiveSyncType === 'progress' && syncSettings) {
      updateData.scourt_sync_cooldown_until = new Date(
        Date.now() + syncSettings.autoCooldownMinutes * 60 * 1000
      ).toISOString();
    }

    await supabase
      .from('legal_cases')
      .update(updateData)
      .eq('id', legalCaseId);

    // 9. 응답
    // 미등록 관련사건/심급사건 정보 포함 (사용자 알림용)
    const unlinkedCases = linkResult ? {
      relatedCases: linkResult.unlinkedRelatedCases || [],
      lowerCourt: linkResult.unlinkedLowerCourt || [],
    } : { relatedCases: [], lowerCourt: [] };

    return NextResponse.json({
      success: true,
      caseNumber,
      caseName: generalData?.csNm || basicInfoForSnapshot['사건명'],
      snapshotId,
      hearingsCount: hearingsForSnapshot.length,
      progressCount: progressForSnapshot.length,
      documentsCount: documentsForSnapshot.length,
      partiesCount: partiesData.length,
      representativesCount: representativesData.length,
      basicInfo: snapshotData.basic_info,
      hearingSync: hearingSyncResult,
      partySync: partySyncResult,
      syncType: effectiveSyncType,
      progressChanged,
      unlinkedCases,  // 미등록 관련사건/심급사건 정보
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
