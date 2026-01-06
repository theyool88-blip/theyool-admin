/**
 * SCOURT 필드 렌더링 유틸리티
 *
 * - 필드 키 → 한글 라벨 매핑
 * - 값이 있는 필드만 동적으로 필터링
 * - 날짜 포맷팅
 */

/**
 * SCOURT 스크래퍼 필드 키 → 한글 라벨 매핑
 * progress-scraper.ts에서 저장하는 형식 기준
 */
export const FIELD_LABELS: Record<string, string> = {
  // 기본 정보
  법원: '법원',
  사건번호: '사건번호',
  사건명: '사건명',
  재판부: '재판부',
  접수일: '접수일',
  심급: '심급',
  재판부전화번호: '재판부전화번호',

  // 당사자
  원고: '원고',
  피고: '피고',
  채권자: '채권자',
  채무자: '채무자',
  신청인: '신청인',
  피신청인: '피신청인',
  피고인명: '피고인명',

  // 결과/상태
  종국결과: '종국결과',
  확정일: '확정일',
  보존여부: '보존여부',
  폐기여부: '폐기여부',

  // 금액
  인지액: '인지액',
  청구금액: '청구금액',
  담보내용: '담보내용',
  해제내용: '해제내용',

  // 상소
  상소인: '상소인',
  상소일: '상소일',
  판결도달일: '판결도달일',

  // 구분
  병합구분: '병합구분',
  수리구분: '수리구분',
  형제사건번호: '형제사건번호',
  비고: '비고',
};

/**
 * LIST 타입 필드 라벨 매핑
 * progress-scraper.ts에서 저장하는 형식 기준
 */
export const LIST_FIELD_LABELS: Record<string, string> = {
  parties: '당사자',
  representatives: '대리인',
  hearings: '기일',
  progress: '진행내용',
  documents: '제출서류',
  lowerCourt: '하심사건',
  relatedCases: '관련사건',
};

/**
 * LIST 아이템 내부 필드 라벨
 */
export const LIST_ITEM_LABELS: Record<string, string> = {
  // 공통
  구분: '구분',
  일자: '일자',
  시간: '시간',
  내용: '내용',
  결과: '결과',
  장소: '장소',
  이름: '이름',
  법원명: '법원명',
  사건번호: '사건번호',
  사건명: '사건명',
  상태: '상태',
};

/**
 * 표시하지 않을 내부 필드 (메타데이터 등)
 */
const EXCLUDED_FIELDS = new Set([
  'caseCategory',
  'caseType',
  'id',
  'legal_case_id',
  'scraped_at',
  'created_at',
  'updated_at',
]);

export interface VisibleField {
  key: string;
  label: string;
  value: any;
  isDate?: boolean;
}

export interface ListField {
  key: string;
  label: string;
  items: any[];
}

/**
 * 값이 유효한지 확인 (null, undefined, 빈 문자열, '-' 제외)
 */
function isValidValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed !== '-';
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * 날짜 필드인지 확인
 */
function isDateField(key: string): boolean {
  const datePatterns = ['Date', 'date', '일', 'Dt'];
  return datePatterns.some(pattern => key.includes(pattern));
}

/**
 * YYYYMMDD 형식 날짜를 YY.MM.DD로 변환
 */
export function formatDateValue(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // YYYYMMDD 형식
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
  }

  // YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
  }

  // YYYY.MM.DD 형식
  if (/^\d{4}\.\d{2}\.\d{2}/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
  }

  return value;
}

/**
 * 값이 있는 기본 필드만 추출
 *
 * @param data - basicInfo 객체
 * @returns 표시할 필드 배열
 */
export function getVisibleFields(data: Record<string, any>): VisibleField[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, value]) => {
      // 제외 필드
      if (EXCLUDED_FIELDS.has(key)) return false;
      // LIST 타입은 별도 처리
      if (key.endsWith('List') || Array.isArray(value)) return false;
      // 객체는 별도 처리 (parties, representatives 등)
      if (typeof value === 'object' && value !== null) return false;
      // 유효한 값만
      return isValidValue(value);
    })
    .map(([key, value]) => {
      const isDate = isDateField(key);
      return {
        key,
        label: FIELD_LABELS[key] || key,
        value: isDate ? formatDateValue(String(value)) : value,
        isDate,
      };
    });
}

/**
 * LIST 타입 필드 추출
 *
 * @param data - basicInfo 객체
 * @returns LIST 필드 배열
 */
export function getListFields(data: Record<string, any>): ListField[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, value]) => {
      // LIST 타입이거나 배열인 경우
      return (key.endsWith('List') || Array.isArray(value)) &&
             Array.isArray(value) &&
             value.length > 0;
    })
    .map(([key, items]) => ({
      key,
      label: LIST_FIELD_LABELS[key] || key,
      items: items as any[],
    }));
}

/**
 * LIST 아이템 필드 라벨 조회
 */
export function getListItemLabel(key: string): string {
  return LIST_ITEM_LABELS[key] || FIELD_LABELS[key] || key;
}

/**
 * 필드 정렬 순서 (우선순위 높은 순)
 */
const FIELD_ORDER = [
  '법원',
  '사건번호',
  '사건명',
  '심급',
  '재판부',
  '재판부전화번호',
  '원고',
  '피고',
  '채권자',
  '채무자',
  '신청인',
  '피신청인',
  '종국결과',
  '접수일',
  '확정일',
];

/**
 * 필드를 우선순위에 따라 정렬
 */
export function sortFields(fields: VisibleField[]): VisibleField[] {
  return [...fields].sort((a, b) => {
    const aIndex = FIELD_ORDER.indexOf(a.key);
    const bIndex = FIELD_ORDER.indexOf(b.key);

    // 둘 다 우선순위 목록에 있으면 순서대로
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // 하나만 있으면 그것이 우선
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // 둘 다 없으면 알파벳 순
    return a.key.localeCompare(b.key);
  });
}
