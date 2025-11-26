/**
 * 한국 법정 기간 계산 유틸리티
 * 민법 제161조: 기간의 말일이 토요일 또는 공휴일에 해당한 때에는 기간은 그 익일로 만료한다.
 */

/**
 * 2025년 대한민국 법정 공휴일
 * 출처: 관공서의 공휴일에 관한 규정
 */
export const KOREAN_PUBLIC_HOLIDAYS_2025 = [
  '2025-01-01', // 신정
  '2025-01-28', // 설날 연휴
  '2025-01-29', // 설날
  '2025-01-30', // 설날 연휴
  '2025-03-01', // 삼일절
  '2025-03-03', // 대체공휴일 (삼일절)
  '2025-05-05', // 어린이날
  '2025-05-06', // 대체공휴일 (어린이날)
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05', // 추석 연휴
  '2025-10-06', // 추석
  '2025-10-07', // 추석 연휴
  '2025-10-08', // 추석 대체공휴일
  '2025-10-09', // 한글날
  '2025-12-25', // 성탄절
];

/**
 * 해당 날짜가 토요일인지 확인
 */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

/**
 * 해당 날짜가 일요일인지 확인
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * 해당 날짜가 주말(토요일 또는 일요일)인지 확인
 */
export function isWeekend(date: Date): boolean {
  return isSaturday(date) || isSunday(date);
}

/**
 * 해당 날짜가 법정 공휴일인지 확인
 * 일요일도 공휴일로 간주 (관공서의 공휴일에 관한 규정 제2조)
 */
export function isPublicHoliday(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_2025): boolean {
  // 일요일은 항상 공휴일
  if (isSunday(date)) {
    return true;
  }

  const dateStr = date.toISOString().split('T')[0];
  return holidays.includes(dateStr);
}

/**
 * 해당 날짜가 토요일 또는 공휴일(일요일 포함)인지 확인
 * 민법 제161조 적용 대상
 */
export function isNonBusinessDay(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_2025): boolean {
  return isSaturday(date) || isPublicHoliday(date, holidays);
}

/**
 * 다음 영업일을 찾는 함수
 * 토요일 또는 공휴일이면 익일로 이동
 */
export function getNextBusinessDay(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_2025): Date {
  const nextDay = new Date(date);

  while (isNonBusinessDay(nextDay, holidays)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}

/**
 * 법정 기간 계산 (민법 제161조 적용)
 *
 * @param triggerDate 기산일 (시작일)
 * @param days 기간 (일수)
 * @param excludeInitialDay 초일불산입 여부 (기본값: false)
 * @param holidays 공휴일 목록
 * @returns 만료일
 *
 * @example
 * // 선고일 2025-03-01, 항소기간 14일
 * calculateLegalDeadline(new Date('2025-03-01'), 14, false)
 * // → 2025-03-15 (토요일이면 → 2025-03-17)
 */
export function calculateLegalDeadline(
  triggerDate: Date,
  days: number,
  excludeInitialDay: boolean = false,
  holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_2025
): Date {
  // 1. 기산일 설정
  const startDate = new Date(triggerDate);

  // 2. 초일불산입 처리 (필요시)
  if (excludeInitialDay) {
    startDate.setDate(startDate.getDate() + 1);
  }

  // 3. 기간 계산 (단순 일수 더하기)
  let deadline = new Date(startDate);
  deadline.setDate(deadline.getDate() + days);

  // 4. 민법 제161조 적용: 말일이 토요일 또는 공휴일이면 익일로 연장
  deadline = getNextBusinessDay(deadline, holidays);

  return deadline;
}

/**
 * 법정 기간 계산 (날짜 문자열 반환)
 */
export function calculateLegalDeadlineString(
  triggerDateStr: string,
  days: number,
  excludeInitialDay: boolean = false,
  holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_2025
): string {
  const triggerDate = new Date(triggerDateStr);
  const deadline = calculateLegalDeadline(triggerDate, days, excludeInitialDay, holidays);
  return deadline.toISOString().split('T')[0];
}

/**
 * SQL 함수에서 사용할 수 있는 공휴일 체크 쿼리 생성
 */
export function generateHolidayCheckSQL(year: number = 2025): string {
  const holidays = KOREAN_PUBLIC_HOLIDAYS_2025
    .filter(h => h.startsWith(year.toString()))
    .map(h => `'${h}'`)
    .join(', ');

  return `AND v_current_date::TEXT NOT IN (${holidays})`;
}
