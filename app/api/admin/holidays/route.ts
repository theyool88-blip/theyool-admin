/**
 * 공휴일 관리 API (관리자 전용)
 * @route GET/POST /api/admin/holidays
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/holidays
 * 공휴일 목록 조회 (연도별 필터링 가능)
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const supabase = createAdminClient();
    let query = supabase
      .from('korean_public_holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('GET /api/admin/holidays error:', error);
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
 * POST /api/admin/holidays
 * 공휴일 추가
 */
type HolidayPayload = {
  holiday_date: string
  holiday_name: string
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await isAuthenticated();
    if (!authCheck) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<HolidayPayload>;
    const { holiday_date, holiday_name } = body;

    if (!holiday_date || !holiday_name) {
      return NextResponse.json(
        { error: '날짜와 공휴일명을 입력하세요.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('korean_public_holidays')
      .insert({
        holiday_date,
        holiday_name
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: '해당 날짜의 공휴일이 이미 존재합니다.' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: '공휴일이 추가되었습니다.'
    });
  } catch (error) {
    console.error('POST /api/admin/holidays error:', error);
    const message = error instanceof Error ? error.message : '공휴일 추가 실패'
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
