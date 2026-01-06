/**
 * 대한민국 법원 사건유형 코드 매핑
 *
 * 나의사건검색 드롭다운에서 수집 (2025-12-31)
 * 총 244개 사건유형
 *
 * 사건번호 구조: 법원 + 연도 + 사건유형코드 + 일련번호
 * 예: 서울중앙지방법원 2024가단123456
 */

// ============================================================
// 타입 정의
// ============================================================

export type CaseCategory =
  | 'civil'           // 민사
  | 'family'          // 가사
  | 'criminal'        // 형사
  | 'administrative'  // 행정
  | 'execution'       // 신청/집행
  | 'bankruptcy'      // 파산/회생
  | 'appeal'          // 상소/항소
  | 'special'         // 특수
  | 'other';          // 기타

export type CaseLevel =
  | '1심'     // 1심 (단독/합의)
  | '항소심'  // 2심 항소
  | '상고심'  // 3심 상고
  | '재항고'  // 재항고
  | '특별항고' // 특별항고
  | '재심'    // 재심
  | '준재심'  // 준재심
  | '신청'    // 신청사건
  | '기타';

export interface CaseTypeInfo {
  code: string;           // 사건유형 코드 (드롭다운 value)
  name: string;           // 사건유형 명칭
  fullName: string;       // 전체 명칭
  category: CaseCategory; // 분류
  level: CaseLevel;       // 심급
  description: string;    // 설명
  partyLabels?: {         // 당사자 표시
    plaintiff: string;    // 원고/신청인 등
    defendant: string;    // 피고/상대방 등
  };
}

// ============================================================
// 사건유형 코드 목록 (244개)
// ============================================================

export const CASE_TYPES: CaseTypeInfo[] = [
  // ============================================================
  // 민사 (Civil)
  // ============================================================
  {
    code: '가단',
    name: '가단',
    fullName: '민사단독',
    category: 'civil',
    level: '1심',
    description: '민사 1심 단독 사건 (소가 3억 이하)',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '가합',
    name: '가합',
    fullName: '민사합의',
    category: 'civil',
    level: '1심',
    description: '민사 1심 합의 사건 (소가 3억 초과)',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '가소',
    name: '가소',
    fullName: '소액사건',
    category: 'civil',
    level: '1심',
    description: '소액사건 (소가 3,000만원 이하)',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '나',
    name: '나',
    fullName: '민사항소',
    category: 'civil',
    level: '항소심',
    description: '민사 항소심 (2심)',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '다',
    name: '다',
    fullName: '민사상고',
    category: 'civil',
    level: '상고심',
    description: '민사 상고심 (3심, 대법원)',
    partyLabels: { plaintiff: '상고인', defendant: '피상고인' }
  },
  {
    code: '라',
    name: '라',
    fullName: '민사특별항고',
    category: 'civil',
    level: '특별항고',
    description: '민사 특별항고 (대법원)',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '마',
    name: '마',
    fullName: '민사재항고',
    category: 'civil',
    level: '재항고',
    description: '민사 재항고 (대법원)',
    partyLabels: { plaintiff: '재항고인', defendant: '상대방' }
  },
  {
    code: '머',
    name: '머',
    fullName: '민사조정',
    category: 'civil',
    level: '신청',
    description: '민사조정 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '바',
    name: '바',
    fullName: '민사항고',
    category: 'civil',
    level: '항소심',
    description: '민사 항고 사건',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '버',
    name: '버',
    fullName: '집행항고',
    category: 'execution',
    level: '항소심',
    description: '집행 관련 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '버집',
    name: '버집',
    fullName: '집행항고집행',
    category: 'execution',
    level: '항소심',
    description: '집행 관련 항고 (집행부)',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '사',
    name: '사',
    fullName: '민사기타',
    category: 'civil',
    level: '기타',
    description: '민사 기타 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '서',
    name: '서',
    fullName: '송무',
    category: 'civil',
    level: '기타',
    description: '송무 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '어',
    name: '어',
    fullName: '집행이의',
    category: 'execution',
    level: '신청',
    description: '집행에 대한 이의신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '으',
    name: '으',
    fullName: '민사즉시항고',
    category: 'civil',
    level: '항소심',
    description: '민사 즉시항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '저',
    name: '저',
    fullName: '제소전화해',
    category: 'civil',
    level: '신청',
    description: '제소전 화해 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '처',
    name: '처',
    fullName: '집행문부여등',
    category: 'execution',
    level: '신청',
    description: '집행문 부여 등 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '처집',
    name: '처집',
    fullName: '집행문부여집행',
    category: 'execution',
    level: '신청',
    description: '집행문 부여 (집행부)',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },

  // ============================================================
  // 가사 (Family)
  // ============================================================
  {
    code: '드',
    name: '드',
    fullName: '가사소송',
    category: 'family',
    level: '1심',
    description: '가사 소송 사건',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '드단',
    name: '드단',
    fullName: '가사단독',
    category: 'family',
    level: '1심',
    description: '가사 1심 단독 (이혼, 양육권 등)',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '드합',
    name: '드합',
    fullName: '가사합의',
    category: 'family',
    level: '1심',
    description: '가사 1심 합의',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '느',
    name: '느',
    fullName: '가사항소',
    category: 'family',
    level: '항소심',
    description: '가사 항소심 (2심)',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '느단',
    name: '느단',
    fullName: '가사항소단독',
    category: 'family',
    level: '항소심',
    description: '가사 항소 단독',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '느합',
    name: '느합',
    fullName: '가사항소합의',
    category: 'family',
    level: '항소심',
    description: '가사 항소 합의',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '르',
    name: '르',
    fullName: '가사항소',
    category: 'family',
    level: '항소심',
    description: '가사 항소 사건 (드단/드합의 항소심)',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '므',
    name: '므',
    fullName: '가사상고',
    category: 'family',
    level: '상고심',
    description: '가사 상고심 (3심, 대법원)',
    partyLabels: { plaintiff: '상고인', defendant: '피상고인' }
  },
  {
    code: '브',
    name: '브',
    fullName: '가사사전처분',
    category: 'family',
    level: '신청',
    description: '가사 사전처분',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '스',
    name: '스',
    fullName: '가사재항고/특별항고',
    category: 'family',
    level: '재항고',
    description: '가사 재항고/특별항고 (대법원)',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '조',
    name: '조',
    fullName: '가사조정',
    category: 'family',
    level: '신청',
    description: '가사 조정 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '즈기',
    name: '즈기',
    fullName: '가사항고기각',
    category: 'family',
    level: '항소심',
    description: '가사 항고 기각',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '즈단',
    name: '즈단',
    fullName: '가사즉시항고단독',
    category: 'family',
    level: '항소심',
    description: '가사 즉시항고 단독',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '즈합',
    name: '즈합',
    fullName: '가사즉시항고합의',
    category: 'family',
    level: '항소심',
    description: '가사 즉시항고 합의',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '호',
    name: '호',
    fullName: '호적',
    category: 'family',
    level: '신청',
    description: '호적 관련 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '호기',
    name: '호기',
    fullName: '호적기각',
    category: 'family',
    level: '신청',
    description: '호적 기각',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '호명',
    name: '호명',
    fullName: '호적명령',
    category: 'family',
    level: '신청',
    description: '호적 명령',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '호파',
    name: '호파',
    fullName: '호적파기',
    category: 'family',
    level: '신청',
    description: '호적 파기',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '호협',
    name: '호협',
    fullName: '호적협의',
    category: 'family',
    level: '신청',
    description: '호적 협의',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },

  // ============================================================
  // 형사 (Criminal)
  // ============================================================
  {
    code: '고단',
    name: '고단',
    fullName: '형사단독',
    category: 'criminal',
    level: '1심',
    description: '형사 1심 단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '고합',
    name: '고합',
    fullName: '형사합의',
    category: 'criminal',
    level: '1심',
    description: '형사 1심 합의',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '고약',
    name: '고약',
    fullName: '형사약식',
    category: 'criminal',
    level: '1심',
    description: '형사 약식 사건',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '고약전',
    name: '고약전',
    fullName: '형사약식전환',
    category: 'criminal',
    level: '1심',
    description: '형사 약식명령에서 정식재판 전환',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '고정',
    name: '고정',
    fullName: '형사정식',
    category: 'criminal',
    level: '1심',
    description: '형사 정식 재판',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '노',
    name: '노',
    fullName: '형사항소',
    category: 'criminal',
    level: '항소심',
    description: '형사 항소심 (2심)',
    partyLabels: { plaintiff: '검사/항소인', defendant: '피고인' }
  },
  {
    code: '도',
    name: '도',
    fullName: '형사상고',
    category: 'criminal',
    level: '상고심',
    description: '형사 상고심 (3심, 대법원)',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '로',
    name: '로',
    fullName: '형사특별항고',
    category: 'criminal',
    level: '특별항고',
    description: '형사 특별항고 (대법원)',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '모',
    name: '모',
    fullName: '형사재항고',
    category: 'criminal',
    level: '재항고',
    description: '형사 재항고 (대법원)',
    partyLabels: { plaintiff: '재항고인', defendant: '피고인' }
  },
  {
    code: '오',
    name: '오',
    fullName: '형사항고',
    category: 'criminal',
    level: '항소심',
    description: '형사 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '초',
    name: '초',
    fullName: '형사기타',
    category: 'criminal',
    level: '기타',
    description: '형사 기타 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '초기',
    name: '초기',
    fullName: '형사기각',
    category: 'criminal',
    level: '기타',
    description: '형사 기각',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '초보',
    name: '초보',
    fullName: '형사보석',
    category: 'criminal',
    level: '신청',
    description: '보석 신청',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '초사',
    name: '초사',
    fullName: '형사사면',
    category: 'criminal',
    level: '기타',
    description: '사면 관련',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '초재',
    name: '초재',
    fullName: '형사재심',
    category: 'criminal',
    level: '재심',
    description: '형사 재심',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '초적',
    name: '초적',
    fullName: '형사적용',
    category: 'criminal',
    level: '기타',
    description: '형사 적용',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '초치',
    name: '초치',
    fullName: '형사치료감호',
    category: 'criminal',
    level: '기타',
    description: '치료감호',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },

  // ============================================================
  // 행정 (Administrative)
  // ============================================================
  {
    code: '구',
    name: '구',
    fullName: '행정본안',
    category: 'administrative',
    level: '1심',
    description: '행정 본안 사건',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '구단',
    name: '구단',
    fullName: '행정단독',
    category: 'administrative',
    level: '1심',
    description: '행정 1심 단독',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '구합',
    name: '구합',
    fullName: '행정합의',
    category: 'administrative',
    level: '1심',
    description: '행정 1심 합의',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '누',
    name: '누',
    fullName: '행정항소',
    category: 'administrative',
    level: '항소심',
    description: '행정 항소심 (2심)',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '두',
    name: '두',
    fullName: '행정상고',
    category: 'administrative',
    level: '상고심',
    description: '행정 상고심 (3심, 대법원)',
    partyLabels: { plaintiff: '상고인', defendant: '피상고인' }
  },
  {
    code: '아',
    name: '아',
    fullName: '행정항고',
    category: 'administrative',
    level: '항소심',
    description: '행정 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },

  // ============================================================
  // 신청/집행 (Execution)
  // ============================================================
  {
    code: '차',
    name: '차',
    fullName: '독촉',
    category: 'execution',
    level: '신청',
    description: '지급명령 신청',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '차전',
    name: '차전',
    fullName: '지급명령',
    category: 'execution',
    level: '신청',
    description: '지급명령 (전자소송)',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '타기',
    name: '타기',
    fullName: '집행신청기각',
    category: 'execution',
    level: '신청',
    description: '집행 신청 기각',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '타채',
    name: '타채',
    fullName: '채권압류추심',
    category: 'execution',
    level: '신청',
    description: '채권압류 및 추심명령',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '타배',
    name: '타배',
    fullName: '배당',
    category: 'execution',
    level: '신청',
    description: '배당 사건',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '타인',
    name: '타인',
    fullName: '인도명령',
    category: 'execution',
    level: '신청',
    description: '인도명령',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카',
    name: '카',
    fullName: '보전처분',
    category: 'execution',
    level: '신청',
    description: '보전처분 사건',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카경',
    name: '카경',
    fullName: '부동산경매',
    category: 'execution',
    level: '신청',
    description: '부동산 경매',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카공',
    name: '카공',
    fullName: '공시최고',
    category: 'execution',
    level: '신청',
    description: '공시최고 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카구',
    name: '카구',
    fullName: '가구제',
    category: 'execution',
    level: '신청',
    description: '가구제 신청',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카기',
    name: '카기',
    fullName: '보전처분기각',
    category: 'execution',
    level: '신청',
    description: '보전처분 기각',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카기전',
    name: '카기전',
    fullName: '보전처분기각전자',
    category: 'execution',
    level: '신청',
    description: '보전처분 기각 (전자)',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카단',
    name: '카단',
    fullName: '가압류/가처분단독',
    category: 'execution',
    level: '신청',
    description: '가압류/가처분 단독',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카담',
    name: '카담',
    fullName: '담보취소',
    category: 'execution',
    level: '신청',
    description: '담보취소 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카명',
    name: '카명',
    fullName: '공시최고결정',
    category: 'execution',
    level: '신청',
    description: '공시최고 결정',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카불',
    name: '카불',
    fullName: '보전이의',
    category: 'execution',
    level: '신청',
    description: '보전처분에 대한 이의',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카소',
    name: '카소',
    fullName: '보전취소',
    category: 'execution',
    level: '신청',
    description: '보전처분 취소',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카열',
    name: '카열',
    fullName: '기록열람',
    category: 'execution',
    level: '신청',
    description: '기록 열람 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카임',
    name: '카임',
    fullName: '임시처분',
    category: 'execution',
    level: '신청',
    description: '임시처분 신청',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카정',
    name: '카정',
    fullName: '보전정정',
    category: 'execution',
    level: '신청',
    description: '보전처분 정정',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카조',
    name: '카조',
    fullName: '보전조정',
    category: 'execution',
    level: '신청',
    description: '보전 조정',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '카합',
    name: '카합',
    fullName: '가압류/가처분합의',
    category: 'execution',
    level: '신청',
    description: '가압류/가처분 합의',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '카확',
    name: '카확',
    fullName: '보전확정',
    category: 'execution',
    level: '신청',
    description: '보전처분 확정',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },

  // ============================================================
  // 파산/회생 (Bankruptcy/Rehabilitation)
  // ============================================================
  {
    code: '개기',
    name: '개기',
    fullName: '개인회생기각',
    category: 'bankruptcy',
    level: '신청',
    description: '개인회생 기각',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '개보',
    name: '개보',
    fullName: '개인회생보전',
    category: 'bankruptcy',
    level: '신청',
    description: '개인회생 보전처분',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '개확',
    name: '개확',
    fullName: '개인회생확정',
    category: 'bankruptcy',
    level: '신청',
    description: '개인회생 확정',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '개회',
    name: '개회',
    fullName: '개인회생',
    category: 'bankruptcy',
    level: '신청',
    description: '개인회생 신청',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '간회단',
    name: '간회단',
    fullName: '간이회생단독',
    category: 'bankruptcy',
    level: '신청',
    description: '간이회생 단독',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '간회합',
    name: '간회합',
    fullName: '간이회생합의',
    category: 'bankruptcy',
    level: '신청',
    description: '간이회생 합의',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '하기',
    name: '하기',
    fullName: '파산기각',
    category: 'bankruptcy',
    level: '신청',
    description: '파산 기각',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '하단',
    name: '하단',
    fullName: '파산단독',
    category: 'bankruptcy',
    level: '신청',
    description: '파산 단독',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '하면',
    name: '하면',
    fullName: '파산면책',
    category: 'bankruptcy',
    level: '신청',
    description: '파산 면책',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '하합',
    name: '하합',
    fullName: '파산합의',
    category: 'bankruptcy',
    level: '신청',
    description: '파산 합의',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '하확',
    name: '하확',
    fullName: '파산확정',
    category: 'bankruptcy',
    level: '신청',
    description: '파산 확정',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '회기',
    name: '회기',
    fullName: '회생기각',
    category: 'bankruptcy',
    level: '신청',
    description: '회생 기각',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '회단',
    name: '회단',
    fullName: '회생단독',
    category: 'bankruptcy',
    level: '신청',
    description: '회생 단독',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '회합',
    name: '회합',
    fullName: '회생합의',
    category: 'bankruptcy',
    level: '신청',
    description: '회생 합의',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },
  {
    code: '회확',
    name: '회확',
    fullName: '회생확정',
    category: 'bankruptcy',
    level: '신청',
    description: '회생 확정',
    partyLabels: { plaintiff: '신청인', defendant: '채권자' }
  },

  // ============================================================
  // 감형/보석 관련 (Special Criminal)
  // ============================================================
  {
    code: '감고',
    name: '감고',
    fullName: '감형고단',
    category: 'criminal',
    level: '1심',
    description: '감형 관련 형사단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '감노',
    name: '감노',
    fullName: '감형항소',
    category: 'criminal',
    level: '항소심',
    description: '감형 관련 항소',
    partyLabels: { plaintiff: '검사/항소인', defendant: '피고인' }
  },
  {
    code: '감도',
    name: '감도',
    fullName: '감형상고',
    category: 'criminal',
    level: '상고심',
    description: '감형 관련 상고',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '감로',
    name: '감로',
    fullName: '감형특별항고',
    category: 'criminal',
    level: '특별항고',
    description: '감형 관련 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '감모',
    name: '감모',
    fullName: '감형재항고',
    category: 'criminal',
    level: '재항고',
    description: '감형 관련 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '피고인' }
  },
  {
    code: '감오',
    name: '감오',
    fullName: '감형항고',
    category: 'criminal',
    level: '항소심',
    description: '감형 관련 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '감초',
    name: '감초',
    fullName: '감형기타',
    category: 'criminal',
    level: '기타',
    description: '감형 관련 기타',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },

  // ============================================================
  // 보호관찰/보안처분 (Probation/Security)
  // ============================================================
  {
    code: '보',
    name: '보',
    fullName: '보호관찰',
    category: 'criminal',
    level: '기타',
    description: '보호관찰 사건',
    partyLabels: { plaintiff: '검사', defendant: '피보호관찰자' }
  },
  {
    code: '보고',
    name: '보고',
    fullName: '보호관찰고단',
    category: 'criminal',
    level: '1심',
    description: '보호관찰 형사단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '보노',
    name: '보노',
    fullName: '보호관찰항소',
    category: 'criminal',
    level: '항소심',
    description: '보호관찰 항소',
    partyLabels: { plaintiff: '항소인', defendant: '피고인' }
  },
  {
    code: '보도',
    name: '보도',
    fullName: '보호관찰상고',
    category: 'criminal',
    level: '상고심',
    description: '보호관찰 상고',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '보로',
    name: '보로',
    fullName: '보호관찰특별항고',
    category: 'criminal',
    level: '특별항고',
    description: '보호관찰 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '보모',
    name: '보모',
    fullName: '보호관찰재항고',
    category: 'criminal',
    level: '재항고',
    description: '보호관찰 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '피고인' }
  },
  {
    code: '보오',
    name: '보오',
    fullName: '보호관찰항고',
    category: 'criminal',
    level: '항소심',
    description: '보호관찰 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '보초',
    name: '보초',
    fullName: '보호관찰기타',
    category: 'criminal',
    level: '기타',
    description: '보호관찰 기타',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },

  // ============================================================
  // 동반 관련 (Accompaniment)
  // ============================================================
  {
    code: '동고',
    name: '동고',
    fullName: '동반형사단독',
    category: 'criminal',
    level: '1심',
    description: '동반 형사 단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '동노',
    name: '동노',
    fullName: '동반형사항소',
    category: 'criminal',
    level: '항소심',
    description: '동반 형사 항소',
    partyLabels: { plaintiff: '항소인', defendant: '피고인' }
  },
  {
    code: '동도',
    name: '동도',
    fullName: '동반형사상고',
    category: 'criminal',
    level: '상고심',
    description: '동반 형사 상고',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '동버',
    name: '동버',
    fullName: '동반민사항고',
    category: 'civil',
    level: '항소심',
    description: '동반 민사 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '동버집',
    name: '동버집',
    fullName: '동반민사항고집행',
    category: 'civil',
    level: '항소심',
    description: '동반 민사 항고 (집행)',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '동서',
    name: '동서',
    fullName: '동반송무',
    category: 'civil',
    level: '기타',
    description: '동반 송무',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '동어',
    name: '동어',
    fullName: '동반집행이의',
    category: 'execution',
    level: '신청',
    description: '동반 집행이의',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '동오',
    name: '동오',
    fullName: '동반형사항고',
    category: 'criminal',
    level: '항소심',
    description: '동반 형사 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '동저',
    name: '동저',
    fullName: '동반제소전화해',
    category: 'civil',
    level: '신청',
    description: '동반 제소전화해',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '동처',
    name: '동처',
    fullName: '동반집행문부여',
    category: 'execution',
    level: '신청',
    description: '동반 집행문부여',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '동처집',
    name: '동처집',
    fullName: '동반집행문부여집행',
    category: 'execution',
    level: '신청',
    description: '동반 집행문부여 (집행)',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '동초',
    name: '동초',
    fullName: '동반형사기타',
    category: 'criminal',
    level: '기타',
    description: '동반 형사 기타',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '동커',
    name: '동커',
    fullName: '동반보전항고',
    category: 'execution',
    level: '항소심',
    description: '동반 보전 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '동터',
    name: '동터',
    fullName: '동반집행항고',
    category: 'execution',
    level: '항소심',
    description: '동반 집행 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },

  // ============================================================
  // 재심 관련 (Retrial)
  // ============================================================
  {
    code: '재가단',
    name: '재가단',
    fullName: '재심민사단독',
    category: 'civil',
    level: '재심',
    description: '재심 민사 단독',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재가소',
    name: '재가소',
    fullName: '재심소액',
    category: 'civil',
    level: '재심',
    description: '재심 소액',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재가합',
    name: '재가합',
    fullName: '재심민사합의',
    category: 'civil',
    level: '재심',
    description: '재심 민사 합의',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재감고',
    name: '재감고',
    fullName: '재심감형단독',
    category: 'criminal',
    level: '재심',
    description: '재심 감형 단독',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재감노',
    name: '재감노',
    fullName: '재심감형항소',
    category: 'criminal',
    level: '재심',
    description: '재심 감형 항소',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재감도',
    name: '재감도',
    fullName: '재심감형상고',
    category: 'criminal',
    level: '재심',
    description: '재심 감형 상고',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재고단',
    name: '재고단',
    fullName: '재심형사단독',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 단독',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재고약',
    name: '재고약',
    fullName: '재심형사약식',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 약식',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재고정',
    name: '재고정',
    fullName: '재심형사정식',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 정식',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재고합',
    name: '재고합',
    fullName: '재심형사합의',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 합의',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재구',
    name: '재구',
    fullName: '재심행정',
    category: 'administrative',
    level: '재심',
    description: '재심 행정',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재구단',
    name: '재구단',
    fullName: '재심행정단독',
    category: 'administrative',
    level: '재심',
    description: '재심 행정 단독',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재구합',
    name: '재구합',
    fullName: '재심행정합의',
    category: 'administrative',
    level: '재심',
    description: '재심 행정 합의',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재그',
    name: '재그',
    fullName: '재심선거',
    category: 'administrative',
    level: '재심',
    description: '재심 선거',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재나',
    name: '재나',
    fullName: '재심민사항소',
    category: 'civil',
    level: '재심',
    description: '재심 민사 항소',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재너',
    name: '재너',
    fullName: '재심선거항소',
    category: 'administrative',
    level: '재심',
    description: '재심 선거 항소',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재노',
    name: '재노',
    fullName: '재심형사항소',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 항소',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재누',
    name: '재누',
    fullName: '재심행정항소',
    category: 'administrative',
    level: '재심',
    description: '재심 행정 항소',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재느단',
    name: '재느단',
    fullName: '재심가사항소단독',
    category: 'family',
    level: '재심',
    description: '재심 가사 항소 단독',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재느합',
    name: '재느합',
    fullName: '재심가사항소합의',
    category: 'family',
    level: '재심',
    description: '재심 가사 항소 합의',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재다',
    name: '재다',
    fullName: '재심민사상고',
    category: 'civil',
    level: '재심',
    description: '재심 민사 상고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재도',
    name: '재도',
    fullName: '재심형사상고',
    category: 'criminal',
    level: '재심',
    description: '재심 형사 상고',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재동버',
    name: '재동버',
    fullName: '재심동반민사항고',
    category: 'civil',
    level: '재심',
    description: '재심 동반 민사 항고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재동서',
    name: '재동서',
    fullName: '재심동반송무',
    category: 'civil',
    level: '재심',
    description: '재심 동반 송무',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재동어',
    name: '재동어',
    fullName: '재심동반집행이의',
    category: 'execution',
    level: '재심',
    description: '재심 동반 집행이의',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재두',
    name: '재두',
    fullName: '재심행정상고',
    category: 'administrative',
    level: '재심',
    description: '재심 행정 상고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재드',
    name: '재드',
    fullName: '재심가사',
    category: 'family',
    level: '재심',
    description: '재심 가사',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재드단',
    name: '재드단',
    fullName: '재심가사단독',
    category: 'family',
    level: '재심',
    description: '재심 가사 단독',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재드합',
    name: '재드합',
    fullName: '재심가사합의',
    category: 'family',
    level: '재심',
    description: '재심 가사 합의',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재라',
    name: '재라',
    fullName: '재심민사특별항고',
    category: 'civil',
    level: '재심',
    description: '재심 민사 특별항고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재루',
    name: '재루',
    fullName: '재심신청',
    category: 'civil',
    level: '재심',
    description: '재심 신청',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재르',
    name: '재르',
    fullName: '재심가사비송',
    category: 'family',
    level: '재심',
    description: '재심 가사 비송',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재마',
    name: '재마',
    fullName: '재심민사재항고',
    category: 'civil',
    level: '재심',
    description: '재심 민사 재항고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재머',
    name: '재머',
    fullName: '재심민사조정',
    category: 'civil',
    level: '재심',
    description: '재심 민사 조정',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재무',
    name: '재무',
    fullName: '재심무고',
    category: 'criminal',
    level: '재심',
    description: '재심 무고',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재므',
    name: '재므',
    fullName: '재심가사상고',
    category: 'family',
    level: '재심',
    description: '재심 가사 상고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재버',
    name: '재버',
    fullName: '재심집행항고',
    category: 'execution',
    level: '재심',
    description: '재심 집행 항고',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재부',
    name: '재부',
    fullName: '재심부동산',
    category: 'execution',
    level: '재심',
    description: '재심 부동산',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재브',
    name: '재브',
    fullName: '재심가사사전처분',
    category: 'family',
    level: '재심',
    description: '재심 가사 사전처분',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재수',
    name: '재수',
    fullName: '재심수형',
    category: 'criminal',
    level: '재심',
    description: '재심 수형',
    partyLabels: { plaintiff: '재심신청인', defendant: '피고인' }
  },
  {
    code: '재스',
    name: '재스',
    fullName: '재심가사재항고',
    category: 'family',
    level: '재심',
    description: '재심 가사 재항고',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재아',
    name: '재아',
    fullName: '재심행정항고',
    category: 'administrative',
    level: '재심',
    description: '재심 행정 항고',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재으',
    name: '재으',
    fullName: '재심민사즉시항고',
    category: 'civil',
    level: '재심',
    description: '재심 민사 즉시항고',
    partyLabels: { plaintiff: '재심원고', defendant: '재심피고' }
  },
  {
    code: '재카경',
    name: '재카경',
    fullName: '재심부동산경매',
    category: 'execution',
    level: '재심',
    description: '재심 부동산 경매',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재카기',
    name: '재카기',
    fullName: '재심보전처분기각',
    category: 'execution',
    level: '재심',
    description: '재심 보전처분 기각',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재카담',
    name: '재카담',
    fullName: '재심담보취소',
    category: 'execution',
    level: '재심',
    description: '재심 담보취소',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },
  {
    code: '재후',
    name: '재후',
    fullName: '재심후견',
    category: 'family',
    level: '재심',
    description: '재심 후견',
    partyLabels: { plaintiff: '재심신청인', defendant: '상대방' }
  },

  // ============================================================
  // 준재심 관련 (Quasi-Retrial)
  // ============================================================
  {
    code: '준재가단',
    name: '준재가단',
    fullName: '준재심민사단독',
    category: 'civil',
    level: '준재심',
    description: '준재심 민사 단독',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재가소',
    name: '준재가소',
    fullName: '준재심소액',
    category: 'civil',
    level: '준재심',
    description: '준재심 소액',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재가합',
    name: '준재가합',
    fullName: '준재심민사합의',
    category: 'civil',
    level: '준재심',
    description: '준재심 민사 합의',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재구',
    name: '준재구',
    fullName: '준재심행정',
    category: 'administrative',
    level: '준재심',
    description: '준재심 행정',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재나',
    name: '준재나',
    fullName: '준재심민사항소',
    category: 'civil',
    level: '준재심',
    description: '준재심 민사 항소',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재누',
    name: '준재누',
    fullName: '준재심행정항소',
    category: 'administrative',
    level: '준재심',
    description: '준재심 행정 항소',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재느단',
    name: '준재느단',
    fullName: '준재심가사항소단독',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 항소 단독',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재느합',
    name: '준재느합',
    fullName: '준재심가사항소합의',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 항소 합의',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재드단',
    name: '준재드단',
    fullName: '준재심가사단독',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 단독',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재드합',
    name: '준재드합',
    fullName: '준재심가사합의',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 합의',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재르',
    name: '준재르',
    fullName: '준재심가사비송',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 비송',
    partyLabels: { plaintiff: '준재심신청인', defendant: '상대방' }
  },
  {
    code: '준재머',
    name: '준재머',
    fullName: '준재심민사조정',
    category: 'civil',
    level: '준재심',
    description: '준재심 민사 조정',
    partyLabels: { plaintiff: '준재심신청인', defendant: '상대방' }
  },
  {
    code: '준재므',
    name: '준재므',
    fullName: '준재심가사상고',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 상고',
    partyLabels: { plaintiff: '준재심원고', defendant: '준재심피고' }
  },
  {
    code: '준재스',
    name: '준재스',
    fullName: '준재심가사재항고',
    category: 'family',
    level: '준재심',
    description: '준재심 가사 재항고',
    partyLabels: { plaintiff: '준재심신청인', defendant: '상대방' }
  },

  // ============================================================
  // 기타 유형
  // ============================================================
  {
    code: '과',
    name: '과',
    fullName: '과태료',
    category: 'other',
    level: '기타',
    description: '과태료 사건',
    partyLabels: { plaintiff: '검사', defendant: '피청구인' }
  },
  {
    code: '그',
    name: '그',
    fullName: '선거',
    category: 'administrative',
    level: '1심',
    description: '선거 관련 사건',
    partyLabels: { plaintiff: '원고', defendant: '피고' }
  },
  {
    code: '너',
    name: '너',
    fullName: '선거항소',
    category: 'administrative',
    level: '항소심',
    description: '선거 항소',
    partyLabels: { plaintiff: '항소인', defendant: '피항소인' }
  },
  {
    code: '루',
    name: '루',
    fullName: '비송',
    category: 'civil',
    level: '신청',
    description: '비송 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '무',
    name: '무',
    fullName: '무고',
    category: 'criminal',
    level: '기타',
    description: '무고 관련',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '부',
    name: '부',
    fullName: '부동산',
    category: 'execution',
    level: '신청',
    description: '부동산 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '비단',
    name: '비단',
    fullName: '비송단독',
    category: 'civil',
    level: '신청',
    description: '비송 단독',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '비합',
    name: '비합',
    fullName: '비송합의',
    category: 'civil',
    level: '신청',
    description: '비송 합의',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '성',
    name: '성',
    fullName: '성년후견',
    category: 'family',
    level: '신청',
    description: '성년후견',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '성로',
    name: '성로',
    fullName: '성년후견특별항고',
    category: 'family',
    level: '특별항고',
    description: '성년후견 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '성모',
    name: '성모',
    fullName: '성년후견재항고',
    category: 'family',
    level: '재항고',
    description: '성년후견 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '상대방' }
  },
  {
    code: '성초',
    name: '성초',
    fullName: '성년후견기타',
    category: 'family',
    level: '기타',
    description: '성년후견 기타',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '수',
    name: '수',
    fullName: '수형',
    category: 'criminal',
    level: '기타',
    description: '수형 관련',
    partyLabels: { plaintiff: '검사', defendant: '수형인' }
  },
  {
    code: '수흐',
    name: '수흐',
    fullName: '수형회복',
    category: 'criminal',
    level: '기타',
    description: '수형 회복',
    partyLabels: { plaintiff: '신청인', defendant: '수형인' }
  },
  {
    code: '인',
    name: '인',
    fullName: '인지',
    category: 'family',
    level: '신청',
    description: '인지 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '인라',
    name: '인라',
    fullName: '인지특별항고',
    category: 'family',
    level: '특별항고',
    description: '인지 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '인마',
    name: '인마',
    fullName: '인지재항고',
    category: 'family',
    level: '재항고',
    description: '인지 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '상대방' }
  },
  {
    code: '인카',
    name: '인카',
    fullName: '인지보전',
    category: 'family',
    level: '신청',
    description: '인지 보전',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '자',
    name: '자',
    fullName: '자녀양육',
    category: 'family',
    level: '신청',
    description: '자녀 양육 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '전고',
    name: '전고',
    fullName: '전속형사단독',
    category: 'criminal',
    level: '1심',
    description: '전속 형사 단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '전노',
    name: '전노',
    fullName: '전속형사항소',
    category: 'criminal',
    level: '항소심',
    description: '전속 형사 항소',
    partyLabels: { plaintiff: '항소인', defendant: '피고인' }
  },
  {
    code: '전도',
    name: '전도',
    fullName: '전속형사상고',
    category: 'criminal',
    level: '상고심',
    description: '전속 형사 상고',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '전로',
    name: '전로',
    fullName: '전속형사특별항고',
    category: 'criminal',
    level: '특별항고',
    description: '전속 형사 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '전모',
    name: '전모',
    fullName: '전속형사재항고',
    category: 'criminal',
    level: '재항고',
    description: '전속 형사 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '피고인' }
  },
  {
    code: '전오',
    name: '전오',
    fullName: '전속형사항고',
    category: 'criminal',
    level: '항소심',
    description: '전속 형사 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '전초',
    name: '전초',
    fullName: '전속형사기타',
    category: 'criminal',
    level: '기타',
    description: '전속 형사 기타',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '정드',
    name: '정드',
    fullName: '정정가사',
    category: 'family',
    level: '기타',
    description: '정정 가사',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '정명',
    name: '정명',
    fullName: '정정명령',
    category: 'civil',
    level: '기타',
    description: '정정 명령',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '정브',
    name: '정브',
    fullName: '정정가사사전처분',
    category: 'family',
    level: '기타',
    description: '정정 가사 사전처분',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '정스',
    name: '정스',
    fullName: '정정가사재항고',
    category: 'family',
    level: '기타',
    description: '정정 가사 재항고',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '주',
    name: '주',
    fullName: '주주',
    category: 'civil',
    level: '신청',
    description: '주주 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '책',
    name: '책',
    fullName: '책임',
    category: 'civil',
    level: '기타',
    description: '책임 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '추',
    name: '추',
    fullName: '추심',
    category: 'execution',
    level: '신청',
    description: '추심 관련',
    partyLabels: { plaintiff: '채권자', defendant: '채무자' }
  },
  {
    code: '치고',
    name: '치고',
    fullName: '치료감호형사단독',
    category: 'criminal',
    level: '1심',
    description: '치료감호 형사 단독',
    partyLabels: { plaintiff: '검사', defendant: '피고인' }
  },
  {
    code: '치노',
    name: '치노',
    fullName: '치료감호형사항소',
    category: 'criminal',
    level: '항소심',
    description: '치료감호 형사 항소',
    partyLabels: { plaintiff: '항소인', defendant: '피고인' }
  },
  {
    code: '치도',
    name: '치도',
    fullName: '치료감호형사상고',
    category: 'criminal',
    level: '상고심',
    description: '치료감호 형사 상고',
    partyLabels: { plaintiff: '상고인', defendant: '피고인' }
  },
  {
    code: '치로',
    name: '치로',
    fullName: '치료감호형사특별항고',
    category: 'criminal',
    level: '특별항고',
    description: '치료감호 형사 특별항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '치모',
    name: '치모',
    fullName: '치료감호형사재항고',
    category: 'criminal',
    level: '재항고',
    description: '치료감호 형사 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '피고인' }
  },
  {
    code: '치오',
    name: '치오',
    fullName: '치료감호형사항고',
    category: 'criminal',
    level: '항소심',
    description: '치료감호 형사 항고',
    partyLabels: { plaintiff: '항고인', defendant: '피고인' }
  },
  {
    code: '치초',
    name: '치초',
    fullName: '치료감호형사기타',
    category: 'criminal',
    level: '기타',
    description: '치료감호 형사 기타',
    partyLabels: { plaintiff: '신청인', defendant: '피고인' }
  },
  {
    code: '커',
    name: '커',
    fullName: '보전항고',
    category: 'execution',
    level: '항소심',
    description: '보전 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '코',
    name: '코',
    fullName: '보전상고',
    category: 'execution',
    level: '상고심',
    description: '보전 상고',
    partyLabels: { plaintiff: '상고인', defendant: '상대방' }
  },
  {
    code: '크',
    name: '크',
    fullName: '보전재항고',
    category: 'execution',
    level: '재항고',
    description: '보전 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '상대방' }
  },
  {
    code: '터',
    name: '터',
    fullName: '집행항고',
    category: 'execution',
    level: '항소심',
    description: '집행 항고',
    partyLabels: { plaintiff: '항고인', defendant: '상대방' }
  },
  {
    code: '토',
    name: '토',
    fullName: '집행상고',
    category: 'execution',
    level: '상고심',
    description: '집행 상고',
    partyLabels: { plaintiff: '상고인', defendant: '상대방' }
  },
  {
    code: '트',
    name: '트',
    fullName: '집행재항고',
    category: 'execution',
    level: '재항고',
    description: '집행 재항고',
    partyLabels: { plaintiff: '재항고인', defendant: '상대방' }
  },
  {
    code: '푸',
    name: '푸',
    fullName: '가사집행',
    category: 'family',
    level: '신청',
    description: '가사 집행',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '푸집',
    name: '푸집',
    fullName: '가사집행집행',
    category: 'family',
    level: '신청',
    description: '가사 집행 (집행부)',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '푸초',
    name: '푸초',
    fullName: '가사집행기타',
    category: 'family',
    level: '기타',
    description: '가사 집행 기타',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '후',
    name: '후',
    fullName: '후견',
    category: 'family',
    level: '신청',
    description: '후견 사건',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '후감',
    name: '후감',
    fullName: '후견감독',
    category: 'family',
    level: '신청',
    description: '후견 감독',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '후개',
    name: '후개',
    fullName: '후견개시',
    category: 'family',
    level: '신청',
    description: '후견 개시',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '후기',
    name: '후기',
    fullName: '후견기각',
    category: 'family',
    level: '신청',
    description: '후견 기각',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '흐',
    name: '흐',
    fullName: '회복',
    category: 'civil',
    level: '기타',
    description: '회복 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '히',
    name: '히',
    fullName: '확인',
    category: 'civil',
    level: '기타',
    description: '확인 관련',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '국승',
    name: '국승',
    fullName: '국가승계',
    category: 'civil',
    level: '기타',
    description: '국가승계',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
  {
    code: '국지',
    name: '국지',
    fullName: '국가지정',
    category: 'civil',
    level: '기타',
    description: '국가지정',
    partyLabels: { plaintiff: '신청인', defendant: '상대방' }
  },
];

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 코드로 사건유형 정보 조회
 */
export function getCaseTypeByCode(code: string): CaseTypeInfo | undefined {
  return CASE_TYPES.find(ct => ct.code === code);
}

/**
 * 이름으로 사건유형 정보 조회
 */
export function getCaseTypeByName(name: string): CaseTypeInfo | undefined {
  return CASE_TYPES.find(ct => ct.name === name || ct.fullName.includes(name));
}

/**
 * 카테고리별 사건유형 목록 조회
 */
export function getCaseTypesByCategory(category: CaseCategory): CaseTypeInfo[] {
  return CASE_TYPES.filter(ct => ct.category === category);
}

/**
 * 심급별 사건유형 목록 조회
 */
export function getCaseTypesByLevel(level: CaseLevel): CaseTypeInfo[] {
  return CASE_TYPES.filter(ct => ct.level === level);
}

/**
 * 심급 관계 분석 (상소 가능 여부)
 */
export function canAppeal(caseTypeCode: string): { toAppeal: string | null; toSupreme: string | null } {
  const caseType = getCaseTypeByCode(caseTypeCode);
  if (!caseType) return { toAppeal: null, toSupreme: null };

  // 1심 → 항소심 → 상고심 매핑
  const appealMap: Record<string, { appeal: string; supreme: string }> = {
    // 민사
    '가단': { appeal: '나', supreme: '다' },
    '가합': { appeal: '나', supreme: '다' },
    '가소': { appeal: '나', supreme: '다' },
    // 가사
    '드단': { appeal: '느단', supreme: '므' },
    '드합': { appeal: '느합', supreme: '므' },
    // 형사
    '고단': { appeal: '노', supreme: '도' },
    '고합': { appeal: '노', supreme: '도' },
    '고약': { appeal: '노', supreme: '도' },
    // 행정
    '구단': { appeal: '누', supreme: '두' },
    '구합': { appeal: '누', supreme: '두' },
  };

  const mapping = appealMap[caseTypeCode];
  if (mapping) {
    return { toAppeal: mapping.appeal, toSupreme: mapping.supreme };
  }

  return { toAppeal: null, toSupreme: null };
}

/**
 * 관련 사건 유형 (보전처분 등)
 */
export function getRelatedCaseTypes(caseTypeCode: string): string[] {
  const relatedMap: Record<string, string[]> = {
    // 민사 본안 → 보전처분
    '가단': ['카단', '타채'],
    '가합': ['카합', '타채'],
    '가소': ['카단', '타채', '차전'],
    // 가사 본안 → 사전처분
    '드단': ['브'],
    '드합': ['브'],
  };

  return relatedMap[caseTypeCode] || [];
}

/**
 * 사건유형 검색
 */
export function searchCaseTypes(query: string): CaseTypeInfo[] {
  const lowerQuery = query.toLowerCase();
  return CASE_TYPES.filter(
    ct =>
      ct.code.includes(query) ||
      ct.name.includes(query) ||
      ct.fullName.includes(query) ||
      ct.description.includes(query)
  );
}

// ============================================================
// 통계
// ============================================================

export const CASE_TYPE_STATS = {
  total: CASE_TYPES.length,
  byCategory: {
    civil: getCaseTypesByCategory('civil').length,
    family: getCaseTypesByCategory('family').length,
    criminal: getCaseTypesByCategory('criminal').length,
    administrative: getCaseTypesByCategory('administrative').length,
    execution: getCaseTypesByCategory('execution').length,
    bankruptcy: getCaseTypesByCategory('bankruptcy').length,
    appeal: getCaseTypesByCategory('appeal').length,
    special: getCaseTypesByCategory('special').length,
    other: getCaseTypesByCategory('other').length,
  },
  byLevel: {
    '1심': getCaseTypesByLevel('1심').length,
    '항소심': getCaseTypesByLevel('항소심').length,
    '상고심': getCaseTypesByLevel('상고심').length,
    '재심': getCaseTypesByLevel('재심').length,
    '준재심': getCaseTypesByLevel('준재심').length,
    '신청': getCaseTypesByLevel('신청').length,
    '기타': getCaseTypesByLevel('기타').length,
  },
};
