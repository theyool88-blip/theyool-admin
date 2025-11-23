/**
 * 공휴일 상세 조회/수정/삭제 API (관리자 전용)
 * @route GET/PATCH/DELETE /api/admin/holidays/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/holidays/[id]
 * 공휴일 상세 조회
 */
export async function GET(request: NextRequest, context: RouteParams) {
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
  } catch (error: any) {
    console.error('GET /api/admin/holidays/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '공휴일 조회 실패'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/holidays/[id]
 * 공휴일 수정
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const { holiday_date, holiday_name } = body;

    const updateData: any = {};
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
  } catch (error: any) {
    console.error('PATCH /api/admin/holidays/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '공휴일 수정 실패'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/holidays/[id]
 * 공휴일 삭제
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
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
  } catch (error: any) {
    console.error('DELETE /api/admin/holidays/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '공휴일 삭제 실패'
      },
      { status: 500 }
    );
  }
}
