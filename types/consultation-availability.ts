/**
 * Consultation Availability Types
 * 상담 가능 시간 관리 시스템
 */

import { OfficeLocation, LawyerName } from './consultation';

// ============================================================================
// DATABASE TYPES
// ============================================================================

export type ConsultationType = 'visit' | 'video' | 'callback';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=일요일, 6=토요일

/**
 * 주간 반복 상담 가능 시간 설정
 */
export interface ConsultationWeeklySchedule {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string; // 'HH:MM' format
  end_time: string; // 'HH:MM' format
  slot_duration_minutes: number; // 예약 단위 (기본 30분)
  is_available: boolean;
  office_location?: OfficeLocation | null;
  lawyer_name?: LawyerName | null;
  consultation_type?: ConsultationType | null;
  max_bookings_per_slot: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 특정 날짜 예외 설정
 */
export interface ConsultationDateException {
  id: string;
  exception_date: string; // 'YYYY-MM-DD' format
  start_time?: string | null; // 'HH:MM' format, NULL이면 종일
  end_time?: string | null; // 'HH:MM' format
  is_blocked: boolean; // true=차단(휴무), false=특별 추가
  reason?: string | null;
  office_location?: OfficeLocation | null;
  lawyer_name?: LawyerName | null;
  consultation_type?: ConsultationType | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateWeeklyScheduleInput {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  slot_duration_minutes?: number;
  is_available?: boolean;
  office_location?: OfficeLocation;
  lawyer_name?: LawyerName;
  consultation_type?: ConsultationType;
  max_bookings_per_slot?: number;
  notes?: string;
}

export interface UpdateWeeklyScheduleInput {
  start_time?: string;
  end_time?: string;
  slot_duration_minutes?: number;
  is_available?: boolean;
  office_location?: OfficeLocation | null;
  lawyer_name?: LawyerName | null;
  consultation_type?: ConsultationType | null;
  max_bookings_per_slot?: number;
  notes?: string;
}

export interface CreateDateExceptionInput {
  exception_date: string; // 'YYYY-MM-DD'
  start_time?: string; // 'HH:MM'
  end_time?: string; // 'HH:MM'
  is_blocked: boolean;
  reason?: string;
  office_location?: OfficeLocation;
  lawyer_name?: LawyerName;
  consultation_type?: ConsultationType;
}

export interface UpdateDateExceptionInput {
  exception_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  is_blocked?: boolean;
  reason?: string;
  office_location?: OfficeLocation | null;
  lawyer_name?: LawyerName | null;
  consultation_type?: ConsultationType | null;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * 특정 날짜 범위의 예약 가능 시간대 조회 요청
 */
export interface AvailableSlotsQuery {
  start_date: string; // 'YYYY-MM-DD'
  end_date: string; // 'YYYY-MM-DD'
  office_location?: OfficeLocation;
  lawyer_name?: LawyerName;
  consultation_type?: ConsultationType;
}

/**
 * 특정 날짜의 예약 가능 시간대
 */
export interface DailyAvailableSlots {
  date: string; // 'YYYY-MM-DD'
  day_of_week: DayOfWeek;
  is_available: boolean; // 해당 날짜가 전체 휴무인지
  slots: TimeSlot[];
  exceptions?: ConsultationDateException[]; // 해당 날짜의 예외 설정
}

/**
 * 시간 슬롯
 */
export interface TimeSlot {
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  is_available: boolean;
  remaining_capacity: number; // 남은 예약 가능 수
  max_capacity: number; // 최대 예약 가능 수
}

// ============================================================================
// DISPLAY LABELS
// ============================================================================

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

export const DAY_OF_WEEK_SHORT_LABELS: Record<DayOfWeek, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  visit: '방문 상담',
  video: '화상 상담',
  callback: '콜백 상담',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * 날짜 문자열을 요일 번호로 변환
 */
export function getDayOfWeek(dateString: string): DayOfWeek {
  const date = new Date(dateString);
  return date.getDay() as DayOfWeek;
}

/**
 * 시간 범위 내에서 슬롯 생성
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number = 30
): { start_time: string; end_time: string }[] {
  const slots: { start_time: string; end_time: string }[] = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMinute < endMinute)
  ) {
    const slotStart = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    currentMinute += durationMinutes;
    if (currentMinute >= 60) {
      currentHour += Math.floor(currentMinute / 60);
      currentMinute = currentMinute % 60;
    }

    const slotEnd = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    // 슬롯 종료 시간이 전체 종료 시간을 넘지 않는지 확인
    if (
      currentHour < endHour ||
      (currentHour === endHour && currentMinute <= endMinute)
    ) {
      slots.push({ start_time: slotStart, end_time: slotEnd });
    }
  }

  return slots;
}

/**
 * 시간 문자열을 분으로 변환
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * 두 시간 범위가 겹치는지 확인
 */
export function isTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  return start1Min < end2Min && end1Min > start2Min;
}

/**
 * 날짜 범위 생성
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
