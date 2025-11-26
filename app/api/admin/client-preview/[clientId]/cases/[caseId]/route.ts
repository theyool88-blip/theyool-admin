/**
 * 관리자용 의뢰인 사건 상세 미리보기 API
 * @description 특정 의뢰인의 특정 사건에 대한 상세 정보 조회
 * @endpoint GET /api/admin/client-preview/[clientId]/cases/[caseId]
 * @returns 사건 상세 정보, 재판기일 목록, 기한 목록
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthenticated } from '@/lib/auth/auth';

// Response Types
interface CaseDetail {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
  onedrive_folder_url: string | null;
}

interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string | null;
  court_name: string | null;
  hearing_type: string | null;
  hearing_result: string | null;
  judge_name: string | null;
  hearing_report: string | null;
  case_number: string | null;
}

interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string | null;
  description: string | null;
  is_completed: boolean;
}

interface CaseDetailResponse {
  success: true;
  case: CaseDetail;
  hearings: Hearing[];
  deadlines: Deadline[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; caseId: string }> }
) {
  try {
    // Authentication check
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { clientId, caseId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId) || !uuidRegex.test(caseId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID 형식입니다.' },
        { status: 400 }
      );
    }

    // 1. 사건 조회 (해당 의뢰인의 사건인지 확인)
    const { data: caseDetail, error: caseError } = await supabase
      .from('legal_cases')
      .select(`
        id,
        case_name,
        contract_number,
        case_type,
        status,
        office,
        contract_date,
        created_at,
        onedrive_folder_url
      `)
      .eq('id', caseId)
      .eq('client_id', clientId)
      .single();

    if (caseError) {
      console.error('[Case Detail] Case fetch error:', {
        clientId,
        caseId,
        error: caseError.message,
        code: caseError.code
      });
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!caseDetail) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 재판기일 조회 (최신순)
    const { data: hearings, error: hearingsError } = await supabase
      .from('court_hearings')
      .select(`
        id,
        hearing_date,
        location,
        hearing_type,
        result,
        judge_name,
        report,
        case_number
      `)
      .eq('case_id', caseId)
      .order('hearing_date', { ascending: false });

    if (hearingsError) {
      console.error('[Case Detail] Hearings fetch error:', {
        caseId,
        error: hearingsError.message
      });
    }

    // 재판기일 데이터 변환 (hearing_date에서 날짜와 시간 분리)
    const transformedHearings = hearings?.map((h) => {
      const dateTimeParts = h.hearing_date.split(' ');
      const date = dateTimeParts[0];
      const time = dateTimeParts.length > 1 ? dateTimeParts[1] : null;

      return {
        id: h.id,
        hearing_date: date,
        hearing_time: time,
        court_name: h.location,
        hearing_type: h.hearing_type,
        hearing_result: h.result,
        judge_name: h.judge_name,
        hearing_report: h.report,
        case_number: h.case_number,
      };
    }) || [];

    // 3. 기한 조회 (날짜순, 완료 여부 구분)
    const { data: deadlines, error: deadlinesError } = await supabase
      .from('case_deadlines')
      .select(`
        id,
        deadline_date,
        deadline_type,
        notes,
        status
      `)
      .eq('case_id', caseId)
      .order('deadline_date', { ascending: true });

    if (deadlinesError) {
      console.error('[Case Detail] Deadlines fetch error:', {
        caseId,
        error: deadlinesError.message
      });
    }

    // 기한 데이터 변환 (status를 is_completed로 변환)
    const transformedDeadlines = deadlines?.map((d) => ({
      id: d.id,
      deadline_date: d.deadline_date,
      deadline_type: d.deadline_type,
      description: d.notes,
      is_completed: d.status === 'COMPLETED',
    })) || [];

    // 완료 여부로 정렬 (미완료 먼저)
    transformedDeadlines.sort((a, b) => {
      if (a.is_completed === b.is_completed) return 0;
      return a.is_completed ? 1 : -1;
    });

    const response: CaseDetailResponse = {
      success: true,
      case: caseDetail,
      hearings: transformedHearings,
      deadlines: transformedDeadlines,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Case Detail] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
