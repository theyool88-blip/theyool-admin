/**
 * Consultation Scheduling Utility Functions
 * 상담 일정 조율을 위한 유틸리티 함수들
 */

import { createClient } from '@/lib/supabase/server';

export interface ScheduleConflict {
  id: string;
  name: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  assigned_to?: string | null;
  status: string;
}

export interface CheckScheduleConflictsParams {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  assignedTo?: string | null; // tenant_members.id
  excludeId?: string; // 업데이트 시 자기 자신은 제외
}

/**
 * 특정 날짜/시간에 충돌하는 예약이 있는지 확인
 */
export async function checkScheduleConflicts(
  params: CheckScheduleConflictsParams
): Promise<ScheduleConflict[]> {
  const { date, time, assignedTo, excludeId } = params;

  const supabase = await createClient();

  // 같은 날짜/시간의 기존 예약 조회
  let query = supabase
    .from('consultations')
    .select('id, name, phone, preferred_date, preferred_time, assigned_to, status')
    .eq('preferred_date', date)
    .eq('preferred_time', time)
    .in('status', ['pending', 'in_progress']);

  // 자기 자신 제외
  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data: existingBookings, error } = await query;

  if (error) {
    console.error('Error checking schedule conflicts:', error);
    throw new Error('일정 충돌 확인 중 오류가 발생했습니다.');
  }

  if (!existingBookings || existingBookings.length === 0) {
    return [];
  }

  // 담당자별 중복 체크
  if (assignedTo) {
    const assigneeConflicts = existingBookings.filter(
      (b) => b.assigned_to === assignedTo
    );
    if (assigneeConflicts.length > 0) {
      return assigneeConflicts as ScheduleConflict[];
    }
  }

  return [];
}

/**
 * 일정 확정 시 상태 자동 변경 로직
 */
export function shouldAutoConfirm(currentStatus: string): boolean {
  return currentStatus === 'pending' || currentStatus === 'contacted';
}

/**
 * Zoom 링크 생성 (향후 구현)
 */
export async function generateVideoLink(consultationId: string): Promise<string> {
  // TODO: Zoom API 연동
  // 상담 ID를 포함해 임시 링크를 고정 길이로 생성
  const seed = consultationId?.slice(-6) || 'session';
  return `https://zoom.us/j/${seed}-${Math.random().toString(36).substring(7)}`;
}

/**
 * SMS 발송 (향후 구현)
 */
export interface SendConfirmationSMSParams {
  phone: string;
  name?: string;
  date: string;
  time: string;
  officeLocation?: string;
  videoLink?: string;
}

export async function sendConfirmationSMS(
  params: SendConfirmationSMSParams
): Promise<void> {
  const { phone, name, date, time, officeLocation, videoLink } = params;

  // TODO: SMS API 연동 (Supabase Edge Functions)
  console.log('[SMS] Sending confirmation to:', phone);
  console.log('[SMS] Details:', { name, date, time, officeLocation, videoLink });

  // 임시 구현: 로그만 출력
  const message = officeLocation
    ? `${name}님, 상담이 확정되었습니다. 일시: ${date} ${time}, 장소: ${officeLocation} 사무소`
    : videoLink
    ? `${name}님, 화상 상담이 확정되었습니다. 일시: ${date} ${time}, 링크: ${videoLink}`
    : `${name}님, 상담이 확정되었습니다. 일시: ${date} ${time}`;

  console.log('[SMS] Message:', message);

  // 실제 SMS 발송은 향후 구현
  // await fetch('/api/sms/send', { ... })
}

/**
 * 날짜 포맷팅 유틸리티
 */
export function formatDateKorean(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];

  return `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
}

export function formatTimeKorean(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours <= 12 ? hours : hours - 12;

  return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
}
