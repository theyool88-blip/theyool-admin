/**
 * 불변기간 타입 마스터 데이터 조회 API (관리자 전용, 읽기 전용)
 * @route GET /api/admin/deadline-types
 *
 * GET: 모든 불변기간 타입 목록 조회
 *
 * 특징: 5개 고정 마스터 데이터, 생성/수정/삭제 불가
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { getDeadlineTypes } from '@/lib/supabase/deadline-types';
import type {
  ApiListResponse,
  DeadlineTypeMaster,
} from '@/types/court-hearing';

/**
 * GET /api/admin/deadline-types
 * 모든 불변기간 타입 조회
 *
 * 반환 예시:
 * {
 *   success: true,
 *   data: [
 *     { id: "...", type: "DL_APPEAL", name: "항소기간", days: 14, description: "...", created_at: "..." },
 *     { id: "...", type: "DL_MEDIATION_OBJ", name: "조정결정 이의신청", days: 14, ... },
 *     ...
 *   ],
 *   count: 5
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      const response: ApiListResponse<DeadlineTypeMaster> = {
        success: false,
        error: '인증이 필요합니다.',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const types = await getDeadlineTypes();

    const response: ApiListResponse<DeadlineTypeMaster> = {
      success: true,
      data: types,
      count: types.length,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('GET /api/admin/deadline-types error:', error);
    const response: ApiListResponse<DeadlineTypeMaster> = {
      success: false,
      error: error.message || '불변기간 타입 조회 실패',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
