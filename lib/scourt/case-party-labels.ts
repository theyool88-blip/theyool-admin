/**
 * 사건종류별 당사자 라벨 매핑
 *
 * 사건유형에 따라 원고/피고 대신 다양한 명칭이 사용됨:
 * - 민사: 원고/피고
 * - 가사: 원고/피고, 청구인/상대방
 * - 형사: 피고인명
 * - 신청/보전: 신청인/피신청인, 채권자/채무자
 * - 집행: 채권자/채무자
 * - 회생/파산: 신청인/채무자, 채권자
 *
 * 제공필드.csv 기반 70개 사건종류 매핑
 */

export interface PartyLabels {
  plaintiff: string;    // 원고측 라벨 (원고, 채권자, 신청인 등)
  defendant: string;    // 피고측 라벨 (피고, 채무자, 피신청인 등)
}

/**
 * 사건종류 코드 → 당사자 라벨 매핑
 */
export const CASE_PARTY_LABELS: Record<string, PartyLabels> = {
  // ═══════════════════════════════════════════════════════════════
  // 민사 사건 (ssgo101)
  // ═══════════════════════════════════════════════════════════════
  '가단': { plaintiff: '원고', defendant: '피고' },
  '가소': { plaintiff: '원고', defendant: '피고' },
  '가합': { plaintiff: '원고', defendant: '피고' },
  '가기': { plaintiff: '원고', defendant: '피고' },

  // 민사 항소/상고
  '나': { plaintiff: '원고,항소인', defendant: '피고,피항소인' },
  '다': { plaintiff: '원고,상고인', defendant: '피고,피상고인' },
  '라': { plaintiff: '재심원고', defendant: '재심피고' },

  // 민사 항고/재항고
  '그': { plaintiff: '항고인', defendant: '' },
  '마': { plaintiff: '항고인', defendant: '상대방' },

  // 민사조정
  '머': { plaintiff: '원고,신청인', defendant: '피고,상대방' },

  // ═══════════════════════════════════════════════════════════════
  // 독촉/지급명령 (ssgo10c)
  // ═══════════════════════════════════════════════════════════════
  '자': { plaintiff: '원고,채권자', defendant: '피고,채무자' },
  '차': { plaintiff: '채권자', defendant: '채무자' },
  '차전': { plaintiff: '채권자', defendant: '채무자' },

  // ═══════════════════════════════════════════════════════════════
  // 가사 사건 (ssgo102)
  // ═══════════════════════════════════════════════════════════════
  // 가사소송 1심
  '드단': { plaintiff: '원고', defendant: '피고' },
  '드합': { plaintiff: '원고', defendant: '피고' },

  // 가사소송 항소/상고
  '르': { plaintiff: '원고,항소인', defendant: '피고,피항소인' },
  '므': { plaintiff: '원고,상고인', defendant: '피고,피상고인' },

  // 가사비송
  '느단': { plaintiff: '청구인', defendant: '상대방' },
  '느합': { plaintiff: '청구인', defendant: '상대방' },

  // 가사비송 항고
  '너': { plaintiff: '신청인', defendant: '피신청인' },

  // 가사보전/신청
  '즈단': { plaintiff: '채권자(신청자)', defendant: '채무자(피신청자)' },
  '즈합': { plaintiff: '채권자(신청자)', defendant: '채무자(피신청자)' },
  '즈기': { plaintiff: '신청인', defendant: '피신청인' },

  // 가사후견
  '브': { plaintiff: '항고인,청구인', defendant: '상대방' },
  '후기': { plaintiff: '청구인', defendant: '상대방' },
  '후개': { plaintiff: '청구인', defendant: '상대방' },
  '후단': { plaintiff: '청구인', defendant: '상대방' },

  // 가사정정
  '정드': { plaintiff: '채권자', defendant: '채무자' },

  // ═══════════════════════════════════════════════════════════════
  // 보호사건
  // ═══════════════════════════════════════════════════════════════
  '동버': { plaintiff: '조사관명', defendant: '행위자명' },
  '푸': { plaintiff: '조사관명', defendant: '보호소년명' },

  // ═══════════════════════════════════════════════════════════════
  // 행정 사건 (민사 엔드포인트 ssgo101 사용)
  // ═══════════════════════════════════════════════════════════════
  '구합': { plaintiff: '원고', defendant: '피고' },
  '구단': { plaintiff: '원고', defendant: '피고' },
  '누': { plaintiff: '원고,항소인', defendant: '피고,피항소인' },
  '두': { plaintiff: '원고,상고인', defendant: '피고,피상고인' },
  '루': { plaintiff: '원고', defendant: '피고' },

  // ═══════════════════════════════════════════════════════════════
  // 호적
  // ═══════════════════════════════════════════════════════════════
  '호파': { plaintiff: '항고인', defendant: '상대방' },

  // ═══════════════════════════════════════════════════════════════
  // 형사 사건 (ssgo10g)
  // ═══════════════════════════════════════════════════════════════
  '고단': { plaintiff: '', defendant: '피고인명' },
  '고합': { plaintiff: '', defendant: '피고인명' },
  '고약': { plaintiff: '', defendant: '피고인명' },
  '고정': { plaintiff: '', defendant: '피고인명' },
  '노': { plaintiff: '', defendant: '피고인명' },
  '도': { plaintiff: '', defendant: '피고인명' },
  '초재': { plaintiff: '', defendant: '피고인명,대표피고인' },

  // ═══════════════════════════════════════════════════════════════
  // 신청/보전 사건 (ssgo105)
  // ═══════════════════════════════════════════════════════════════
  '카공': { plaintiff: '신청인', defendant: '피신청인' },
  '카기': { plaintiff: '신청인', defendant: '피신청인' },
  '카기전': { plaintiff: '신청인', defendant: '피신청인' },
  '카단': { plaintiff: '신청인,채권자', defendant: '피신청인,채무자' },
  '카합': { plaintiff: '채권자', defendant: '채무자' },
  '카담': { plaintiff: '채권자', defendant: '채무자' },
  '카명': { plaintiff: '신청인', defendant: '피신청인' },
  '카불': { plaintiff: '채권자', defendant: '채무자' },
  '카조': { plaintiff: '신청인', defendant: '피신청인' },
  '카확': { plaintiff: '신청인', defendant: '피신청인' },
  '카정': { plaintiff: '신청인', defendant: '피신청인' },
  '카소': { plaintiff: '신청인', defendant: '피신청인' },
  '카임': { plaintiff: '신청인', defendant: '피신청인' },
  '카경': { plaintiff: '신청인', defendant: '피신청인' },

  // ═══════════════════════════════════════════════════════════════
  // 집행 사건 (ssgo10a)
  // ═══════════════════════════════════════════════════════════════
  '타기': { plaintiff: '채권자,신청인', defendant: '채무자,피신청인' },
  '타배': { plaintiff: '신청인', defendant: '피신청인' },
  '타채': { plaintiff: '채권자', defendant: '채무자' },
  '타경': { plaintiff: '신청인', defendant: '피신청인' },

  // ═══════════════════════════════════════════════════════════════
  // 회생/파산 사건 (ssgo107)
  // ═══════════════════════════════════════════════════════════════
  // 개인회생
  '개회': { plaintiff: '신청인', defendant: '상대방' },
  '개확': { plaintiff: '신청인', defendant: '상대방' },
  '개보': { plaintiff: '신청인', defendant: '상대방' },
  '개기': { plaintiff: '신청인', defendant: '상대방' },

  // 파산/면책
  '하단': { plaintiff: '신청인', defendant: '채무자' },
  '하합': { plaintiff: '신청인', defendant: '채무자' },
  '하면': { plaintiff: '신청인', defendant: '채무자' },
  '하기': { plaintiff: '회생위원,신청인', defendant: '채무자,채권자' },
  '하확': { plaintiff: '신청인', defendant: '채무자' },

  // 법인회생
  '회단': { plaintiff: '신청인', defendant: '상대방,채권자' },
  '회합': { plaintiff: '신청인', defendant: '상대방,채권자' },
  '회확': { plaintiff: '신청인', defendant: '상대방' },
  '간회단': { plaintiff: '신청인', defendant: '상대방' },
  '간회합': { plaintiff: '신청인', defendant: '상대방' },
};

/**
 * 사건종류 코드에 해당하는 당사자 라벨을 반환
 *
 * @param caseType - 사건종류 코드 (예: "가단", "드단", "타채")
 * @returns 당사자 라벨 (없으면 기본값 원고/피고)
 */
export function getPartyLabels(caseType: string): PartyLabels {
  // 정확히 일치하는 경우
  if (CASE_PARTY_LABELS[caseType]) {
    return CASE_PARTY_LABELS[caseType];
  }

  // 사건종류 코드의 첫 글자로 카테고리 추정
  const firstChar = caseType.charAt(0);

  // 형사 계열
  if (['고', '노', '도', '초'].includes(firstChar)) {
    return { plaintiff: '', defendant: '피고인명' };
  }

  // 가사 계열
  if (['드', '르', '므', '느', '너', '즈', '브', '후'].includes(firstChar)) {
    // 가사비송/후견은 청구인/상대방
    if (['느', '브', '후'].includes(firstChar)) {
      return { plaintiff: '청구인', defendant: '상대방' };
    }
    // 가사보전은 채권자/채무자
    if (firstChar === '즈') {
      return { plaintiff: '채권자', defendant: '채무자' };
    }
    return { plaintiff: '원고', defendant: '피고' };
  }

  // 신청/보전 계열
  if (firstChar === '카') {
    return { plaintiff: '신청인', defendant: '피신청인' };
  }

  // 집행 계열
  if (firstChar === '타') {
    return { plaintiff: '채권자', defendant: '채무자' };
  }

  // 회생/파산 계열
  if (['개', '하', '회', '간'].includes(firstChar)) {
    return { plaintiff: '신청인', defendant: '채무자' };
  }

  // 독촉/지급명령 계열
  if (['자', '차'].includes(firstChar)) {
    return { plaintiff: '채권자', defendant: '채무자' };
  }

  // 기본값: 민사
  return { plaintiff: '원고', defendant: '피고' };
}

/**
 * 당사자 라벨에서 첫 번째 라벨만 추출
 * (예: "원고,항소인" → "원고")
 *
 * @param label - 당사자 라벨 문자열 (쉼표로 구분된 경우)
 * @returns 첫 번째 라벨
 */
export function getPrimaryLabel(label: string): string {
  if (!label) return '';
  return label.split(',')[0].trim();
}

/**
 * 사건종류별 API 카테고리도 함께 반환
 * UI에서 적절한 필드를 표시하기 위해 사용
 */
export function getCaseTypeInfo(caseType: string): {
  partyLabels: PartyLabels;
  category: string;
  isFamily: boolean;
  isCriminal: boolean;
  isInsolvency: boolean;
} {
  const partyLabels = getPartyLabels(caseType);
  const firstChar = caseType.charAt(0);

  // 카테고리 추정
  let category = '민사';
  let isFamily = false;
  let isCriminal = false;
  let isInsolvency = false;

  if (['드', '르', '므', '느', '너', '즈', '브', '후', '정'].includes(firstChar)) {
    category = '가사';
    isFamily = true;
  } else if (['고', '노', '도', '초'].includes(firstChar)) {
    category = '형사';
    isCriminal = true;
  } else if (firstChar === '카') {
    category = '신청/보전';
  } else if (firstChar === '타') {
    category = '집행';
  } else if (['개', '하', '회', '간'].includes(firstChar)) {
    category = '회생/파산';
    isInsolvency = true;
  } else if (['자', '차'].includes(firstChar)) {
    category = '독촉';
  } else if (['구', '누', '두', '루'].includes(firstChar)) {
    category = '행정';
  }

  return {
    partyLabels,
    category,
    isFamily,
    isCriminal,
    isInsolvency,
  };
}
