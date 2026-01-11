/**
 * 사건분류 시스템 - 변호사 사건관리 최적화
 *
 * 분류 체계:
 * - 가사: 이혼, 가사 본안소송
 * - 가사신청: 사전처분, 양육비 사전처분 등 가사 관련 신청
 * - 보전처분: 가압류/가처분 (민사 및 가사)
 * - 상간자: 상간자 손해배상
 * - 민사: 일반 민사소송
 * - 형사: 형사사건
 * - 집행: 강제집행, 경매
 * - 심급/절차: 항소, 상고, 조정 등
 * - 기타: 증거보전, 합의서작성 등
 */

export interface CaseTypeOption {
  value: string
  label: string
  group: string
}

/**
 * 사건 유형 그룹 순서
 */
export const CASE_TYPE_GROUPS = [
  '가사',
  '가사신청',
  '보전처분',
  '상간자',
  '민사',
  '형사',
  '집행',
  '심급/절차',
  '기타'
] as const

export type CaseTypeGroup = typeof CASE_TYPE_GROUPS[number]

/**
 * 사건 유형 옵션 (그룹별 정렬)
 */
export const CASE_TYPE_OPTIONS: CaseTypeOption[] = [
  // ====== 가사 (가사소송 본안) ======
  { value: '이혼', label: '이혼', group: '가사' },
  { value: '가사', label: '가사', group: '가사' },
  { value: '양육권 등', label: '양육권 등', group: '가사' },

  // ====== 가사신청 (가사 관련 신청사건) ======
  { value: '사전처분', label: '사전처분', group: '가사신청' },
  { value: '양육비 사전처분', label: '양육비 사전처분', group: '가사신청' },
  { value: '면접교섭 사전처분', label: '면접교섭 사전처분', group: '가사신청' },
  { value: '가사조정', label: '가사조정', group: '가사신청' },

  // ====== 보전처분 (가압류/가처분 - 독립 카테고리) ======
  { value: '부동산 가압류', label: '부동산 가압류', group: '보전처분' },
  { value: '채권 가압류', label: '채권 가압류', group: '보전처분' },
  { value: '부동산 가처분', label: '부동산 가처분', group: '보전처분' },
  { value: '채권 가처분', label: '채권 가처분', group: '보전처분' },
  { value: '가사 가압류', label: '가사 가압류', group: '보전처분' },
  { value: '가사 가처분', label: '가사 가처분', group: '보전처분' },
  { value: '기타 보전처분', label: '기타 보전처분', group: '보전처분' },

  // ====== 상간자 ======
  { value: '상간자', label: '상간자', group: '상간자' },

  // ====== 민사 ======
  { value: '민사', label: '민사', group: '민사' },
  { value: '민사조정', label: '민사조정', group: '민사' },

  // ====== 형사 ======
  { value: '형사', label: '형사', group: '형사' },

  // ====== 집행 ======
  { value: '집행', label: '집행', group: '집행' },
  { value: '채권추심', label: '채권추심', group: '집행' },

  // ====== 심급/절차 ======
  { value: '항소', label: '항소 (2심)', group: '심급/절차' },
  { value: '상고', label: '상고 (3심)', group: '심급/절차' },
  { value: '조정', label: '조정', group: '심급/절차' },
  { value: '반소', label: '반소', group: '심급/절차' },
  { value: '이송', label: '이송', group: '심급/절차' },

  // ====== 기타 ======
  { value: '증거보전', label: '증거보전', group: '기타' },
  { value: '합의서작성', label: '합의서작성', group: '기타' },
  { value: '기타', label: '기타', group: '기타' },
]

/**
 * 그룹별로 옵션 묶기
 */
export function getGroupedCaseTypes(): Record<string, CaseTypeOption[]> {
  const grouped: Record<string, CaseTypeOption[]> = {}

  for (const group of CASE_TYPE_GROUPS) {
    grouped[group] = CASE_TYPE_OPTIONS.filter(opt => opt.group === group)
  }

  return grouped
}

/**
 * 사건번호 + 사건명 기반 자동분류
 *
 * @param caseNumber - 사건번호 (예: 2024드단12345)
 * @param caseName - 사건명 (예: 이혼 및 위자료)
 * @returns 자동분류된 사건유형 또는 null (수동 선택 필요)
 */
export function getCaseTypeAuto(
  caseNumber: string | null | undefined,
  caseName: string | null | undefined
): string | null {
  // 1단계: 사건번호로 1차 분류
  if (caseNumber) {
    const match = caseNumber.match(/\d{4}([가-힣]+)\d+/)
    if (match) {
      const caseCode = match[1]

      // 보전처분 - 민사 가압류/가처분 (카단, 카합)
      if (['카단', '카합'].some(c => caseCode.startsWith(c))) {
        return '보전처분'
      }

      // 보전처분 - 가사 가압류/가처분 (즈단, 즈합)
      if (['즈단', '즈합'].some(c => caseCode.startsWith(c))) {
        return '보전처분'
      }

      // 가사 본안 및 비송 (드단, 드합, 느단, 느합)
      if (['드단', '드합', '느단', '느합'].includes(caseCode)) {
        return '가사'
      }

      // 민사 (가단, 가합, 가소)
      if (['가단', '가합', '가소'].includes(caseCode)) {
        return '민사'
      }

      // 형사 (고단, 고합, 고약)
      if (['고단', '고합', '고약'].includes(caseCode)) {
        return '형사'
      }

      // 집행 (타경, 타기, 타채, 타인, 타배)
      if (['타경', '타기', '타채', '타인', '타배'].includes(caseCode)) {
        return '집행'
      }

      // 항소/상고 (나, 다, 르, 므, 노, 도)
      if (['나', '르', '노'].includes(caseCode)) {
        return '항소'
      }
      if (['다', '므', '도'].includes(caseCode)) {
        return '상고'
      }
    }
  }

  // 2단계: 사건명으로 세부 분류 (비송/신청사건 등)
  if (caseName) {
    const name = caseName.toLowerCase()

    // 가사신청 (사전처분, 양육비 관련)
    if (name.includes('사전처분') ||
        (name.includes('양육비') && !name.includes('이혼')) ||
        name.includes('면접교섭')) {
      return '가사신청'
    }

    // 보전처분
    if (name.includes('가압류') || name.includes('가처분')) {
      return '보전처분'
    }

    // 상간자
    if (name.includes('상간') ||
        name.includes('부정행위') ||
        name.includes('정조')) {
      return '상간자'
    }

    // 가사 (이혼 관련)
    if (name.includes('이혼') ||
        name.includes('위자료') ||
        name.includes('양육권') ||
        name.includes('재산분할') ||
        name.includes('친권')) {
      return '가사'
    }

    // 민사조정
    if (name.includes('조정') && !name.includes('가사')) {
      return '민사조정'
    }
  }

  return null // 자동분류 불가 → 사용자 선택
}

/**
 * 신청사건 여부 판별
 * 보전처분 또는 가사신청인 경우 true
 */
export function isApplicationCaseType(
  caseType: string | null | undefined,
  caseNumber: string | null | undefined
): boolean {
  // 사건유형으로 판별
  if (caseType) {
    if (caseType.includes('가압류') ||
        caseType.includes('가처분') ||
        caseType.includes('보전처분') ||
        caseType.includes('사전처분') ||
        caseType === '가사조정' ||
        caseType === '가사신청') {
      return true
    }
  }

  // 사건번호로 판별
  if (caseNumber) {
    const applicationCodes = ['카단', '카합', '카기', '카공', '카담', '즈단', '즈합', '즈기', '브']
    return applicationCodes.some(code => caseNumber.includes(code))
  }

  return false
}

/**
 * 형사사건 여부 판별
 *
 * 형사사건은 상대방이 없음 (검사 vs 피고인)
 * 사건번호 또는 사건유형으로 판별
 *
 * @param caseType - 사건유형 (예: '형사')
 * @param caseNumber - 사건번호 (예: '2024고단12345')
 * @returns 형사사건이면 true
 */
export function isCriminalCase(
  caseType: string | null | undefined,
  caseNumber: string | null | undefined
): boolean {
  // 사건유형으로 판별
  if (caseType) {
    if (caseType === '형사' || caseType.includes('형사')) {
      return true
    }
  }

  // 사건번호로 판별 (형사 사건 코드)
  if (caseNumber) {
    const match = caseNumber.match(/\d{4}([가-힣]+)\d+/)
    if (match) {
      const caseCode = match[1]
      // 형사 사건 코드들
      const criminalCodes = [
        '고단', '고합', '고약', '고약전', '고정',  // 형사 1심
        '노',  // 형사 항소
        '도',  // 형사 상고
        '로', '모', '오',  // 형사 항고/재항고
        '초', '초기', '초보', '초사', '초재', '초적', '초치',  // 형사 기타
        '감고', '감노', '감도', '감로', '감모', '감오', '감초',  // 감형
        '보', '보고', '보노', '보도', '보로', '보모', '보오', '보초',  // 보호관찰
        '전고', '전노', '전도', '전로', '전모', '전오', '전초',  // 전속형사
        '치고', '치노', '치도', '치로', '치모', '치오', '치초',  // 치료감호
        '동고', '동노', '동도', '동오', '동초',  // 동반형사
        '재고단', '재고약', '재고정', '재고합', '재감고', '재감노', '재감도', '재노', '재도', '재무', '재수',  // 재심 형사
        '무', '수', '수흐', '과',  // 기타 형사 관련
      ]

      if (criminalCodes.some(code => caseCode === code || caseCode.startsWith(code))) {
        return true
      }
    }
  }

  return false
}

/**
 * 사건유형에서 그룹 추출
 */
export function getCaseTypeGroup(caseType: string | null | undefined): CaseTypeGroup | null {
  if (!caseType) return null

  const option = CASE_TYPE_OPTIONS.find(opt => opt.value === caseType)
  if (option) {
    return option.group as CaseTypeGroup
  }

  // 직접 입력된 경우 키워드로 추정
  if (caseType.includes('가압류') || caseType.includes('가처분') || caseType.includes('보전')) {
    return '보전처분'
  }
  if (caseType.includes('사전처분') || caseType.includes('가사신청') || caseType.includes('가사조정')) {
    return '가사신청'
  }
  if (caseType.includes('이혼') || caseType.includes('양육') || caseType.includes('친권')) {
    return '가사'
  }
  if (caseType.includes('상간')) {
    return '상간자'
  }

  return null
}
