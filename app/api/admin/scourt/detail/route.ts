/**
 * 대법원 사건 일반내용 조회 API
 *
 * POST /api/admin/scourt/detail
 *
 * 핵심: 저장된 encCsNo가 있으면 캡챠 없이 일반내용 조회 가능!
 *
 * 요청:
 * - caseNumber: 사건번호 (필수, 예: 2024드단26718)
 * - legalCaseId: DB의 legal_cases ID (필수, encCsNo 조회용)
 *
 * 응답:
 * - success: 성공 여부
 * - general: 사건 일반내용 (기일, 당사자 등)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScourtApiClient } from '@/lib/scourt/api-client';
import { getStoredEncCsNo, updateSyncStatus } from '@/lib/scourt/case-storage';
import { syncHearingsToCourtHearings } from '@/lib/scourt/hearing-sync';
import { transformHearings, transformProgress } from '@/lib/scourt/field-transformer';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCourtFullName } from '@/lib/scourt/court-codes';

// 사건번호 파싱 (예: 2024드단26718 → { year: 2024, type: 드단, serial: 26718 })
function parseCaseNumber(caseNumber: string): {
  year: string;
  type: string;
  serial: string;
} | null {
  // 패턴: 4자리 연도 + 한글 사건유형 + 숫자 일련번호
  const match = caseNumber.match(/^(\d{4})([가-힣]+)(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    year: match[1],
    type: match[2],
    serial: match[3],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseNumber, legalCaseId } = body;

    // 필수 파라미터 검증
    if (!caseNumber) {
      return NextResponse.json(
        { error: '사건번호가 필요합니다' },
        { status: 400 }
      );
    }

    if (!legalCaseId) {
      return NextResponse.json(
        { error: 'legalCaseId가 필요합니다' },
        { status: 400 }
      );
    }

    // 저장된 encCsNo 조회
    const stored = await getStoredEncCsNo(legalCaseId);
    if (!stored || !stored.encCsNo || !stored.wmonid) {
      return NextResponse.json(
        {
          success: false,
          error: '저장된 encCsNo가 없습니다. 먼저 사건 검색을 실행해주세요.',
        },
        { status: 404 }
      );
    }

    // 사건번호 파싱
    const parsed = parseCaseNumber(caseNumber);
    if (!parsed) {
      return NextResponse.json(
        { error: '사건번호 형식이 올바르지 않습니다 (예: 2024드단26718)' },
        { status: 400 }
      );
    }

    // 법원명 조회
    const supabase = createAdminClient();
    const { data: caseData } = await supabase
      .from('legal_cases')
      .select('court_name')
      .eq('id', legalCaseId)
      .single();

    const courtName = caseData?.court_name || '서울가정법원';
    const normalizedCourtName = getCourtFullName(courtName, parsed.type);

    console.log(`📍 일반내용 조회 시작: ${caseNumber} (캡챠 불필요)`);
    console.log(`  encCsNo: ${stored.encCsNo.substring(0, 20)}...`);

    // 동기화 상태 업데이트
    await updateSyncStatus(legalCaseId, 'syncing');

    // API 클라이언트로 일반내용 조회 (캡챠 불필요!)
    const apiClient = getScourtApiClient();
    const result = await apiClient.getCaseGeneralWithStoredEncCsNo(
      stored.wmonid,
      stored.encCsNo,
      {
        cortCd: normalizedCourtName,
        csYear: parsed.year,
        csDvsCd: parsed.type,
        csSerial: parsed.serial,
      }
    );

    if (result.success && result.data) {
      // 동기화 상태 업데이트
      await updateSyncStatus(legalCaseId, 'synced');

      // legal_cases 메타데이터 업데이트
      const rawData = result.data.raw || {};
      await supabase
        .from('legal_cases')
        .update({
          scourt_last_sync: new Date().toISOString(),
          scourt_sync_status: 'synced',
          judge_name: rawData.jdgNm || undefined,
        })
        .eq('id', legalCaseId);

      // 기일 정보가 있으면 court_hearings 테이블 동기화
      const hearings = result.data.hearings || [];
      let hearingSyncResult = null;

      if (hearings.length > 0) {
        console.log(`📅 기일 정보 ${hearings.length}건 → court_hearings 동기화`);

        // SCOURT 필드를 표준 필드로 변환
        interface ScourtHearing {
          trmDt?: string;
          date?: string;
          trmHm?: string;
          time?: string;
          trmNm?: string;
          type?: string;
          trmPntNm?: string;
          location?: string;
          rslt?: string;
          result?: string;
        }

        const transformedHearings = hearings.map((h: ScourtHearing) => ({
          date: h.trmDt || h.date || '',
          time: h.trmHm || h.time || '',
          type: h.trmNm || h.type || '',
          location: h.trmPntNm || h.location || '',
          result: h.rslt || h.result || '',
        }));

        hearingSyncResult = await syncHearingsToCourtHearings(
          legalCaseId,
          caseNumber,
          transformedHearings
        );

        console.log(`✅ 기일 동기화 완료: 생성 ${hearingSyncResult.created}, 업데이트 ${hearingSyncResult.updated}, 스킵 ${hearingSyncResult.skipped}`);
      }

      // 응답 데이터 변환
      const transformedGeneral = {
        ...result.data,
        hearings: transformHearings(hearings),
        progress: transformProgress(result.data.progress || []),
      };

      return NextResponse.json({
        success: true,
        general: transformedGeneral,
        hearingSync: hearingSyncResult,
      });
    } else {
      // 실패 시 상태 업데이트
      await updateSyncStatus(legalCaseId, 'failed', result.error);

      return NextResponse.json(
        {
          success: false,
          error: result.error || '일반내용 조회 실패',
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error('일반내용 조회 API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 에러' },
      { status: 500 }
    );
  }
}
