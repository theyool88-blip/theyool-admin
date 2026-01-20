/**
 * 공휴일 조회 API (인증된 사용자용)
 * @route GET /api/admin/holidays
 *
 * 공휴일 관리(추가/수정/삭제)는 슈퍼 어드민 전용 API 사용:
 * @see /api/superadmin/holidays
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant } from '@/lib/api/with-tenant';

/**
 * GET /api/admin/holidays
 * 공휴일 목록 조회 (연도별 필터링 가능)
 * - DB의 holidays 테이블에서 조회
 * - 모든 인증된 사용자 접근 가능 (전역 데이터)
 */
export const GET = withTenant(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const supabase = createAdminClient();

    const { data: holidays, error } = await supabase
      .from('holidays')
      .select('id, holiday_date, holiday_name, year')
      .eq('year', year)
      .order('holiday_date', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: holidays || [],
      count: holidays?.length || 0,
    });
  } catch (error) {
    console.error('GET /api/admin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 조회 실패';
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
});
