import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withTenant, withTenantId } from '@/lib/api/with-tenant';
import {
  ConsultationWeeklySchedule,
  CreateWeeklyScheduleInput,
} from '@/types/consultation-availability';

/**
 * GET /api/admin/availability/weekly
 * 주간 상담 일정 조회 (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get('day_of_week');
    const lawyerName = searchParams.get('lawyer_name');
    const officeLocation = searchParams.get('office_location');

    // 데이터 조회
    let query = supabase
      .from('consultation_weekly_schedule')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId);
    }

    if (dayOfWeek !== null) {
      query = query.eq('day_of_week', parseInt(dayOfWeek));
    }

    if (lawyerName) {
      query = query.eq('lawyer_name', lawyerName);
    }

    if (officeLocation) {
      query = query.eq('office_location', officeLocation);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching weekly schedule:', error);
      return NextResponse.json(
        { error: 'Failed to fetch weekly schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schedules: data as ConsultationWeeklySchedule[],
    });
  } catch (error) {
    console.error('Error in GET /api/admin/availability/weekly:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/availability/weekly
 * 주간 상담 일정 추가 (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient();

    const body: CreateWeeklyScheduleInput = await request.json();

    // 유효성 검사
    if (
      body.day_of_week === undefined ||
      !body.start_time ||
      !body.end_time
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: day_of_week, start_time, end_time' },
        { status: 400 }
      );
    }

    if (body.day_of_week < 0 || body.day_of_week > 6) {
      return NextResponse.json(
        { error: 'day_of_week must be between 0 and 6' },
        { status: 400 }
      );
    }

    // 데이터 삽입 (테넌트 ID 포함)
    const { data, error } = await supabase
      .from('consultation_weekly_schedule')
      .insert([withTenantId({
        day_of_week: body.day_of_week,
        start_time: body.start_time,
        end_time: body.end_time,
        slot_duration_minutes: body.slot_duration_minutes ?? 30,
        is_available: body.is_available ?? true,
        office_location: body.office_location ?? null,
        lawyer_name: body.lawyer_name ?? null,
        consultation_type: body.consultation_type ?? null,
        max_bookings_per_slot: body.max_bookings_per_slot ?? 1,
        notes: body.notes ?? null,
      }, tenant)])
      .select()
      .single();

    if (error) {
      console.error('Error creating weekly schedule:', error);
      return NextResponse.json(
        { error: 'Failed to create weekly schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule: data as ConsultationWeeklySchedule });
  } catch (error) {
    console.error('Error in POST /api/admin/availability/weekly:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
