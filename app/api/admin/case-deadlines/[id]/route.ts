/**
 * 사건 데드라인 상세 조회/수정/삭제 API (관리자 전용)
 * @route GET/PATCH/DELETE /api/admin/case-deadlines/[id]
 *
 * GET: 상세 조회
 * PATCH: 수정 (trigger_date 변경 시 deadline_date 자동 재계산)
 * DELETE: 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import {
  getCaseDeadlineById,
  updateCaseDeadline,
  deleteCaseDeadline,
} from '@/lib/supabase/case-deadlines';
import type {
  UpdateCaseDeadlineRequest,
  ApiResponse,
  CaseDeadline,
} from '@/types/court-hearing';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/case-deadlines/[id]
 * 데드라인 상세 조회
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<CaseDeadline> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const params = await context.params;
    const deadline = await getCaseDeadlineById(params.id);

    if (!deadline) {
      const response: ApiResponse<CaseDeadline> = {
        success: false,
        error: '데드라인을 찾을 수 없습니다.',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<CaseDeadline> = {
      success: true,
      data: deadline,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/admin/case-deadlines/[id] error:', error);
    const response: ApiResponse<CaseDeadline> = {
      success: false,
      error: error.message || '데드라인 조회 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * PATCH /api/admin/case-deadlines/[id]
 * 데드라인 수정
 *
 * 주의: trigger_date를 변경하면 deadline_date도 자동 재계산됨
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<CaseDeadline> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const params = await context.params;
    const body: UpdateCaseDeadlineRequest = await request.json();

    const deadline = await updateCaseDeadline(params.id, body);

    const response: ApiResponse<CaseDeadline> = {
      success: true,
      data: deadline,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('PATCH /api/admin/case-deadlines/[id] error:', error);
    const response: ApiResponse<CaseDeadline> = {
      success: false,
      error: error.message || '데드라인 수정 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * DELETE /api/admin/case-deadlines/[id]
 * 데드라인 삭제
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<null> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const params = await context.params;
    await deleteCaseDeadline(params.id);

    const response: ApiResponse<null> = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('DELETE /api/admin/case-deadlines/[id] error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error.message || '데드라인 삭제 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
