/**
 * 공휴일 상세 조회/수정/삭제 API (관리자 전용)
 * @route GET/PATCH/DELETE /api/admin/holidays/[id]
 */

import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

type HolidayUpdate = {
  holiday_date?: string;
  holiday_name?: string;
}

/**
 * GET /api/admin/holidays/[id]
 * 공휴일 상세 조회
 */
export async function GET(_request: unknown, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('korean_public_holidays')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '공휴일을 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('GET /api/admin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 조회 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/holidays/[id]
 * 공휴일 수정
 */
export async function PATCH(request: Request, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const body = (await request.json()) as HolidayUpdate;
    const { holiday_date, holiday_name } = body;

    const updateData: HolidayUpdate = {};
    if (holiday_date !== undefined) updateData.holiday_date = holiday_date;
    if (holiday_name !== undefined) updateData.holiday_name = holiday_name;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('korean_public_holidays')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: '공휴일이 수정되었습니다.'
    });
  } catch (error) {
    console.error('PATCH /api/admin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 수정 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/holidays/[id]
 * 공휴일 삭제
 */
export async function DELETE(_request: unknown, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('korean_public_holidays')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '공휴일이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('DELETE /api/admin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 삭제 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
