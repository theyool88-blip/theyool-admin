/**
 * 사건유형별 당사자 라벨 매핑
 *
 * 사건 카테고리에 따라 당사자 명칭이 다름:
 * - 민사/가사: 원고/피고
 * - 형사: 피고인
 * - 가사신청: 채권자/채무자
 * - 민사신청: 신청인/피신청인
 * - 집행: 채권자/채무자
 * - 보호: 조사관/보호소년
 */

export interface PartyLabels {
  plaintiff: string;
  defendant: string;
}

export interface PartyLabelsWithType extends PartyLabels {
  isCriminal: boolean;
}

/**
 * 카테고리별 당사자 라벨 정의
 */
export const PARTY_LABELS: Record<string, PartyLabels> = {
  // 민사/가사 (기본)
  default: { plaintiff: '원고', defendant: '피고' },

  // 형사 (고단, 고합, 고약, 노, 도 등)
  criminal: { plaintiff: '', defendant: '피고인' },

  // 가사신청 (즈단, 즈합)
  familyApplication: { plaintiff: '채권자', defendant: '채무자' },

  // 민사신청 (카단, 카합)
  application: { plaintiff: '신청인', defendant: '피신청인' },

  // 집행 (타기, 타채, 타경)
  execution: { plaintiff: '채권자', defendant: '채무자' },

  // 보호 (푸, 동버)
  protection: { plaintiff: '조사관', defendant: '보호소년' },
};

/**
 * 형사 사건유형 패턴
 */
const CRIMINAL_PATTERNS = [
  '고단', '고합', '고약', '고정', '고약전',
  '노', '도', '로', '모', '보',
  '오', '조', '초', '코', '토',
  '감고', '감노', '감도', '감로', '감모',
  '전고', '전노', '전도', '전로', '전모',
  '치고', '치노', '치도', '치로', '치모',
  '보고', '보노', '보도', '보로', '보모',
];

/**
 * 가사신청 사건유형 패턴
 */
const FAMILY_APPLICATION_PATTERNS = [
  '즈단', '즈합', '즈기',
];

/**
 * 민사신청 사건유형 패턴
 */
const APPLICATION_PATTERNS = [
  '카단', '카합', '카기', '카공', '카담',
  '카명', '카조', '카구', '카불', '카확', '카열',
  '카임', '카정', '카경', '카소',
];

/**
 * 집행 사건유형 패턴
 */
const EXECUTION_PATTERNS = [
  '타기', '타채', '타경', '타', '타인', '타배',
];

/**
 * 보호 사건유형 패턴
 */
const PROTECTION_PATTERNS = [
  '푸', '동버', '동서', '동어', '동저',
  '버', '서', '어', '저',
  '처', '커', '터',
  '동처', '동커', '동터',
  '인', '인라', '인마', '인카',
  '성', '성로', '성모', '성초',
];

/**
 * 사건번호 또는 사건유형에서 유형 코드 추출
 * 예: "2024드단12345" → "드단"
 * 예: "드단" → "드단"
 */
function extractCaseType(input: string): string {
  if (!input) return '';

  // 이미 사건유형 코드인 경우 그대로 반환
  if (!/\d/.test(input.slice(0, 4))) {
    return input;
  }

  // 사건번호에서 유형 추출 (예: 2024드단12345 → 드단)
  const match = input.match(/\d{4}([가-힣]+)\d+/);
  return match ? match[1] : input;
}

/**
 * 패턴 목록에서 매칭 확인
 */
function matchesPattern(caseType: string, patterns: string[]): boolean {
  return patterns.some(pattern => caseType.includes(pattern));
}

/**
 * 사건유형/사건번호로 당사자 라벨 조회
 *
 * @param caseTypeOrNumber - 사건유형 코드 (예: "드단") 또는 사건번호 (예: "2024드단12345")
 * @returns 당사자 라벨 및 형사사건 여부
 */
export function getPartyLabels(caseTypeOrNumber: string): PartyLabelsWithType {
  const caseType = extractCaseType(caseTypeOrNumber);

  // 형사
  if (matchesPattern(caseType, CRIMINAL_PATTERNS)) {
    return { ...PARTY_LABELS.criminal, isCriminal: true };
  }

  // 가사신청
  if (matchesPattern(caseType, FAMILY_APPLICATION_PATTERNS)) {
    return { ...PARTY_LABELS.familyApplication, isCriminal: false };
  }

  // 민사신청
  if (matchesPattern(caseType, APPLICATION_PATTERNS)) {
    return { ...PARTY_LABELS.application, isCriminal: false };
  }

  // 집행
  if (matchesPattern(caseType, EXECUTION_PATTERNS)) {
    return { ...PARTY_LABELS.execution, isCriminal: false };
  }

  // 보호
  if (matchesPattern(caseType, PROTECTION_PATTERNS)) {
    return { ...PARTY_LABELS.protection, isCriminal: false };
  }

  // 기본 (민사, 가사)
  return { ...PARTY_LABELS.default, isCriminal: false };
}

/**
 * 사건 카테고리 조회
 */
export function getCaseCategory(caseTypeOrNumber: string): string {
  const caseType = extractCaseType(caseTypeOrNumber);

  if (matchesPattern(caseType, CRIMINAL_PATTERNS)) return '형사';
  if (matchesPattern(caseType, FAMILY_APPLICATION_PATTERNS)) return '가사신청';
  if (matchesPattern(caseType, APPLICATION_PATTERNS)) return '신청';
  if (matchesPattern(caseType, EXECUTION_PATTERNS)) return '집행';
  if (matchesPattern(caseType, PROTECTION_PATTERNS)) return '보호';

  // 가사/민사 구분
  if (['드', '느', '르', '므', '브', '스', '즈', '너', '츠', '으'].some(c => caseType.startsWith(c))) {
    return '가사';
  }

  return '민사';
}
