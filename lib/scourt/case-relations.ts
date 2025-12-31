/**
 * 사건 관계 분석 및 연결 시스템
 *
 * 심급별 관계 (상소심):
 * - 1심 → 항소심 (2심) → 상고심 (3심)
 * - 재항고, 특별항고, 재심, 준재심
 *
 * 관련사건 관계:
 * - 본안 → 보전처분 (가압류, 가처분)
 * - 본안 → 집행 (채권압류, 경매)
 * - 가사본안 → 사전처분
 * - 신청 → 항고 → 재항고
 */

import { getCaseTypeByCode, CaseCategory, CaseLevel } from './case-types';

// ============================================================
// 타입 정의
// ============================================================

export type CaseRelationType =
  | 'appeal'           // 상소 관계 (1심→항소심→상고심)
  | 'provisional'      // 보전처분 관계 (본안→가압류/가처분)
  | 'execution'        // 집행 관계 (본안→압류/경매)
  | 'preliminary'      // 사전처분 관계 (가사본안→사전처분)
  | 'retrial'          // 재심 관계
  | 'related'          // 기타 관련사건
  | 'same_party';      // 동일 당사자 사건

export interface CaseRelation {
  type: CaseRelationType;
  direction: 'parent' | 'child' | 'sibling';
  description: string;
}

export interface ParsedCaseNumber {
  court: string;        // 법원명 (예: 서울중앙지방법원)
  year: string;         // 연도 (예: 2024)
  caseType: string;     // 사건유형 (예: 가단, 드단)
  serial: string;       // 일련번호 (예: 123456)
  fullNumber: string;   // 전체 사건번호
}

// ============================================================
// 심급 관계 매핑 (Appeal Chain)
// ============================================================

/**
 * 사건유형별 상소 체계
 * 1심 코드 → { 항소심: 코드, 상고심: 코드 }
 */
export const APPEAL_CHAIN: Record<string, { appeal?: string; supreme?: string }> = {
  // 민사
  '가단': { appeal: '나', supreme: '다' },
  '가합': { appeal: '나', supreme: '다' },
  '가소': { appeal: '나', supreme: '다' },
  '나': { supreme: '다' },

  // 가사
  '드단': { appeal: '느단', supreme: '므' },
  '드합': { appeal: '느합', supreme: '므' },
  '드': { appeal: '느', supreme: '므' },
  '느단': { supreme: '므' },
  '느합': { supreme: '므' },

  // 형사
  '고단': { appeal: '노', supreme: '도' },
  '고합': { appeal: '노', supreme: '도' },
  '고약': { appeal: '노', supreme: '도' },
  '고정': { appeal: '노', supreme: '도' },
  '노': { supreme: '도' },

  // 행정
  '구단': { appeal: '누', supreme: '두' },
  '구합': { appeal: '누', supreme: '두' },
  '구': { appeal: '누', supreme: '두' },
  '누': { supreme: '두' },

  // 비송/항고
  '루': { appeal: '라' },
  '르': { appeal: '즈단', supreme: '스' },
  '즈단': { supreme: '스' },
  '즈합': { supreme: '스' },
};

/**
 * 항고 체계 (신청 → 항고 → 재항고/특별항고)
 */
export const COMPLAINT_CHAIN: Record<string, { complaint?: string; reComplaint?: string; special?: string }> = {
  // 민사 신청
  '머': { complaint: '바', reComplaint: '마', special: '라' },  // 조정
  '루': { complaint: '바', reComplaint: '마', special: '라' },  // 비송
  '바': { reComplaint: '마', special: '라' },

  // 가사 신청
  '브': { complaint: '즈단', reComplaint: '스', special: '스' },  // 사전처분
  '조': { complaint: '즈단', reComplaint: '스' },  // 가사조정
  '즈단': { reComplaint: '스' },
  '즈합': { reComplaint: '스' },

  // 형사
  '초': { complaint: '오', reComplaint: '모', special: '로' },
  '오': { reComplaint: '모', special: '로' },

  // 보전처분
  '카단': { complaint: '커', reComplaint: '크' },
  '카합': { complaint: '커', reComplaint: '크' },
  '커': { reComplaint: '크' },

  // 집행
  '타채': { complaint: '터', reComplaint: '트' },
  '터': { reComplaint: '트' },
};

// ============================================================
// 관련사건 매핑 (Related Cases)
// ============================================================

/**
 * 본안 → 보전처분/집행 관계
 * 본안 사건유형 → 가능한 관련 사건유형 배열
 */
export const RELATED_CASE_TYPES: Record<string, string[]> = {
  // 민사 본안 → 보전/집행
  '가단': ['카단', '카합', '타채', '카경'],
  '가합': ['카단', '카합', '타채', '카경'],
  '가소': ['카단', '타채', '차전'],

  // 가사 본안 → 사전처분/보전
  '드단': ['브', '카단'],
  '드합': ['브', '카합'],
  '느단': ['브'],
  '느합': ['브'],

  // 지급명령 → 본안
  '차': ['가단', '가소'],
  '차전': ['가단', '가소'],
};

// ============================================================
// 사건번호 파싱
// ============================================================

/**
 * 사건번호 파싱
 * 예: "서울중앙지방법원 2024가단123456" → ParsedCaseNumber
 * 예: "2024가단123456" → ParsedCaseNumber (법원 없이)
 */
export function parseCaseNumber(caseNumber: string): ParsedCaseNumber | null {
  // 공백 및 특수문자 정리
  const cleaned = caseNumber.replace(/\s+/g, ' ').trim();

  // 패턴 1: 법원명 + 연도 + 사건유형 + 일련번호
  // 예: "서울중앙지방법원 2024가단123456"
  const pattern1 = /^(.+?)\s*(\d{4})([가-힣]+)(\d+)$/;
  const match1 = cleaned.match(pattern1);

  if (match1) {
    return {
      court: match1[1].trim(),
      year: match1[2],
      caseType: match1[3],
      serial: match1[4],
      fullNumber: cleaned,
    };
  }

  // 패턴 2: 연도 + 사건유형 + 일련번호 (법원 없음)
  // 예: "2024가단123456"
  const pattern2 = /^(\d{4})([가-힣]+)(\d+)$/;
  const match2 = cleaned.match(pattern2);

  if (match2) {
    return {
      court: '',
      year: match2[1],
      caseType: match2[2],
      serial: match2[3],
      fullNumber: cleaned,
    };
  }

  return null;
}

/**
 * 사건번호 생성
 */
export function buildCaseNumber(parsed: ParsedCaseNumber): string {
  if (parsed.court) {
    return `${parsed.court} ${parsed.year}${parsed.caseType}${parsed.serial}`;
  }
  return `${parsed.year}${parsed.caseType}${parsed.serial}`;
}

// ============================================================
// 관계 분석 함수
// ============================================================

/**
 * 두 사건 간 관계 분석
 */
export function analyzeRelation(
  caseNumber1: string,
  caseNumber2: string
): CaseRelation | null {
  const parsed1 = parseCaseNumber(caseNumber1);
  const parsed2 = parseCaseNumber(caseNumber2);

  if (!parsed1 || !parsed2) return null;

  // 동일 사건
  if (parsed1.year === parsed2.year &&
      parsed1.caseType === parsed2.caseType &&
      parsed1.serial === parsed2.serial) {
    return null;
  }

  // 1. 상소 관계 확인
  const appealRelation = checkAppealRelation(parsed1, parsed2);
  if (appealRelation) return appealRelation;

  // 2. 항고 관계 확인
  const complaintRelation = checkComplaintRelation(parsed1, parsed2);
  if (complaintRelation) return complaintRelation;

  // 3. 보전/집행 관련사건 확인
  const relatedRelation = checkRelatedRelation(parsed1, parsed2);
  if (relatedRelation) return relatedRelation;

  // 4. 재심 관계 확인
  const retrialRelation = checkRetrialRelation(parsed1, parsed2);
  if (retrialRelation) return retrialRelation;

  return null;
}

/**
 * 상소 관계 확인 (1심 → 항소심 → 상고심)
 */
function checkAppealRelation(
  parsed1: ParsedCaseNumber,
  parsed2: ParsedCaseNumber
): CaseRelation | null {
  const chain1 = APPEAL_CHAIN[parsed1.caseType];
  const chain2 = APPEAL_CHAIN[parsed2.caseType];

  // case1이 1심, case2가 항소심
  if (chain1?.appeal === parsed2.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',  // case1이 parent (1심)
      description: `${parsed1.caseType}(1심) → ${parsed2.caseType}(항소심)`
    };
  }

  // case1이 항소심, case2가 1심
  if (chain2?.appeal === parsed1.caseType) {
    return {
      type: 'appeal',
      direction: 'child',  // case1이 child (항소심)
      description: `${parsed2.caseType}(1심) → ${parsed1.caseType}(항소심)`
    };
  }

  // case1이 1심, case2가 상고심
  if (chain1?.supreme === parsed2.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',
      description: `${parsed1.caseType}(1심) → ${parsed2.caseType}(상고심)`
    };
  }

  // case1이 항소심, case2가 상고심
  if (chain1 && chain2?.supreme === parsed1.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',
      description: `${parsed1.caseType}(항소심) → ${parsed2.caseType}(상고심)`
    };
  }

  return null;
}

/**
 * 항고 관계 확인 (신청 → 항고 → 재항고)
 */
function checkComplaintRelation(
  parsed1: ParsedCaseNumber,
  parsed2: ParsedCaseNumber
): CaseRelation | null {
  const chain1 = COMPLAINT_CHAIN[parsed1.caseType];

  // case1이 원심, case2가 항고
  if (chain1?.complaint === parsed2.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',
      description: `${parsed1.caseType}(원심) → ${parsed2.caseType}(항고)`
    };
  }

  // case1이 원심, case2가 재항고
  if (chain1?.reComplaint === parsed2.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',
      description: `${parsed1.caseType}(원심) → ${parsed2.caseType}(재항고)`
    };
  }

  // case1이 원심, case2가 특별항고
  if (chain1?.special === parsed2.caseType) {
    return {
      type: 'appeal',
      direction: 'parent',
      description: `${parsed1.caseType}(원심) → ${parsed2.caseType}(특별항고)`
    };
  }

  return null;
}

/**
 * 관련사건 관계 확인 (본안 → 보전/집행)
 */
function checkRelatedRelation(
  parsed1: ParsedCaseNumber,
  parsed2: ParsedCaseNumber
): CaseRelation | null {
  const related1 = RELATED_CASE_TYPES[parsed1.caseType];

  // case1이 본안, case2가 관련사건 (보전/집행)
  if (related1?.includes(parsed2.caseType)) {
    // 보전처분 판단
    if (['카단', '카합', '카기', '브'].includes(parsed2.caseType)) {
      return {
        type: 'provisional',
        direction: 'parent',
        description: `본안(${parsed1.caseType}) → 보전/사전처분(${parsed2.caseType})`
      };
    }

    // 집행 판단
    if (['타채', '카경', '차', '차전'].includes(parsed2.caseType)) {
      return {
        type: 'execution',
        direction: 'parent',
        description: `본안(${parsed1.caseType}) → 집행(${parsed2.caseType})`
      };
    }

    return {
      type: 'related',
      direction: 'parent',
      description: `본안(${parsed1.caseType}) → 관련(${parsed2.caseType})`
    };
  }

  // 역방향: case2가 본안, case1이 관련사건
  const related2 = RELATED_CASE_TYPES[parsed2.caseType];
  if (related2?.includes(parsed1.caseType)) {
    if (['카단', '카합', '카기', '브'].includes(parsed1.caseType)) {
      return {
        type: 'provisional',
        direction: 'child',
        description: `보전/사전처분(${parsed1.caseType}) ← 본안(${parsed2.caseType})`
      };
    }

    if (['타채', '카경', '차', '차전'].includes(parsed1.caseType)) {
      return {
        type: 'execution',
        direction: 'child',
        description: `집행(${parsed1.caseType}) ← 본안(${parsed2.caseType})`
      };
    }

    return {
      type: 'related',
      direction: 'child',
      description: `관련(${parsed1.caseType}) ← 본안(${parsed2.caseType})`
    };
  }

  return null;
}

/**
 * 재심 관계 확인
 */
function checkRetrialRelation(
  parsed1: ParsedCaseNumber,
  parsed2: ParsedCaseNumber
): CaseRelation | null {
  // 재심 코드는 '재' 접두사로 시작
  if (parsed1.caseType.startsWith('재') && !parsed2.caseType.startsWith('재')) {
    const originalType = parsed1.caseType.substring(1);
    if (originalType === parsed2.caseType || parsed2.caseType.includes(originalType)) {
      return {
        type: 'retrial',
        direction: 'child',
        description: `재심(${parsed1.caseType}) ← 원심(${parsed2.caseType})`
      };
    }
  }

  if (parsed2.caseType.startsWith('재') && !parsed1.caseType.startsWith('재')) {
    const originalType = parsed2.caseType.substring(1);
    if (originalType === parsed1.caseType || parsed1.caseType.includes(originalType)) {
      return {
        type: 'retrial',
        direction: 'parent',
        description: `원심(${parsed1.caseType}) → 재심(${parsed2.caseType})`
      };
    }
  }

  // 준재심도 동일하게 처리
  if (parsed1.caseType.startsWith('준재')) {
    const originalType = parsed1.caseType.substring(2);
    if (originalType === parsed2.caseType) {
      return {
        type: 'retrial',
        direction: 'child',
        description: `준재심(${parsed1.caseType}) ← 원심(${parsed2.caseType})`
      };
    }
  }

  return null;
}

// ============================================================
// 관련사건 자동 검색
// ============================================================

/**
 * 잠재적 관련사건 유형 목록 반환
 * 특정 사건에 대해 검색해볼 관련 사건유형 반환
 */
export function getPotentialRelatedTypes(caseType: string): {
  appealTypes: string[];
  relatedTypes: string[];
  retrialTypes: string[];
} {
  const result = {
    appealTypes: [] as string[],
    relatedTypes: [] as string[],
    retrialTypes: [] as string[],
  };

  // 상소심 유형
  const appealChain = APPEAL_CHAIN[caseType];
  if (appealChain) {
    if (appealChain.appeal) result.appealTypes.push(appealChain.appeal);
    if (appealChain.supreme) result.appealTypes.push(appealChain.supreme);
  }

  // 역방향 상소심 (이 유형이 상소심인 경우 원심 찾기)
  for (const [originalType, chain] of Object.entries(APPEAL_CHAIN)) {
    if (chain.appeal === caseType || chain.supreme === caseType) {
      result.appealTypes.push(originalType);
    }
  }

  // 항고 관계
  const complaintChain = COMPLAINT_CHAIN[caseType];
  if (complaintChain) {
    if (complaintChain.complaint) result.appealTypes.push(complaintChain.complaint);
    if (complaintChain.reComplaint) result.appealTypes.push(complaintChain.reComplaint);
    if (complaintChain.special) result.appealTypes.push(complaintChain.special);
  }

  // 관련사건 유형
  const related = RELATED_CASE_TYPES[caseType];
  if (related) {
    result.relatedTypes.push(...related);
  }

  // 역방향 관련사건
  for (const [mainType, relTypes] of Object.entries(RELATED_CASE_TYPES)) {
    if (relTypes.includes(caseType)) {
      result.relatedTypes.push(mainType);
    }
  }

  // 재심 유형
  if (!caseType.startsWith('재') && !caseType.startsWith('준재')) {
    result.retrialTypes.push(`재${caseType}`);
    result.retrialTypes.push(`준재${caseType}`);
  } else if (caseType.startsWith('재')) {
    result.retrialTypes.push(caseType.substring(1));
  } else if (caseType.startsWith('준재')) {
    result.retrialTypes.push(caseType.substring(2));
  }

  // 중복 제거
  result.appealTypes = [...new Set(result.appealTypes)];
  result.relatedTypes = [...new Set(result.relatedTypes)];
  result.retrialTypes = [...new Set(result.retrialTypes)];

  return result;
}

/**
 * 사건번호 목록에서 관련사건 자동 감지
 * 같은 당사자, 같은 법원, 유사 시기의 사건들 중 관계가 있는 것 찾기
 */
export function findRelatedCases(
  targetCaseNumber: string,
  allCaseNumbers: string[]
): Array<{ caseNumber: string; relation: CaseRelation }> {
  const results: Array<{ caseNumber: string; relation: CaseRelation }> = [];
  const targetParsed = parseCaseNumber(targetCaseNumber);

  if (!targetParsed) return results;

  for (const caseNumber of allCaseNumbers) {
    if (caseNumber === targetCaseNumber) continue;

    const relation = analyzeRelation(targetCaseNumber, caseNumber);
    if (relation) {
      results.push({ caseNumber, relation });
    }
  }

  return results;
}

// ============================================================
// 심급 레벨 판단
// ============================================================

/**
 * 사건의 심급 레벨 반환
 */
export function getCaseLevel(caseType: string): {
  level: 1 | 2 | 3 | 'special';
  description: string;
} {
  const caseInfo = getCaseTypeByCode(caseType);
  if (!caseInfo) {
    return { level: 1, description: '알 수 없음' };
  }

  switch (caseInfo.level) {
    case '1심':
      return { level: 1, description: '1심' };
    case '항소심':
      return { level: 2, description: '항소심 (2심)' };
    case '상고심':
      return { level: 3, description: '상고심 (3심)' };
    case '재항고':
    case '특별항고':
      return { level: 'special', description: caseInfo.level };
    case '재심':
    case '준재심':
      return { level: 'special', description: caseInfo.level };
    default:
      return { level: 1, description: caseInfo.level };
  }
}

// ============================================================
// 당사자 표시 변환
// ============================================================

/**
 * 심급에 따른 당사자 명칭 변환
 * 예: 원고 → 항소인 → 상고인
 */
export function convertPartyLabel(
  originalLabel: string,
  fromCaseType: string,
  toCaseType: string
): string {
  const from = getCaseTypeByCode(fromCaseType);
  const to = getCaseTypeByCode(toCaseType);

  if (!from?.partyLabels || !to?.partyLabels) {
    return originalLabel;
  }

  // 원고/피고 → 항소인/피항소인 변환
  if (originalLabel === from.partyLabels.plaintiff) {
    return to.partyLabels.plaintiff;
  }
  if (originalLabel === from.partyLabels.defendant) {
    return to.partyLabels.defendant;
  }

  return originalLabel;
}

// ============================================================
// 통계/디버그용
// ============================================================

export const CASE_RELATION_STATS = {
  appealChainCount: Object.keys(APPEAL_CHAIN).length,
  complaintChainCount: Object.keys(COMPLAINT_CHAIN).length,
  relatedTypesCount: Object.keys(RELATED_CASE_TYPES).length,
};
