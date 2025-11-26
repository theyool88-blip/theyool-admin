import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  ConsultationWeeklySchedule,
  UpdateWeeklyScheduleInput,
} from '@/types/consultation-availability';

/**
 * GET /api/admin/availability/weekly/[id]
 * 특정 주간 일정 조회
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
      .from('consultation_weekly_schedule')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching weekly schedule:', error);
      return NextResponse.json(
        { error: 'Weekly schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule: data as ConsultationWeeklySchedule });
  } catch (error) {
    console.error('Error in GET /api/admin/availability/weekly/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/availability/weekly/[id]
 * 주간 일정 수정
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

    const body: UpdateWeeklyScheduleInput = await request.json();

    // 데이터 업데이트
    const { data, error } = await supabase
      .from('consultation_weekly_schedule')
      .update({
        ...(body.start_time !== undefined && { start_time: body.start_time }),
        ...(body.end_time !== undefined && { end_time: body.end_time }),
        ...(body.slot_duration_minutes !== undefined && {
          slot_duration_minutes: body.slot_duration_minutes,
        }),
        ...(body.is_available !== undefined && {
          is_available: body.is_available,
        }),
        ...(body.office_location !== undefined && {
          office_location: body.office_location,
        }),
        ...(body.lawyer_name !== undefined && { lawyer_name: body.lawyer_name }),
        ...(body.consultation_type !== undefined && {
          consultation_type: body.consultation_type,
        }),
        ...(body.max_bookings_per_slot !== undefined && {
          max_bookings_per_slot: body.max_bookings_per_slot,
        }),
        ...(body.notes !== undefined && { notes: body.notes }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating weekly schedule:', error);
      return NextResponse.json(
        { error: 'Failed to update weekly schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule: data as ConsultationWeeklySchedule });
  } catch (error) {
    console.error('Error in PATCH /api/admin/availability/weekly/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/availability/weekly/[id]
 * 주간 일정 삭제
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
      .from('consultation_weekly_schedule')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting weekly schedule:', error);
      return NextResponse.json(
        { error: 'Failed to delete weekly schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/admin/availability/weekly/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
