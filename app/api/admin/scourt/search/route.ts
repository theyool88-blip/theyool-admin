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

    // API로 사건 검색 및 encCsNo 획득 (상세 조회 포함)
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

      // 상세 데이터에서 원고/피고 마스킹 이름 추출
      if (result.detailData) {
        const plaintiffName = result.detailData.aplNm || ''; // 예: "권O철"
        const defendantName = result.detailData.rspNm || ''; // 예: "김O일"

        if (matchesName(plaintiffName, partyName)) {
          clientRole = 'plaintiff';
          console.log(`✅ 의뢰인 역할 자동 감지: 원고 (${plaintiffName} ← ${partyName})`);
        } else if (matchesName(defendantName, partyName)) {
          clientRole = 'defendant';
          console.log(`✅ 의뢰인 역할 자동 감지: 피고 (${defendantName} ← ${partyName})`);
        }
      }

      console.log(`✅ 검색 성공: encCsNo=${result.encCsNo.substring(0, 20)}...`);

      // 스냅샷 저장 (legalCaseId가 있고 상세 데이터가 있는 경우)
      let hasSnapshot = false;
      if (legalCaseId && result.detailData) {
        try {
          const supabase = createAdminClient();
          const caseNumber = `${caseYear}${caseType}${caseSerial}`;

          // 스냅샷 저장 (한글 라벨로 저장)
          const basicInfoKorean: Record<string, string> = {
            '사건번호': result.detailData.csNo || caseNumber,
            '사건명': result.detailData.csNm || '',
            '법원': result.detailData.cortNm || courtName,
            '원고': result.detailData.aplNm || '',
            '피고': result.detailData.rspNm || '',
          };

          // 추가 필드가 있으면 포함 (DB에 저장, UI에서 일부 필터링)
          if (result.detailData.jdgNm) basicInfoKorean['재판부'] = result.detailData.jdgNm;
          if (result.detailData.rcptDt) basicInfoKorean['접수일'] = result.detailData.rcptDt;
          // 종국결과: 날짜 + 결과 (예: "2025.08.20 원고패")
          if (result.detailData.endRslt) {
            const endDt = result.detailData.endDt;
            const endDtFormatted = endDt && endDt.length === 8
              ? `${endDt.slice(0,4)}.${endDt.slice(4,6)}.${endDt.slice(6,8)}`
              : '';
            basicInfoKorean['종국결과'] = endDtFormatted
              ? `${endDtFormatted} ${result.detailData.endRslt}`
              : result.detailData.endRslt;
          }
          if (result.detailData.cfrmDt) basicInfoKorean['확정일'] = result.detailData.cfrmDt;
          if (result.detailData.stmpAmnt) basicInfoKorean['인지액'] = result.detailData.stmpAmnt;
          if (result.detailData.mrgrDvs) basicInfoKorean['병합구분'] = result.detailData.mrgrDvs;
          if (result.detailData.aplDt) basicInfoKorean['상소일'] = result.detailData.aplDt;
          if (result.detailData.aplDsmsDt) basicInfoKorean['상소각하일'] = result.detailData.aplDsmsDt;
          if (result.detailData.jdgArvDt) basicInfoKorean['판결도달일'] = result.detailData.jdgArvDt;
          // 추가 필드: 재판부 전화번호, 보존, 조사관 정보
          if (result.detailData.jdgTelno) basicInfoKorean['재판부전화번호'] = result.detailData.jdgTelno;
          if (result.detailData.prsrvYn) basicInfoKorean['보존여부'] = result.detailData.prsrvYn;
          if (result.detailData.prsrvCtt) basicInfoKorean['보존내용'] = result.detailData.prsrvCtt;
          if (result.detailData.exmnrNm) basicInfoKorean['조사관'] = result.detailData.exmnrNm;
          if (result.detailData.exmnrTelNo) basicInfoKorean['조사관전화번호'] = result.detailData.exmnrTelNo;

          // 당사자 정보 (판결도달일, 확정일 포함)
          const partiesData = result.detailData.parties || [];

          // 대리인 정보
          const representativesData = result.detailData.representatives || [];

          // 제출서류 추출
          const rawDocs = result.detailData.raw?.data?.dlt_rcntSbmsnDocmtLst || [];
          const documentsData = rawDocs.map((d: { ofdocRcptYmd?: string; content1?: string; content2?: string; content3?: string }) => ({
            ofdocRcptYmd: d.ofdocRcptYmd || '',
            content: d.content2 || d.content3 || d.content1 || '',
          }));

          // 진행내용은 별도 API에서 조회한 데이터 사용 (result.progressData)
          const progressData = result.progressData || [];

          // basic_info에 당사자/대리인 정보 포함
          const basicInfoWithParties = {
            ...basicInfoKorean,
            parties: partiesData,
            representatives: representativesData,
          };

          const { error: snapshotError } = await supabase
            .from('scourt_case_snapshots')
            .insert({
              legal_case_id: legalCaseId,
              basic_info: basicInfoWithParties,
              hearings: result.detailData.hearings || [],
              progress: progressData,  // 진행내용 (별도 API)
              documents: documentsData,  // 제출서류 원본
              lower_court: [],
              related_cases: [],
              case_number: caseNumber,
              court_code: courtName,
            });

          if (!snapshotError) {
            hasSnapshot = true;
            console.log(`📸 스냅샷 저장 완료: 기일 ${result.detailData.hearings?.length || 0}건, 진행 ${progressData.length}건, 서류 ${documentsData.length}건, 당사자 ${partiesData.length}명, 대리인 ${representativesData.length}명`);

            // 공용 함수로 encCsNo 저장
            await saveEncCsNoToCase({
              legalCaseId,
              encCsNo: result.encCsNo,
              wmonid: result.wmonid!,  // encCsNo가 있으면 wmonid도 존재
              caseNumber,
              courtName,
            });

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
        },
        captchaAttempts: 1,
        hasSnapshot,
        detailData: result.detailData ? {
          hearings: result.detailData.hearings?.length || 0,
          progress: result.detailData.progress?.length || 0,
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
