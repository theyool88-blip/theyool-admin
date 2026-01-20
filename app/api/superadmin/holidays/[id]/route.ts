/**
 * 공휴일 상세 관리 API (슈퍼 어드민 전용)
 * @route GET/PATCH/DELETE /api/superadmin/holidays/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withSuperAdmin } from '@/lib/api/with-super-admin';

/**
 * GET /api/superadmin/holidays/[id]
 * 공휴일 상세 조회
 */
export const GET = withSuperAdmin(async (
  _request: NextRequest,
  { params }
) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: '공휴일을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/superadmin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 조회 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/superadmin/holidays/[id]
 * 공휴일 수정
 */
export const PATCH = withSuperAdmin(async (
  request: NextRequest,
  { params }
) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { holiday_date, holiday_name } = body;

    const updateData: Record<string, string> = {};
    if (holiday_date) updateData.holiday_date = holiday_date;
    if (holiday_name) updateData.holiday_name = holiday_name;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '수정할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('holidays')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: '공휴일을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: '공휴일이 수정되었습니다.',
    });
  } catch (error) {
    console.error('PATCH /api/superadmin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 수정 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/superadmin/holidays/[id]
 * 공휴일 삭제
 */
export const DELETE = withSuperAdmin(async (
  _request: NextRequest,
  { params }
) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '공휴일이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('DELETE /api/superadmin/holidays/[id] error:', error);
    const message = error instanceof Error ? error.message : '공휴일 삭제 실패';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
