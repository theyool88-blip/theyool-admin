/**
 * 대법원 사건 검색 API (API 클라이언트 방식)
 *
 * POST /api/admin/scourt/search
 *
 * 요청:
 * - caseYear: 사건 연도 (필수)
 * - caseType: 사건 구분 코드 (필수, 예: 드단, 드합, 르)
 * - caseSerial: 사건 일련번호 (필수)
 * - courtName: 법원명 (필수)
 * - partyName: 당사자명 (필수)
 * - legalCaseId: 사건 ID (선택, 스냅샷 저장용)
 *
 * 응답:
 * - success: 성공 여부
 * - caseInfo: 사건 정보 (encCsNo, caseNumber 등)
 * - captchaAttempts: 캡챠 시도 횟수
 * - hasSnapshot: 스냅샷 저장 여부
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { saveEncCsNoToCase } from '@/lib/scourt/case-storage';
import { getCourtFullName } from '@/lib/scourt/court-codes';
import { inferCaseLevelFromType } from '@/lib/scourt/case-relations';
import { parseCaseNumber } from '@/lib/scourt/case-number-utils';
import { linkRelatedCases } from '@/lib/scourt/related-case-linker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseYear, caseType, caseSerial, courtName, partyName, legalCaseId } = body;

    // 필수 파라미터 검증
    if (!caseYear || !caseType || !caseSerial || !courtName || !partyName) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다 (caseYear, caseType, caseSerial, courtName, partyName)' },
        { status: 400 }
      );
    }

    console.log(`📍 사건 검색 시작 (API): ${caseYear}${caseType}${caseSerial}`);

    const apiClient = getScourtApiClient();
    const normalizedCourtName = getCourtFullName(courtName, caseType);

    // API로 사건 검색 및 encCsNo 획득 (일반내용 조회 포함)
    const result = await apiClient.searchAndRegisterCase({
      cortCd: normalizedCourtName || courtName,
      csYr: caseYear,
      csDvsCd: caseType,
      csSerial: caseSerial,
      btprNm: partyName,
    });

    if (result.success && result.encCsNo) {
      // 검색 결과에서 원고/피고 역할 판별
      // 마스킹 형식: 가운데 글자만 마스킹 (김태일 → 김O일, 김철 → 김O)
      // 3글자: 성 + 끝글자 비교, 2글자(외자): 성만 비교
      let clientRole: 'plaintiff' | 'defendant' | null = null;

      // 마스킹된 이름과 의뢰인 이름 매칭 함수
      const matchesName = (maskedName: string, fullName: string): boolean => {
        if (!maskedName || !fullName) return false;
        const masked = maskedName.replace(/O/g, ''); // "김O일" → "김일", "김O" → "김"
        const first = fullName.charAt(0); // 성
        const last = fullName.charAt(fullName.length - 1); // 끝글자

        if (masked.length >= 2) {
          // 3글자 이름: 성 + 끝글자 비교
          return masked.charAt(0) === first && masked.charAt(masked.length - 1) === last;
        } else {
          // 2글자(외자) 이름: 성만 비교
          return masked.charAt(0) === first;
        }
      };

      // 일반내용에서 원고/피고 마스킹 이름 추출
      if (result.generalData) {
        const plaintiffName = result.generalData.aplNm || ''; // 예: "권O철"
        const defendantName = result.generalData.rspNm || ''; // 예: "김O일"

        if (matchesName(plaintiffName, partyName)) {
          clientRole = 'plaintiff';
          console.log(`✅ 의뢰인 역할 자동 감지: 원고 (${plaintiffName} ← ${partyName})`);
        } else if (matchesName(defendantName, partyName)) {
          clientRole = 'defendant';
          console.log(`✅ 의뢰인 역할 자동 감지: 피고 (${defendantName} ← ${partyName})`);
        }
      }

      console.log(`✅ 검색 성공: encCsNo=${result.encCsNo.substring(0, 20)}...`);

      // 일반내용 조회 실패 = 법원명이 잘못되었을 가능성 높음 → 등록 차단
      if (!result.generalData) {
        console.error(`❌ 일반내용 조회 실패 - 법원명이 잘못되었을 수 있습니다.`);
        console.error(`   입력한 법원: "${courtName}"`);
        return NextResponse.json({
          success: false,
          error: `법원명이 올바르지 않습니다. 정확한 법원명을 확인해주세요.\n입력한 법원: ${courtName}`,
          errorType: 'COURT_MISMATCH',
          enteredCourt: courtName,
        }, { status: 422 });
      }

      // 법원명 불일치 감지 (일반내용 조회는 성공했지만 법원명이 다른 경우)
      const scourtCourtName = result.generalData.cortNm;
      const effectiveCourtName = normalizedCourtName || courtName;
      const courtNameMismatch = scourtCourtName && scourtCourtName !== effectiveCourtName;

      // 법원명 불일치 + 자동수정 미확인 → 사용자에게 확인 요청
      const confirmCourtCorrection = body.confirmCourtCorrection === true;
      if (courtNameMismatch && !confirmCourtCorrection) {
        console.warn(`⚠️ 법원명 불일치 감지 - 사용자 확인 필요`);
        console.warn(`   입력값: "${courtName}"`);
        console.warn(`   실제값: "${scourtCourtName}" (SCOURT)`);
        return NextResponse.json({
          success: false,
          error: '법원명이 다릅니다. 올바른 법원명으로 수정하시겠습니까?',
          errorType: 'COURT_CORRECTION_NEEDED',
          enteredCourt: courtName,
          suggestedCourt: scourtCourtName,
          // 재검색 없이 바로 저장할 수 있도록 encCsNo 반환
          encCsNo: result.encCsNo,
          wmonid: result.wmonid,
        }, { status: 422 });
      }

      // 법원명 수정 확인됨 → 실제 법원명 사용
      const actualCourtName = courtNameMismatch ? scourtCourtName : effectiveCourtName;
      if (courtNameMismatch) {
        console.log(`✅ 법원명 수정 확인됨: "${courtName}" → "${scourtCourtName}"`);
      }

      // 스냅샷 저장 (일반내용 데이터가 있는 경우만 - 위에서 이미 확인됨)
      let hasSnapshot = false;
      if (legalCaseId && result.generalData) {
        try {
          const supabase = createAdminClient();
          const caseNumber = `${caseYear}${caseType}${caseSerial}`;

          // 스냅샷 저장 (한글 라벨로 저장)
          const basicInfoKorean: Record<string, string | undefined> = {
            '사건번호': result.generalData.csNo || caseNumber,
            '사건명': result.generalData.csNm || '',
            '법원': result.generalData.cortNm || courtName,
            '원고': result.generalData.aplNm || '',
            '피고': result.generalData.rspNm || '',
            // 사건 카테고리 (UI에서 당사자 라벨 결정용)
            caseCategory: result.generalData.caseCategory,
          };

          // 형사사건 전용 필드
          if (result.generalData.dfndtNm) basicInfoKorean['피고인명'] = result.generalData.dfndtNm;
          if (result.generalData.crmcsNo) basicInfoKorean['형제번호'] = result.generalData.crmcsNo;
          if (result.generalData.aplCtt) basicInfoKorean['상소제기내용'] = result.generalData.aplCtt;

          // 추가 필드가 있으면 포함 (DB에 저장, UI에서 일부 필터링)
          if (result.generalData.jdgNm) basicInfoKorean['재판부'] = result.generalData.jdgNm;
          if (result.generalData.rcptDt) basicInfoKorean['접수일'] = result.generalData.rcptDt;
          // 종국결과: 날짜 + 결과 (예: "2025.08.20 원고패")
          if (result.generalData.endRslt) {
            const endDt = result.generalData.endDt;
            const endDtFormatted = endDt && endDt.length === 8
              ? `${endDt.slice(0,4)}.${endDt.slice(4,6)}.${endDt.slice(6,8)}`
              : '';
            basicInfoKorean['종국결과'] = endDtFormatted
              ? `${endDtFormatted} ${result.generalData.endRslt}`
              : result.generalData.endRslt;
          }
          if (result.generalData.cfrmDt) basicInfoKorean['확정일'] = result.generalData.cfrmDt;
          if (result.generalData.stmpAmnt) basicInfoKorean['인지액'] = result.generalData.stmpAmnt;
          if (result.generalData.mrgrDvs) basicInfoKorean['병합구분'] = result.generalData.mrgrDvs;
          if (result.generalData.aplDt) basicInfoKorean['상소일'] = result.generalData.aplDt;
          if (result.generalData.aplDsmsDt) basicInfoKorean['상소각하일'] = result.generalData.aplDsmsDt;
          if (result.generalData.jdgArvDt) basicInfoKorean['판결도달일'] = result.generalData.jdgArvDt;
          // 추가 필드: 재판부 전화번호, 보존, 조사관 정보
          if (result.generalData.jdgTelno) basicInfoKorean['재판부전화번호'] = result.generalData.jdgTelno;
          if (result.generalData.prsrvYn) basicInfoKorean['보존여부'] = result.generalData.prsrvYn;
          if (result.generalData.prsrvCtt) basicInfoKorean['보존내용'] = result.generalData.prsrvCtt;
          if (result.generalData.exmnrNm) basicInfoKorean['조사관'] = result.generalData.exmnrNm;
          if (result.generalData.exmnrTelNo) basicInfoKorean['조사관전화번호'] = result.generalData.exmnrTelNo;

          // 당사자 정보 (판결도달일, 확정일 포함)
          const partiesData = result.generalData.parties || [];

          // 대리인 정보
          const representativesData = result.generalData.representatives || [];

          // 제출서류 추출
          const rawData = result.generalData.raw?.data as Record<string, unknown> | undefined;
          const rawDocs = (rawData?.dlt_rcntSbmsnDocmtLst as Array<{ ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }>) || [];
          const documentsData = rawDocs.map((d) => ({
            ofdocRcptYmd: d.ofdocRcptYmd || '',
            content: d.content2 || d.content3 || d.content1 || '',
          }));

          // 진행내용은 별도 API에서 조회한 데이터 사용 (result.progressData)
          const progressData = result.progressData || [];

          // 심급 정보 추가
          if (result.generalData.caseLevelDesc) {
            basicInfoKorean['심급'] = result.generalData.caseLevelDesc;
          }

          // basic_info에 당사자/대리인 정보 + raw API 데이터 포함
          // raw API 데이터는 동적 렌더러에서 dma_csBasCtt, dlt_* 구조 사용
          const basicInfoWithParties = {
            ...basicInfoKorean,
            parties: partiesData,
            representatives: representativesData,
            // 동적 렌더링용 raw API 데이터 (dma_csBasCtt, dlt_* 포함)
            generalData: {
              raw: result.generalData.raw,
              caseCategory: result.generalData.caseCategory,
            },
          };

          // 시스템 내 사건 연결을 위해 tenant_id 조회
          const { data: currentCase } = await supabase
            .from('legal_cases')
            .select('tenant_id')
            .eq('id', legalCaseId)
            .single();
          const tenantId = currentCase?.tenant_id;
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

          const findExistingCase = async (caseNo?: string) => {
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
            (result.generalData.relatedCases || []).map(async rc => {
              const linkedCase = await findExistingCase(rc.userCsNo);
              return {
                caseNo: rc.userCsNo,           // 사건번호
                caseName: rc.reltCsCortNm,     // 법원명
                relation: rc.reltCsDvsNm,      // 관계유형 (반소, 항소심, 본안사건 등)
                encCsNo: rc.encCsNo || null,   // 암호화 사건번호 (일반내용/진행내용 조회용)
                linkedCaseId: linkedCase?.id || null,                  // 시스템 내 사건 ID
              };
            })
          );

          // 심급내용/원심 사건 정보 가공 (UI 필드명에 맞춤)
          // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
          const lowerCourtData = await Promise.all(
            (result.generalData.lowerCourtCases || []).map(async lc => {
              const linkedCase = await findExistingCase(lc.userCsNo);
              return {
                caseNo: lc.userCsNo,           // 사건번호 (예: 2024드단23848)
                courtName: lc.cortNm,          // 법원명 (예: 수원가정법원 평택지원)
                result: lc.ultmtDvsNm,         // 결과 (예: 원고패, 청구인용)
                resultDate: lc.ultmtYmd,       // 종국일 (YYYYMMDD)
                encCsNo: lc.encCsNo || null,   // 암호화 사건번호 (일반내용/진행내용 조회용)
                linkedCaseId: linkedCase?.id || null,                  // 시스템 내 사건 ID
              };
            })
          );
          console.log(`📋 심급내용 (원심) ${lowerCourtData.length}건, 연관사건 ${relatedCasesData.length}건 추출`);

          const { error: snapshotError } = await supabase
            .from('scourt_case_snapshots')
            .insert({
              legal_case_id: legalCaseId,
              basic_info: basicInfoWithParties,
              hearings: result.generalData.hearings || [],
              progress: progressData,  // 진행내용 (별도 API)
              documents: documentsData,  // 제출서류 원본
              lower_court: lowerCourtData,  // 심급내용 (원심 사건 정보)
              related_cases: relatedCasesData,  // 연관사건 (반소, 항소심, 본안 등)
              raw_data: result.generalData.raw || null,  // XML 렌더링용 원본 데이터
              case_number: caseNumber,
              court_code: actualCourtName,  // SCOURT 실제 법원명 사용
            });

          if (!snapshotError) {
            hasSnapshot = true;
            console.log(`📸 스냅샷 저장 완료: 기일 ${result.generalData.hearings?.length || 0}건, 진행 ${progressData.length}건, 서류 ${documentsData.length}건, 당사자 ${partiesData.length}명, 대리인 ${representativesData.length}명`);

            // ============================================================
            // 연관사건/심급 자동 연결 (공통 모듈 사용)
            // ============================================================
            if (relatedCasesData.length > 0 || lowerCourtData.length > 0) {
              try {
                await linkRelatedCases({
                  supabase,
                  legalCaseId,
                  tenantId: tenantId!,
                  caseNumber,
                  caseType,
                  relatedCases: relatedCasesData,
                  lowerCourt: lowerCourtData,
                });
              } catch (linkError) {
                console.error('연관사건 연결 실패:', linkError);
              }
            }

            // 심급 정보 결정 (일반내용 데이터 우선, 없으면 입력된 caseType으로 추론)
            const caseLevel = result.generalData?.caseLevelDesc || inferCaseLevelFromType(caseType);
            console.log(`📋 심급 정보: ${caseLevel} (일반내용=${result.generalData?.caseLevelDesc}, 추론=${inferCaseLevelFromType(caseType)})`);

            // 공용 함수로 encCsNo 저장 (실제 법원명 사용)
            await saveEncCsNoToCase({
              legalCaseId,
              encCsNo: result.encCsNo,
              wmonid: result.wmonid!,  // encCsNo가 있으면 wmonid도 존재
              caseNumber,
              courtName: actualCourtName,  // SCOURT 실제 법원명 사용
              caseLevel,  // 심급 정보 저장
            });

            // 법원명 불일치 시 legal_cases 테이블도 업데이트
            if (courtNameMismatch) {
              const { error: courtUpdateError } = await supabase
                .from('legal_cases')
                .update({ court_name: actualCourtName })
                .eq('id', legalCaseId);

              if (!courtUpdateError) {
                console.log(`✅ legal_cases.court_name 자동 수정 완료: "${actualCourtName}"`);
              } else {
                console.error('court_name 업데이트 에러:', courtUpdateError);
              }
            }

            // 자동 감지된 client_role 저장 (SCOURT에서 확인되면 confirmed)
            if (clientRole) {
              const { error: roleError } = await supabase
                .from('legal_cases')
                .update({
                  client_role: clientRole,
                  client_role_status: 'confirmed'  // SCOURT에서 확인됨
                })
                .eq('id', legalCaseId);

              if (!roleError) {
                console.log(`✅ client_role 저장 완료: ${clientRole} (status: confirmed)`);
              } else {
                console.error('client_role 저장 에러:', roleError);
              }
            }
          } else {
            console.error('스냅샷 저장 에러:', snapshotError);
          }
        } catch (e) {
          console.error('스냅샷 저장 중 에러:', e);
        }
      }

      return NextResponse.json({
        success: true,
        caseInfo: {
          caseNumber: `${caseYear}${caseType}${caseSerial}`,
          encCsNo: result.encCsNo,
          wmonid: result.wmonid,
          clientRole,
          courtName: actualCourtName,  // 실제 저장된 법원명 (수정된 경우 SCOURT 값)
        },
        captchaAttempts: 1,
        hasSnapshot,
        generalData: {
          hearings: result.generalData.hearings?.length || 0,
          progress: result.progressData?.length || 0,  // 진행내용 수
        },
        // 법원명이 수정된 경우 알림
        courtNameCorrected: courtNameMismatch ? {
          original: courtName,
          corrected: actualCourtName,
        } : null,
      });
    } else {
      console.log(`❌ 검색 실패: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error || '사건을 찾을 수 없습니다',
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('사건 검색 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
