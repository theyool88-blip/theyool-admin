/**
 * 한국 법정 기간 계산 유틸리티
 *
 * 법적 근거:
 * - 민법 제157조 (초일불산입): 기간을 일, 주, 월 또는 연으로 정한 때에는 기간의 초일은 산입하지 아니한다.
 *   단, 그 기간이 오전 영시로부터 시작하는 때에는 그러하지 아니하다.
 * - 민법 제161조 (말일 연장): 기간의 말일이 토요일 또는 공휴일에 해당한 때에는 기간은 그 익일로 만료한다.
 *
 * 계산 방식:
 * - 일반 송달: 기산일 + N일 = 만료일 (초일불산입이 이미 반영된 계산)
 *   예: 4/8 송달 + 14일 = 4/22 (실제로 4/9~4/22 = 14일)
 * - 전자송달 (0시 의제): 기산일 + (N-1)일 = 만료일 (민법 제157조 단서 적용)
 *   예: 4/8 00:00 송달 + 13일 = 4/21 (4/8~4/21 = 14일, 초일산입)
 *
 * @see https://www.law.go.kr (민법 제157조, 제161조)
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
 * 2026년 대한민국 법정 공휴일
 * 출처: 관공서의 공휴일에 관한 규정
 */
export const KOREAN_PUBLIC_HOLIDAYS_2026 = [
  '2026-01-01', // 신정
  '2026-02-16', // 설날 연휴
  '2026-02-17', // 설날
  '2026-02-18', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-03-02', // 대체공휴일 (삼일절이 일요일)
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날
  '2026-05-25', // 대체공휴일 (부처님오신날이 일요일)
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절
  '2026-10-09', // 한글날
  '2026-12-25', // 성탄절
];

/**
 * 모든 공휴일 통합 목록 (2025-2026)
 */
export const KOREAN_PUBLIC_HOLIDAYS_ALL = [
  ...KOREAN_PUBLIC_HOLIDAYS_2025,
  ...KOREAN_PUBLIC_HOLIDAYS_2026,
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
 * Date 객체를 로컬 날짜 문자열 (YYYY-MM-DD)로 변환
 * 타임존 문제 방지를 위해 toISOString() 대신 사용
 */
function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 해당 날짜가 법정 공휴일인지 확인
 * 일요일도 공휴일로 간주 (관공서의 공휴일에 관한 규정 제2조)
 */
export function isPublicHoliday(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_ALL): boolean {
  // 일요일은 항상 공휴일
  if (isSunday(date)) {
    return true;
  }

  // 로컬 날짜 기준으로 비교 (타임존 문제 방지)
  const dateStr = toLocalDateString(date);
  return holidays.includes(dateStr);
}

/**
 * 해당 날짜가 토요일 또는 공휴일(일요일 포함)인지 확인
 * 민법 제161조 적용 대상
 */
export function isNonBusinessDay(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_ALL): boolean {
  return isSaturday(date) || isPublicHoliday(date, holidays);
}

/**
 * 다음 영업일을 찾는 함수
 * 토요일 또는 공휴일이면 익일로 이동
 */
export function getNextBusinessDay(date: Date, holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_ALL): Date {
  const nextDay = new Date(date);

  while (isNonBusinessDay(nextDay, holidays)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }

  return nextDay;
}

/**
 * 법정 기간 계산 (민법 제157조, 제161조 적용)
 *
 * 계산 공식:
 * - 일반 송달: 기산일 + N일 = 만료일 (초일불산입이 반영된 계산)
 * - 전자송달(0시 의제): 기산일 + (N-1)일 = 만료일 (초일산입, 민법 제157조 단서)
 *
 * @param triggerDate 기산일 (송달일/선고일/고지일)
 * @param days 법정 기간 (일수)
 * @param isElectronicService 전자송달 0시 의제 여부 (기본값: false)
 *   - false: 일반 송달 (초일불산입, 기산일 + days)
 *   - true: 전자송달 (초일산입, 기산일 + days - 1)
 * @param holidays 공휴일 목록
 * @returns 만료일 (민법 제161조 적용 후)
 *
 * @example
 * // 민사 항소: 4/8 일반 송달, 14일
 * calculateLegalDeadline(new Date('2025-04-08'), 14, false)
 * // → 2025-04-22
 *
 * @example
 * // 민사 항소: 4/8 전자송달(0시 의제), 14일
 * calculateLegalDeadline(new Date('2025-04-08'), 14, true)
 * // → 2025-04-21 (1일 단축)
 *
 * @example
 * // 말일이 토요일인 경우 (민법 제161조)
 * calculateLegalDeadline(new Date('2025-03-07'), 14, false)
 * // → 2025-03-24 (3/21 토요일 → 3/24 월요일로 연장)
 */
export function calculateLegalDeadline(
  triggerDate: Date,
  days: number,
  isElectronicService: boolean = false,
  holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_ALL
): Date {
  // 1. 기산일 설정
  const startDate = new Date(triggerDate);

  // 2. 기간 계산
  //    - 일반 송달: 기산일 + days (초일불산입이 이미 반영됨)
  //    - 전자송달(0시 의제): 기산일 + (days - 1) (민법 제157조 단서: 초일산입)
  const effectiveDays = isElectronicService ? days - 1 : days;

  let deadline = new Date(startDate);
  deadline.setDate(deadline.getDate() + effectiveDays);

  // 3. 민법 제161조 적용: 말일이 토요일 또는 공휴일이면 익영업일로 연장
  deadline = getNextBusinessDay(deadline, holidays);

  return deadline;
}

/**
 * 법정 기간 계산 (날짜 문자열 반환)
 *
 * @param triggerDateStr 기산일 문자열 (YYYY-MM-DD)
 * @param days 법정 기간 (일수)
 * @param isElectronicService 전자송달 0시 의제 여부 (기본값: false)
 * @param holidays 공휴일 목록
 * @returns 만료일 문자열 (YYYY-MM-DD)
 */
export function calculateLegalDeadlineString(
  triggerDateStr: string,
  days: number,
  isElectronicService: boolean = false,
  holidays: string[] = KOREAN_PUBLIC_HOLIDAYS_ALL
): string {
  const triggerDate = new Date(triggerDateStr + 'T00:00:00');
  const deadline = calculateLegalDeadline(triggerDate, days, isElectronicService, holidays);
  // 로컬 날짜 기준으로 YYYY-MM-DD 반환 (타임존 문제 방지)
  const year = deadline.getFullYear();
  const month = String(deadline.getMonth() + 1).padStart(2, '0');
  const day = String(deadline.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
