import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ConsultationDateException,
  CreateDateExceptionInput,
} from '@/types/consultation-availability';

/**
 * GET /api/admin/availability/exceptions
 * 날짜 예외 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const lawyerName = searchParams.get('lawyer_name');
    const officeLocation = searchParams.get('office_location');

    // 데이터 조회
    let query = supabase
      .from('consultation_date_exceptions')
      .select('*')
      .order('exception_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (startDate) {
      query = query.gte('exception_date', startDate);
    }

    if (endDate) {
      query = query.lte('exception_date', endDate);
    }

    if (lawyerName) {
      query = query.eq('lawyer_name', lawyerName);
    }

    if (officeLocation) {
      query = query.eq('office_location', officeLocation);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching date exceptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch date exceptions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      exceptions: data as ConsultationDateException[],
    });
  } catch (error) {
    console.error('Error in GET /api/admin/availability/exceptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/availability/exceptions
 * 날짜 예외 설정 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateDateExceptionInput = await request.json();

    // 유효성 검사
    if (!body.exception_date) {
      return NextResponse.json(
        { error: 'Missing required field: exception_date' },
        { status: 400 }
      );
    }

    // 데이터 삽입
    const { data, error } = await supabase
      .from('consultation_date_exceptions')
      .insert({
        exception_date: body.exception_date,
        start_time: body.start_time ?? null,
        end_time: body.end_time ?? null,
        is_blocked: body.is_blocked,
        reason: body.reason ?? null,
        office_location: body.office_location ?? null,
        lawyer_name: body.lawyer_name ?? null,
        consultation_type: body.consultation_type ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating date exception:', error);
      return NextResponse.json(
        { error: 'Failed to create date exception' },
        { status: 500 }
      );
    }

    return NextResponse.json({ exception: data as ConsultationDateException });
  } catch (error) {
    console.error('Error in POST /api/admin/availability/exceptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
