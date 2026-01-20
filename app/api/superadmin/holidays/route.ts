/**
 * 공휴일 관리 API (슈퍼 어드민 전용)
 * @route GET/POST /api/superadmin/holidays
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

/**
 * GET /api/superadmin/holidays
 * 공휴일 목록 조회 (연도별 필터링)
 */
export const GET = withSuperAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const supabase = createAdminClient();

    const { data: holidays, error, count } = await supabase
      .from('holidays')
      .select('*', { count: 'exact' })
      .eq('year', year)
      .order('holiday_date', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: holidays || [],
      count: count || 0,
    });
  } catch (error) {
    console.error('GET /api/superadmin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 조회 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

/**
 * POST /api/superadmin/holidays
 * 공휴일 추가
 */
export const POST = withSuperAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { holiday_date, holiday_name } = body;

    if (!holiday_date || !holiday_name) {
      return NextResponse.json(
        { success: false, error: '날짜와 공휴일명을 입력하세요.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 중복 체크
    const { data: existing } = await supabase
      .from('holidays')
      .select('id')
      .eq('holiday_date', holiday_date)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 날짜입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('holidays')
      .insert({
        holiday_date,
        holiday_name,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: '공휴일이 추가되었습니다.',
    });
  } catch (error) {
    console.error('POST /api/superadmin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 추가 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
