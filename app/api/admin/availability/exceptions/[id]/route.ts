import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ConsultationDateException,
  UpdateDateExceptionInput,
} from '@/types/consultation-availability';

/**
 * GET /api/admin/availability/exceptions/[id]
 * 특정 날짜 예외 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('consultation_date_exceptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching date exception:', error);
      return NextResponse.json(
        { error: 'Date exception not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ exception: data as ConsultationDateException });
  } catch (error) {
    console.error('Error in GET /api/admin/availability/exceptions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/availability/exceptions/[id]
 * 날짜 예외 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateDateExceptionInput = await request.json();

    // 데이터 업데이트
    const { data, error } = await supabase
      .from('consultation_date_exceptions')
      .update({
        ...(body.exception_date !== undefined && {
          exception_date: body.exception_date,
        }),
        ...(body.start_time !== undefined && { start_time: body.start_time }),
        ...(body.end_time !== undefined && { end_time: body.end_time }),
        ...(body.is_blocked !== undefined && { is_blocked: body.is_blocked }),
        ...(body.reason !== undefined && { reason: body.reason }),
        ...(body.office_location !== undefined && {
          office_location: body.office_location,
        }),
        ...(body.lawyer_name !== undefined && { lawyer_name: body.lawyer_name }),
        ...(body.consultation_type !== undefined && {
          consultation_type: body.consultation_type,
        }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating date exception:', error);
      return NextResponse.json(
        { error: 'Failed to update date exception' },
        { status: 500 }
      );
    }

    return NextResponse.json({ exception: data as ConsultationDateException });
  } catch (error) {
    console.error('Error in PATCH /api/admin/availability/exceptions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/availability/exceptions/[id]
 * 날짜 예외 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('consultation_date_exceptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting date exception:', error);
      return NextResponse.json(
        { error: 'Failed to delete date exception' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/availability/exceptions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
