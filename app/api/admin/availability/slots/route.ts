/**
 * Admin Availability Slots API
 * 특정 날짜의 예약 가능한 시간 슬롯 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAuthenticated } from '@/lib/auth/auth';

/**
 * GET /api/admin/availability/slots?date=YYYY-MM-DD&office_location=천안&lawyer_name=육심원
 * 특정 날짜의 예약 가능한 시간 슬롯 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const officeLocation = searchParams.get('office_location');
    const lawyerName = searchParams.get('lawyer_name');

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. 해당 날짜의 요일 구하기 (0=일요일, 1=월요일, ..., 6=토요일)
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    // 2. 주간 일정에서 해당 요일의 예약 가능 시간 조회
    let weeklyQuery = supabase
      .from('consultation_weekly_schedule')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);

    if (officeLocation) {
      weeklyQuery = weeklyQuery.or(`office_location.eq.${officeLocation},office_location.is.null`);
    }

    if (lawyerName) {
      weeklyQuery = weeklyQuery.or(`lawyer_name.eq.${lawyerName},lawyer_name.is.null`);
    }

    const { data: weeklySchedules, error: weeklyError } = await weeklyQuery;

    if (weeklyError) {
      console.error('Error fetching weekly schedules:', weeklyError);
      return NextResponse.json(
        { error: 'Failed to fetch weekly schedules' },
        { status: 500 }
      );
    }

    // 3. 날짜 예외 확인
    let exceptionsQuery = supabase
      .from('consultation_date_exceptions')
      .select('*')
      .eq('exception_date', date);

    if (officeLocation) {
      exceptionsQuery = exceptionsQuery.or(`office_location.eq.${officeLocation},office_location.is.null`);
    }

    if (lawyerName) {
      exceptionsQuery = exceptionsQuery.or(`lawyer_name.eq.${lawyerName},lawyer_name.is.null`);
    }

    const { data: exceptions, error: exceptionsError } = await exceptionsQuery;

    if (exceptionsError) {
      console.error('Error fetching exceptions:', exceptionsError);
      return NextResponse.json(
        { error: 'Failed to fetch exceptions' },
        { status: 500 }
      );
    }

    // 4. 종일 휴무인지 확인
    const dayBlocked = exceptions?.some(
      (e) => e.is_blocked && !e.start_time && !e.end_time
    );

    if (dayBlocked) {
      return NextResponse.json({
        date,
        dayOfWeek,
        isBlocked: true,
        slots: [],
        message: '해당 날짜는 휴무입니다.',
      });
    }

    // 5. 기존 예약 조회 (충돌 체크용)
    let existingQuery = supabase
      .from('consultations')
      .select('confirmed_date, confirmed_time, assigned_lawyer, office_location, status')
      .eq('confirmed_date', date)
      .in('status', ['confirmed', 'in_progress']);

    if (lawyerName) {
      existingQuery = existingQuery.eq('assigned_lawyer', lawyerName);
    }

    if (officeLocation) {
      existingQuery = existingQuery.eq('office_location', officeLocation);
    }

    const { data: existingBookings, error: bookingsError } = await existingQuery;

    if (bookingsError) {
      console.error('Error fetching existing bookings:', bookingsError);
    }

    // 6. 시간 슬롯 생성
    const allSlots: {
      time: string;
      available: boolean;
      remaining: number;
      maxCapacity: number;
    }[] = [];

    if (weeklySchedules && weeklySchedules.length > 0) {
      for (const schedule of weeklySchedules) {
        const slots = generateTimeSlots(
          schedule.start_time,
          schedule.end_time,
          schedule.slot_duration_minutes || 30
        );

        for (const slot of slots) {
          // 예외로 차단된 시간인지 확인
          const blockedByException = exceptions?.some((e) => {
            if (!e.is_blocked) return false;
            if (!e.start_time || !e.end_time) return false;

            return isTimeInRange(slot.time, e.start_time, e.end_time);
          });

          if (blockedByException) continue;

          // 기존 예약 수 확인
          const bookingsInSlot = existingBookings?.filter(
            (b) => b.confirmed_time === slot.time
          ).length || 0;

          const maxCapacity = schedule.max_bookings_per_slot || 1;
          const remaining = Math.max(0, maxCapacity - bookingsInSlot);

          // 기존 슬롯이 있으면 병합, 없으면 추가
          const existingSlot = allSlots.find((s) => s.time === slot.time);
          if (existingSlot) {
            existingSlot.remaining += remaining;
            existingSlot.maxCapacity += maxCapacity;
            existingSlot.available = existingSlot.remaining > 0;
          } else {
            allSlots.push({
              time: slot.time,
              available: remaining > 0,
              remaining,
              maxCapacity,
            });
          }
        }
      }
    }

    // 7. 시간순 정렬
    allSlots.sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({
      date,
      dayOfWeek,
      isBlocked: false,
      slots: allSlots,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/availability/slots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 시작 시간부터 종료 시간까지의 시간 슬롯 생성
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number = 30
): { time: string }[] {
  const slots: { time: string }[] = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMinute < endMinute)
  ) {
    const slotTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    slots.push({ time: slotTime });

    currentMinute += durationMinutes;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }
  }

  return slots;
}

/**
 * 특정 시간이 범위 내에 있는지 확인
 */
function isTimeInRange(time: string, rangeStart: string, rangeEnd: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(rangeStart);
  const endMinutes = timeToMinutes(rangeEnd);

  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

/**
 * 시간 문자열을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
