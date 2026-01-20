/**
 * 공휴일 일괄 관리 API (슈퍼 어드민 전용)
 * @route POST/DELETE /api/superadmin/holidays/bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

interface HolidayInput {
  holiday_date: string;
  holiday_name: string;
}

/**
 * POST /api/superadmin/holidays/bulk
 * 공휴일 일괄 추가 (중복 무시)
 */
export const POST = withSuperAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { holidays } = body as { holidays: HolidayInput[] };

    if (!Array.isArray(holidays) || holidays.length === 0) {
      return NextResponse.json(
        { success: false, error: '공휴일 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // upsert로 중복 처리
    const { data, error } = await supabase
      .from('holidays')
      .upsert(
        holidays.map(h => ({
          holiday_date: h.holiday_date,
          holiday_name: h.holiday_name,
        })),
        { onConflict: 'holiday_date' }
      )
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
      message: `${data?.length || 0}개의 공휴일이 등록되었습니다.`,
    });
  } catch (error) {
    console.error('POST /api/superadmin/holidays/bulk error:', error);
    const message = error instanceof Error ? error.message : '공휴일 일괄 추가 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/superadmin/holidays/bulk
 * 특정 연도의 공휴일 전체 삭제
 */
export const DELETE = withSuperAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json(
        { success: false, error: '연도를 지정하세요.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('holidays')
      .delete()
      .eq('year', parseInt(year))
      .select('id');

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      message: `${year}년 공휴일 ${data?.length || 0}건이 삭제되었습니다.`,
    });
  } catch (error) {
    console.error('DELETE /api/superadmin/holidays/bulk error:', error);
    const message = error instanceof Error ? error.message : '공휴일 일괄 삭제 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
