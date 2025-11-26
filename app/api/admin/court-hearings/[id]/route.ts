/**
 * 법원 기일 상세 조회/수정/삭제 API (관리자 전용)
 * @route GET/PATCH/DELETE /api/admin/court-hearings/[id]
 *
 * GET: 상세 조회
 * PATCH: 수정
 * DELETE: 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import {
  getCourtHearingById,
  updateCourtHearing,
  deleteCourtHearing,
} from '@/lib/supabase/court-hearings';
import type {
  UpdateCourtHearingRequest,
  ApiResponse,
  CourtHearing,
} from '@/types/court-hearing';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/court-hearings/[id]
 * 법원 기일 상세 조회
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<CourtHearing> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const params = await context.params;
    const hearing = await getCourtHearingById(params.id);

    if (!hearing) {
      const response: ApiResponse<CourtHearing> = {
        success: false,
        error: '법원 기일을 찾을 수 없습니다.',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<CourtHearing> = {
      success: true,
      data: hearing,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/admin/court-hearings/[id] error:', error);
    const response: ApiResponse<CourtHearing> = {
      success: false,
      error: error instanceof Error ? error.message : '법원 기일 조회 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * PATCH /api/admin/court-hearings/[id]
 * 법원 기일 수정
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiResponse<CourtHearing> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const params = await context.params;
    const body: UpdateCourtHearingRequest = await request.json();

    const hearing = await updateCourtHearing(params.id, body);

    const response: ApiResponse<CourtHearing> = {
      success: true,
      data: hearing,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('PATCH /api/admin/court-hearings/[id] error:', error);
    const response: ApiResponse<CourtHearing> = {
      success: false,
      error: error instanceof Error ? error.message : '법원 기일 수정 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * DELETE /api/admin/court-hearings/[id]
 * 법원 기일 삭제
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
    await deleteCourtHearing(params.id);

    const response: ApiResponse<null> = {
      success: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('DELETE /api/admin/court-hearings/[id] error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '법원 기일 삭제 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
