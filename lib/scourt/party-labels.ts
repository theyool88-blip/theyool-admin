/**
 * 사건유형별 당사자 라벨 매핑
 *
 * 사건 카테고리에 따라 당사자 명칭이 다름:
 * - 민사/가사소송: 원고/피고
 * - 형사: 피고인
 * - 가사보전 (즈단,즈합): 채권자/채무자
 * - 가사비송/신청 (즈기,느단,느합): 신청인/피신청인
 * - 민사신청/보전 (카*): 신청인/피신청인
 * - 집행 (타*): 채권자/채무자
 * - 보호: 조사관/보호소년
 * - 항고 (너,브): 항고인/상대방
 * - 항소 (나,르): 원고(항소인)/피고(피항소인)
 * - 행정: 원고/피고
 * - 회생/파산 (개회,하단,하면): 신청인/채무자
 * - 전자독촉 (차전): 채권자/채무자
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
  // 민사/가사소송 (기본)
  default: { plaintiff: '원고', defendant: '피고' },

  // 형사 (고단, 고합, 노, 도 등)
  criminal: { plaintiff: '', defendant: '피고인' },

  // 가사보전 (즈단, 즈합) - 채권자/채무자
  familyPreservation: { plaintiff: '채권자', defendant: '채무자' },

  // 가사비송/신청 (즈기, 느단, 느합) - 신청인/피신청인
  familyNonlitigation: { plaintiff: '신청인', defendant: '피신청인' },

  // 민사신청/보전 (카단, 카합 등)
  application: { plaintiff: '신청인', defendant: '피신청인' },

  // 집행 (타기, 타채, 타경)
  execution: { plaintiff: '채권자', defendant: '채무자' },

  // 가정보호 (동버) - 아동복지법위반 사건
  familyProtection: { plaintiff: '행위자', defendant: '피해아동' },

  // 소년보호 (푸)
  juvenileProtection: { plaintiff: '조사관', defendant: '보호소년' },

  // 항고 (너, 브, 스, 마)
  appeal: { plaintiff: '항고인', defendant: '상대방' },

  // 회생/파산 (개회, 하단, 하면)
  insolvency: { plaintiff: '신청인', defendant: '채무자' },

  // 전자독촉 (차전)
  electronicOrder: { plaintiff: '채권자', defendant: '채무자' },
};

/**
 * 형사 사건유형 패턴
 */
const CRIMINAL_PATTERNS = [
  '고단', '고합', '고약', '고정', '고약전',
  '노', '도', '로', '모',
  '오', '조', '초', '코', '토',
  '감고', '감노', '감도', '감로', '감모',
  '전고', '전노', '전도', '전로', '전모',
  '치고', '치노', '치도', '치로', '치모',
  '보고', '보노', '보도', '보로', '보모',
  '초재', // 형사재심
];

/**
 * 가사보전 사건유형 패턴 (채권자/채무자)
 */
const FAMILY_PRESERVATION_PATTERNS = [
  '즈단', '즈합',
];

/**
 * 가사비송/신청 사건유형 패턴 (신청인/피신청인)
 */
const FAMILY_NONLITIGATION_PATTERNS = [
  '즈기',           // 가사신청 기타
  '느단', '느합',   // 가사비송
  '후기', '후개',   // 후견
];

/**
 * 항고 사건유형 패턴 (항고인/상대방)
 */
const APPEAL_PATTERNS = [
  '너',   // 가사비송 항고
  '브',   // 가사후견 항고
  '스',   // 특별항고
  '마',   // 민사재항고
  '그',   // 민사항고
];

/**
 * 민사신청/보전 사건유형 패턴 (신청인/피신청인)
 */
const APPLICATION_PATTERNS = [
  '카단', '카합', '카기', '카공', '카담',
  '카명', '카조', '카구', '카불', '카확', '카열',
  '카임', '카정', '카경', '카소',
  '아',   // 행정신청
];

/**
 * 집행 사건유형 패턴 (채권자/채무자)
 */
const EXECUTION_PATTERNS = [
  '타기', '타채', '타경', '타인', '타배',
];

/**
 * 가정보호 사건유형 패턴 (행위자/피해아동) - 아동복지법위반
 */
const FAMILY_PROTECTION_PATTERNS = [
  '동버', '동서', '동어', '동저',  // 가정보호 (아동학대)
  '버', '서', '어', '저',          // 보호 항고
  '동처', '동커', '동터',          // 가정보호 재항고
  '처', '커', '터',                // 재항고
];

/**
 * 소년보호 사건유형 패턴 (조사관/보호소년)
 */
const JUVENILE_PROTECTION_PATTERNS = [
  '푸',                            // 소년보호
  '인', '인라', '인마', '인카',    // 소년보호 관련
  '성', '성로', '성모', '성초',    // 성폭력 관련
];

/**
 * 회생/파산 사건유형 패턴 (신청인/채무자)
 */
const INSOLVENCY_PATTERNS = [
  '개회', '개확',     // 개인회생
  '하단', '하면', '하기', '하합', '하확',   // 파산/면책
  '회단', '회합', '회확',   // 법인회생
  '간회단', '간회합',       // 간이회생
];

/**
 * 전자독촉 사건유형 패턴 (채권자/채무자)
 */
const ELECTRONIC_ORDER_PATTERNS = [
  '차전', '차',   // 전자지급명령
  '자',          // 지급명령
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

  // 형사 (피고인)
  if (matchesPattern(caseType, CRIMINAL_PATTERNS)) {
    return { ...PARTY_LABELS.criminal, isCriminal: true };
  }

  // 항고 (항고인/상대방) - 다른 패턴보다 먼저 체크
  if (matchesPattern(caseType, APPEAL_PATTERNS)) {
    return { ...PARTY_LABELS.appeal, isCriminal: false };
  }

  // 가사보전 (채권자/채무자) - 즈단, 즈합
  if (matchesPattern(caseType, FAMILY_PRESERVATION_PATTERNS)) {
    return { ...PARTY_LABELS.familyPreservation, isCriminal: false };
  }

  // 가사비송/신청 (신청인/피신청인) - 즈기, 느단, 느합
  if (matchesPattern(caseType, FAMILY_NONLITIGATION_PATTERNS)) {
    return { ...PARTY_LABELS.familyNonlitigation, isCriminal: false };
  }

  // 민사신청/보전 (신청인/피신청인)
  if (matchesPattern(caseType, APPLICATION_PATTERNS)) {
    return { ...PARTY_LABELS.application, isCriminal: false };
  }

  // 회생/파산 (신청인/채무자)
  if (matchesPattern(caseType, INSOLVENCY_PATTERNS)) {
    return { ...PARTY_LABELS.insolvency, isCriminal: false };
  }

  // 전자독촉 (채권자/채무자)
  if (matchesPattern(caseType, ELECTRONIC_ORDER_PATTERNS)) {
    return { ...PARTY_LABELS.electronicOrder, isCriminal: false };
  }

  // 집행 (채권자/채무자)
  if (matchesPattern(caseType, EXECUTION_PATTERNS)) {
    return { ...PARTY_LABELS.execution, isCriminal: false };
  }

  // 가정보호 (행위자/피해아동)
  if (matchesPattern(caseType, FAMILY_PROTECTION_PATTERNS)) {
    return { ...PARTY_LABELS.familyProtection, isCriminal: false };
  }

  // 소년보호 (조사관/보호소년)
  if (matchesPattern(caseType, JUVENILE_PROTECTION_PATTERNS)) {
    return { ...PARTY_LABELS.juvenileProtection, isCriminal: false };
  }

  // 기본 (민사, 가사소송)
  return { ...PARTY_LABELS.default, isCriminal: false };
}

/**
 * 사건 카테고리 조회
 */
export function getCaseCategory(caseTypeOrNumber: string): string {
  const caseType = extractCaseType(caseTypeOrNumber);

  if (matchesPattern(caseType, CRIMINAL_PATTERNS)) return '형사';
  if (matchesPattern(caseType, APPEAL_PATTERNS)) return '항고';
  if (matchesPattern(caseType, FAMILY_PRESERVATION_PATTERNS)) return '가사보전';
  if (matchesPattern(caseType, FAMILY_NONLITIGATION_PATTERNS)) return '가사비송';
  if (matchesPattern(caseType, APPLICATION_PATTERNS)) return '신청';
  if (matchesPattern(caseType, INSOLVENCY_PATTERNS)) return '회생/파산';
  if (matchesPattern(caseType, ELECTRONIC_ORDER_PATTERNS)) return '독촉';
  if (matchesPattern(caseType, EXECUTION_PATTERNS)) return '집행';
  if (matchesPattern(caseType, FAMILY_PROTECTION_PATTERNS)) return '가정보호';
  if (matchesPattern(caseType, JUVENILE_PROTECTION_PATTERNS)) return '소년보호';

  // 행정 구분
  if (['구', '누', '두', '아'].some(c => caseType.startsWith(c))) {
    return '행정';
  }

  // 가사소송/비송 구분
  if (['드', '르', '므'].some(c => caseType.startsWith(c))) {
    return '가사소송';
  }

  return '민사';
}
