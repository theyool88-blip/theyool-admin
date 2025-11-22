/**
 * 사건 데드라인 목록 조회 및 생성 API (관리자 전용)
 * @route GET/POST /api/admin/case-deadlines
 *
 * GET: 목록 조회 (필터링, 페이지네이션)
 * POST: 신규 생성 (deadline_date 자동 계산)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { getCaseDeadlines, createCaseDeadline } from '@/lib/supabase/case-deadlines';
import type {
  CreateCaseDeadlineRequest,
  CaseDeadlineListQuery,
  ApiListResponse,
  ApiResponse,
  CaseDeadline,
} from '@/types/court-hearing';

/**
 * GET /api/admin/case-deadlines
 *
 * 쿼리 파라미터:
 * - case_number: 사건번호
 * - deadline_type: 데드라인 유형
 * - status: 상태
 * - urgent_only: 긴급(7일 이내)만 조회 (true/false)
 * - limit: 페이지당 개수 (기본값: 50)
 * - offset: 오프셋 (기본값: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiListResponse<CaseDeadline> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const filters: CaseDeadlineListQuery = {
      case_number: searchParams.get('case_number') || undefined,
      deadline_type: searchParams.get('deadline_type') as any,
      status: searchParams.get('status') as any,
      urgent_only: searchParams.get('urgent_only') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    const { data, count } = await getCaseDeadlines(filters);

    const response: ApiListResponse<CaseDeadline> = {
      success: true,
      data,
      count,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/admin/case-deadlines error:', error);
    const response: ApiListResponse<CaseDeadline> = {
      success: false,
      error: error.message || '데드라인 조회 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * POST /api/admin/case-deadlines
 *
 * Body:
 * {
 *   case_number: string,
 *   deadline_type: DeadlineType,
 *   trigger_date: string (ISO 8601 date, YYYY-MM-DD),
 *   notes?: string,
 *   status?: DeadlineStatus
 * }
 *
 * 주의: deadline_date와 deadline_datetime은 트리거로 자동 계산됨
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<CaseDeadline> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const body: CreateCaseDeadlineRequest = await request.json();

    // 필수 필드 검증
    if (!body.case_number || !body.deadline_type || !body.trigger_date) {
      const response: ApiResponse<CaseDeadline> = {
        success: false,
        error: '필수 필드 누락: case_number, deadline_type, trigger_date',
      };
      return NextResponse.json(response, { status: 400 });
    }

    const deadline = await createCaseDeadline(body);

    const response: ApiResponse<CaseDeadline> = {
      success: true,
      data: deadline,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/case-deadlines error:', error);
    const response: ApiResponse<CaseDeadline> = {
      success: false,
      error: error.message || '데드라인 생성 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
