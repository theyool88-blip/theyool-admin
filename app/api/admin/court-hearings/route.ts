/**
 * 법원 기일 목록 조회 및 생성 API (관리자 전용, 테넌트 격리)
 * @route GET/POST /api/admin/court-hearings
 *
 * GET: 목록 조회 (필터링, 페이지네이션)
 * POST: 신규 생성
 */

import { NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { getCourtHearings, createCourtHearing } from '@/lib/supabase/court-hearings';
import type {
  CreateCourtHearingRequest,
  CourtHearingListQuery,
  ApiListResponse,
  ApiResponse,
  CourtHearing,
  HearingType,
  HearingStatus,
} from '@/types/court-hearing';

/**
 * GET /api/admin/court-hearings
 *
 * 쿼리 파라미터:
 * - case_number: 사건번호
 * - hearing_type: 기일 유형
 * - status: 상태
 * - from_date: 시작일 (ISO 8601 date)
 * - to_date: 종료일 (ISO 8601 date)
 * - limit: 페이지당 개수 (기본값: 50)
 * - offset: 오프셋 (기본값: 0)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);

    const hearingType = searchParams.get('hearing_type') as HearingType | null
    const hearingStatus = searchParams.get('status') as HearingStatus | null

    const filters: CourtHearingListQuery = {
      case_number: searchParams.get('case_number') || undefined,
      hearing_type: hearingType || undefined,
      status: hearingStatus || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    // 테넌트 ID 전달
    const tenantId = tenant.isSuperAdmin ? undefined : tenant.tenantId;
    const { data, count } = await getCourtHearings(filters, tenantId);

    const response: ApiListResponse<CourtHearing> = {
      success: true,
      data,
      count,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/admin/court-hearings error:', error);
    const response: ApiListResponse<CourtHearing> = {
      success: false,
      error: error instanceof Error ? error.message : '법원 기일 조회 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
})

/**
 * POST /api/admin/court-hearings
 *
 * Body:
 * {
 *   case_number: string,
 *   hearing_type: HearingType,
 *   hearing_date: string (ISO 8601 datetime),
 *   location?: string,
 *   judge_name?: string,
 *   notes?: string,
 *   status?: HearingStatus
 * }
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const body: CreateCourtHearingRequest = await request.json();

    // 필수 필드 검증
    if (!body.case_number || !body.hearing_type || !body.hearing_date) {
      const response: ApiResponse<CourtHearing> = {
        success: false,
        error: '필수 필드 누락: case_number, hearing_type, hearing_date',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 테넌트 ID 전달
    const hearing = await createCourtHearing(body, tenant.tenantId);

    const response: ApiResponse<CourtHearing> = {
      success: true,
      data: hearing,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/court-hearings error:', error);
    const response: ApiResponse<CourtHearing> = {
      success: false,
      error: error instanceof Error ? error.message : '법원 기일 생성 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
})
