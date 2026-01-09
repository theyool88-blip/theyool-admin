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
import { saveEncCsNoToCase, saveSnapshot } from '@/lib/scourt/case-storage';
import {
  SCOURT_RELATION_MAP,
  determineRelationDirection,
  determineMainCase,
  shouldUpdateMainCase,
  inferCaseLevelFromType,
} from '@/lib/scourt/case-relations';

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

    // API로 사건 검색 및 encCsNo 획득 (일반내용 조회 포함)
    const result = await apiClient.searchAndRegisterCase({
      cortCd: courtName,
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
      const courtNameMismatch = scourtCourtName && scourtCourtName !== courtName;

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
      const actualCourtName = courtNameMismatch ? scourtCourtName : courtName;
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
          const rawDocs = result.generalData.raw?.data?.dlt_rcntSbmsnDocmtLst || [];
          const documentsData = rawDocs.map((d: { ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }) => ({
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

          // 연관사건 정보 가공 (UI 필드명에 맞춤: caseNo, caseName, relation)
          // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
          const relatedCasesData = await Promise.all(
            (result.generalData.relatedCases || []).map(async rc => {
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
                caseNo: rc.userCsNo,           // 사건번호
                caseName: rc.reltCsCortNm,     // 법원명
                relation: rc.reltCsDvsNm,      // 관계유형 (반소, 항소심, 본안사건 등)
                encCsNo: rc.encCsNo || null,   // 암호화 사건번호 (일반내용/진행내용 조회용)
                linkedCaseId,                  // 시스템 내 사건 ID
              };
            })
          );

          // 심급내용/원심 사건 정보 가공 (UI 필드명에 맞춤)
          // linkedCaseId: 시스템 내 사건이 있으면 해당 사건 ID
          const lowerCourtData = await Promise.all(
            (result.generalData.lowerCourtCases || []).map(async lc => {
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
                caseNo: lc.userCsNo,           // 사건번호 (예: 2024드단23848)
                courtName: lc.cortNm,          // 법원명 (예: 수원가정법원 평택지원)
                result: lc.ultmtDvsNm,         // 결과 (예: 원고패, 청구인용)
                resultDate: lc.ultmtYmd,       // 종국일 (YYYYMMDD)
                encCsNo: lc.encCsNo || null,   // 암호화 사건번호 (일반내용/진행내용 조회용)
                linkedCaseId,                  // 시스템 내 사건 ID
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
            // 연관사건 자동 연결 로직
            // ============================================================
            if (relatedCasesData.length > 0) {
              console.log(`🔗 연관사건 ${relatedCasesData.length}건 발견, 자동 연결 시도...`);

              // 현재 사건의 tenant_id 조회
              const { data: currentCase } = await supabase
                .from('legal_cases')
                .select('tenant_id')
                .eq('id', legalCaseId)
                .single();

              if (currentCase?.tenant_id) {
                for (const relatedCase of relatedCasesData) {
                  // 시스템에 이미 존재하는 사건인지 확인 (court_case_number로 매칭)
                  const { data: existingCase } = await supabase
                    .from('legal_cases')
                    .select('id, case_level, court_case_number, main_case_id')
                    .eq('tenant_id', currentCase.tenant_id)
                    .ilike('court_case_number', `%${relatedCase.caseNo}%`)
                    .single();

                  if (existingCase) {
                    console.log(`  ✅ 연관사건 발견: ${relatedCase.caseNo} → ID: ${existingCase.id}`);

                    // 이미 연결되어 있는지 확인
                    const { data: existingRelation } = await supabase
                      .from('case_relations')
                      .select('id')
                      .or(`and(case_id.eq.${legalCaseId},related_case_id.eq.${existingCase.id}),and(case_id.eq.${existingCase.id},related_case_id.eq.${legalCaseId})`)
                      .single();

                    if (!existingRelation) {
                      // case_relations에 자동 연결
                      const relationType = SCOURT_RELATION_MAP[relatedCase.relation] || 'related';
                      const direction = determineRelationDirection(relatedCase.relation, caseType);

                      const { error: relationError } = await supabase
                        .from('case_relations')
                        .insert({
                          case_id: legalCaseId,
                          related_case_id: existingCase.id,
                          relation_type: relatedCase.relation,  // 원본 SCOURT 라벨
                          relation_type_code: relationType,
                          direction,
                          auto_detected: true,
                          detected_at: new Date().toISOString(),
                          scourt_enc_cs_no: relatedCase.encCsNo,
                        });

                      if (!relationError) {
                        console.log(`  📎 case_relations 자동 등록: ${relatedCase.relation}`);

                        // 주사건 업데이트 로직
                        const currentCaseLevel = inferCaseLevelFromType(caseType);
                        const existingCaseTypeMatch = existingCase.court_case_number?.match(/\d{4}([가-힣]+)\d+/);
                        const existingCaseType = existingCaseTypeMatch?.[1] || '';
                        const relatedCaseLevel = existingCase.case_level || inferCaseLevelFromType(existingCaseType);

                        // 주사건이 변경되어야 하는지 확인
                        const shouldUpdate = shouldUpdateMainCase(
                          { case_level: currentCaseLevel, case_type_code: caseType },
                          { case_level: relatedCaseLevel, case_type_code: existingCaseType }
                        );

                        if (shouldUpdate) {
                          // 현재 사건이 더 높은 심급 → 현재 사건이 주사건
                          console.log(`  👑 주사건 변경: ${legalCaseId} (${currentCaseLevel})`);

                          // 연관사건의 main_case_id 업데이트
                          await supabase
                            .from('legal_cases')
                            .update({ main_case_id: legalCaseId })
                            .eq('id', existingCase.id);

                          // 현재 사건은 자기 자신이 주사건
                          await supabase
                            .from('legal_cases')
                            .update({ main_case_id: legalCaseId })
                            .eq('id', legalCaseId);
                        } else if (existingCase.main_case_id) {
                          // 기존 사건에 주사건이 있으면 현재 사건도 같은 주사건으로 설정
                          await supabase
                            .from('legal_cases')
                            .update({ main_case_id: existingCase.main_case_id })
                            .eq('id', legalCaseId);
                          console.log(`  📌 주사건 연결: ${existingCase.main_case_id}`);
                        }
                      } else {
                        console.error(`  ❌ case_relations 등록 실패:`, relationError);
                      }
                    } else {
                      console.log(`  ⏭️ 이미 연결됨: ${relatedCase.caseNo}`);
                    }
                  } else {
                    console.log(`  ⚠️ 미등록 연관사건: ${relatedCase.caseNo} (${relatedCase.relation})`);
                  }
                }
              }
            }

            // ============================================================
            // 심급내용(원심) 자동 연결 로직
            // ============================================================
            if (lowerCourtData.length > 0) {
              console.log(`🔗 심급내용(원심) ${lowerCourtData.length}건 발견, 자동 연결 시도...`);

              // 현재 사건의 tenant_id 조회 (위에서 이미 조회한 경우 재사용)
              const { data: currentCaseForLower } = await supabase
                .from('legal_cases')
                .select('tenant_id')
                .eq('id', legalCaseId)
                .single();

              if (currentCaseForLower?.tenant_id) {
                for (const lowerCase of lowerCourtData) {
                  // 시스템에 이미 존재하는 사건인지 확인 (court_case_number로 매칭)
                  const { data: existingLowerCase } = await supabase
                    .from('legal_cases')
                    .select('id, case_level, court_case_number, main_case_id')
                    .eq('tenant_id', currentCaseForLower.tenant_id)
                    .ilike('court_case_number', `%${lowerCase.caseNo}%`)
                    .single();

                  if (existingLowerCase) {
                    console.log(`  ✅ 원심사건 발견: ${lowerCase.caseNo} → ID: ${existingLowerCase.id}`);

                    // 이미 연결되어 있는지 확인
                    const { data: existingLowerRelation } = await supabase
                      .from('case_relations')
                      .select('id')
                      .or(`and(case_id.eq.${legalCaseId},related_case_id.eq.${existingLowerCase.id}),and(case_id.eq.${existingLowerCase.id},related_case_id.eq.${legalCaseId})`)
                      .single();

                    if (!existingLowerRelation) {
                      // case_relations에 자동 연결 (현재 사건 → 원심: 하심사건 관계)
                      const { error: lowerRelationError } = await supabase
                        .from('case_relations')
                        .insert({
                          case_id: legalCaseId,
                          related_case_id: existingLowerCase.id,
                          relation_type: '하심사건',  // SCOURT 라벨
                          relation_type_code: 'appeal',  // 항소 관계
                          direction: 'child',  // 현재 사건이 상위심급 (부모)
                          auto_detected: true,
                          detected_at: new Date().toISOString(),
                          scourt_enc_cs_no: lowerCase.encCsNo,
                        });

                      if (!lowerRelationError) {
                        console.log(`  📎 심급내용 case_relations 자동 등록: 하심사건`);

                        // 주사건 업데이트: 현재 사건(상위심급)이 주사건
                        console.log(`  👑 주사건 설정: ${legalCaseId} (상위심급)`);

                        // 원심사건의 main_case_id를 현재 사건으로 업데이트
                        await supabase
                          .from('legal_cases')
                          .update({ main_case_id: legalCaseId })
                          .eq('id', existingLowerCase.id);

                        // 현재 사건도 자기 자신이 주사건 (이미 설정되어 있을 수 있음)
                        await supabase
                          .from('legal_cases')
                          .update({ main_case_id: legalCaseId })
                          .eq('id', legalCaseId);
                      } else {
                        console.error(`  ❌ 심급내용 case_relations 등록 실패:`, lowerRelationError);
                      }
                    } else {
                      console.log(`  ⏭️ 이미 연결됨: ${lowerCase.caseNo}`);
                    }
                  } else {
                    console.log(`  ⚠️ 미등록 원심사건: ${lowerCase.caseNo} (${lowerCase.courtName})`);
                  }
                }
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

            // 자동 감지된 client_role 저장
            if (clientRole) {
              const { error: roleError } = await supabase
                .from('legal_cases')
                .update({ client_role: clientRole })
                .eq('id', legalCaseId);

              if (!roleError) {
                console.log(`✅ client_role 저장 완료: ${clientRole}`);
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
