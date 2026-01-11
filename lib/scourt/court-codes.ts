import { getCaseCategoryByTypeName } from './case-type-codes';

/**
 * 대법원 나의사건검색 법원코드 매핑
 * 출처: https://github.com/iicdii/case-ing
 * 총 207개 법원
 */

export const COURT_CODES: Record<string, string> = {
  '가평군법원': '214803',
  '강릉지원': '000261',
  '강진군법원': '512951',
  '강화군법원': '240811',
  '거제시법원': '422931',
  '거창지원': '000424',
  '경산시법원': '310895',
  '고령군법원': '310896',
  '고성군법원': '263848',
  '고성군법원(경)': '422932',
  '고양지원': '214807',
  '고창군법원': '522977',
  '고흥군법원': '513953',
  '곡성군법원': '510941',
  '광명시법원': '250825',
  '광양시법원': '513956',
  '광주고등법원': '000500',
  '광주고등법원(전주재판부)': '000502',
  '광주고등법원(제주재판부)': '000501',
  '광주시법원': '251827',
  '광주가정법원': '000515',
  '광주가정법원 목포지원': '000599',
  '광주가정법원 순천지원': '000591',
  '광주가정법원 장흥지원': '000590',
  '광주가정법원 해남지원': '000592',
  '광주지방법원': '000510',
  '광주지방법원 목포지원': '000511',
  '광주지방법원 장흥지원': '000512',
  '광주지방법원 순천지원': '000513',
  '광주지방법원 해남지원': '000514',
  '괴산군법원': '270862',
  '구례군법원': '513955',
  '구미시법원': '313901',
  '군산지원': '000521',
  '군위군법원': '315905',
  '금산군법원': '280872',
  '김제시법원': '520972',
  '김포시법원': '240812',
  '김해시법원': '420923',
  '나주시법원': '510943',
  '남양주시법원': '214804',
  '남원지원': '000523',
  '남해군법원': '421928',
  '단양군법원': '272865',
  '담양군법원': '510946',
  '당진시법원': '285881',
  '대구가정법원': '000318',
  '대구가정법원 경주지원': '000390',
  '대구가정법원 김천지원': '000391',
  '대구가정법원 상주지원': '000392',
  '대구가정법원 안동지원': '000399',
  '대구가정법원 의성지원': '000393',
  '대구가정법원 영덕지원': '000394',
  '대구가정법원 포항지원': '000395',
  '대구고등법원': '000300',
  '대구지방법원': '000310',
  '대구지방법원 안동지원': '000311',
  '대구지방법원 경주지원': '000312',
  '대구지방법원 포항지원': '000317',
  '대구지방법원 김천지원': '000313',
  '대구지방법원 상주지원': '000314',
  '대구지방법원 의성지원': '000315',
  '대구지방법원 영덕지원': '000316',
  '대구지방법원 서부지원': '000320',
  '대법원': '000100',
  '대전가정법원': '000286',
  '대전가정법원 공주지원': '000295',
  '대전가정법원 논산지원': '000293',
  '대전가정법원 서산지원': '000296',
  '대전가정법원 천안지원': '000294',
  '대전가정법원 홍성지원': '000292',
  '대전고등법원': '000600',
  '대전고등법원(청주재판부)': '000601',
  '대전지방법원': '000280',
  '대전지방법원 홍성지원': '000281',
  '대전지방법원 공주지원': '000284',
  '대전지방법원 논산지원': '000282',
  '대전지방법원 서산지원': '000285',
  '대전지방법원 천안지원': '000283',
  '대전지방법원 아산시법원': '283877',
  '동두천시법원': '214808',
  '동해시법원': '261846',
  '마산지원': '000431',
  '무안군법원': '511949',
  '무주군법원': '520973',
  '문경시법원': '314903',
  '밀양지원': '000423',
  '법원행정처': '000110',
  '보령시법원': '281874',
  '보성군법원': '513952',
  '보은군법원': '270861',
  '봉화군법원': '311898',
  '부산고등법원': '000400',
  '부산고등법원(울산재판부)': '000402',
  '부산고등법원(창원재판부)': '000401',
  '부산지방법원': '000410',
  '부산지방법원 동부지원': '000412',
  '부산지방법원 서부지원': '000414',
  '부산가정법원': '000413',
  '부안군법원': '522976',
  '부여군법원': '282876',
  '사천시법원': '421927',
  '산청군법원': '421929',
  '삼척시법원': '261845',
  '서귀포시법원': '530991',
  '서울가정법원': '000230',
  '서울고등법원': '000200',
  '서울고등법원(춘천재판부)': '000201',
  '서울고등법원(인천재판부)': '000202',
  '서울남부지방법원': '000212',
  '서울동부지방법원': '000211',
  '서울북부지방법원': '000213',
  '서울서부지방법원': '000215',
  '서울중앙지방법원': '000210',
  '서울행정법원': '000220',
  '서울회생법원': '000221',
  '서천군법원': '281873',
  '성남지원': '000251',
  '성주군법원': '310894',
  '세종특별자치시법원': '280871',
  '속초지원': '000263',
  '수원가정법원': '000302',
  '수원가정법원 성남지원': '000303',
  '수원가정법원 안산지원': '000322',
  '수원가정법원 안양지원': '000306',
  '수원가정법원 여주지원': '000304',
  '수원가정법원 평택지원': '000305',
  '수원고등법원': '000800',
  '수원지방법원': '000250',
  '수원지방법원 평택지원': '000253',
  '수원지방법원 안성시법원': '250821',
  '순창군법원': '523979',
  '아산시법원': '283877',
  '안산지원': '250826',
  '안성시법원': '250821',
  '안양지원': '000254',
  '양구군법원': '260843',
  '양산시법원': '411911',
  '양양군법원': '263849',
  '양평군법원': '252828',
  '여수시법원': '513954',
  '여주지원': '000252',
  '연천군법원': '214805',
  '영광군법원': '510942',
  '영동지원': '000273',
  '영암군법원': '511948',
  '영양군법원': '316907',
  '영월지원': '000264',
  '영주시법원': '311897',
  '영천시법원': '310892',
  '예산군법원': '281875',
  '예천군법원': '314902',
  '오산시법원': '250824',
  '옥천군법원': '273866',
  '완도군법원': '514958',
  '용인시법원': '250823',
  '울산가정법원': '000477',
  '울산지방법원': '000411',
  '울진군법원': '316906',
  '원주지원': '000262',
  '음성군법원': '271864',
  '의령군법원': '420924',
  '의정부지방법원': '000214',
  '이천시법원': '252829',
  '익산시법원': '521975',
  '인제군법원': '260841',
  '인천가정법원': '000228',
  '인천가정법원 부천지원': '000229',
  '인천지방법원': '000240',
  '인천지방법원 부천지원': '000241',
  '임실군법원': '520974',
  '장성군법원': '510944',
  '장수군법원': '523978',
  '전주지방법원': '000520',
  '정선군법원': '264851',
  '정읍지원': '000522',
  '제주지방법원': '000530',
  '제천지원': '000272',
  '진도군법원': '514959',
  '진안군법원': '520971',
  '진주지원': '000421',
  '진천군법원': '270863',
  '창녕군법원': '423933',
  '창원남부시법원': '420922',
  '창원지방법원': '000420',
  '철원군법원': '214806',
  '청도군법원': '310891',
  '청송군법원': '315904',
  '청양군법원': '284878',
  '청주지방법원': '000270',
  '춘천지방법원': '000260',
  '충주지원': '000271',
  '칠곡군법원': '310893',
  '태백시법원': '264852',
  '태안군법원': '285879',
  '통영지원': '000422',
  '특허법원': '000700',
  '파주시법원': '214801',
  '평창군법원': '264853',
  '평택지원': '000253',
  '포천시법원': '214802',
  '하동군법원': '421926',
  '함안군법원': '420921',
  '함양군법원': '424935',
  '함평군법원': '511947',
  '합천군법원': '424934',
  '홍천군법원': '260842',
  '화순군법원': '510945',
  '화천군법원': '260844',
  '횡성군법원': '262847'
};

/**
 * 법원 축약명 → 정식명 매핑
 * 케이스노트 등 외부 시스템에서 사용하는 축약명을 정식명으로 변환
 */
export const COURT_ABBREV_MAP: Record<string, string> = {
  // 가정법원 축약
  '평택가정': '수원가정법원 평택지원',
  '천안가정': '대전가정법원 천안지원',
  '서산가정': '대전가정법원 서산지원',
  '공주가정': '대전가정법원 공주지원',
  '논산가정': '대전가정법원 논산지원',
  '홍성가정': '대전가정법원 홍성지원',
  '성남가정': '수원가정법원 성남지원',
  '안산가정': '수원가정법원 안산지원',
  '안양가정': '수원가정법원 안양지원',
  '여주가정': '수원가정법원 여주지원',
  '경주가정': '대구가정법원 경주지원',
  '김천가정': '대구가정법원 김천지원',
  '상주가정': '대구가정법원 상주지원',
  '안동가정': '대구가정법원 안동지원',
  '의성가정': '대구가정법원 의성지원',
  '영덕가정': '대구가정법원 영덕지원',
  '포항가정': '대구가정법원 포항지원',
  '목포가정': '광주가정법원 목포지원',
  '순천가정': '광주가정법원 순천지원',
  '장흥가정': '광주가정법원 장흥지원',
  '해남가정': '광주가정법원 해남지원',
  '부천가정': '인천가정법원 부천지원',

  // 고등법원 축약
  '수원고법': '수원고등법원',
  '서울고법': '서울고등법원',
  '대전고법': '대전고등법원',
  '대구고법': '대구고등법원',
  '부산고법': '부산고등법원',
  '광주고법': '광주고등법원',

  // 지방법원 축약
  '서울중앙지법': '서울중앙지방법원',
  '서울남부지법': '서울남부지방법원',
  '서울동부지법': '서울동부지방법원',
  '서울북부지법': '서울북부지방법원',
  '서울서부지법': '서울서부지방법원',
  '청주지법': '청주지방법원',
  '대전지법': '대전지방법원',
  '대구지법': '대구지방법원',
  '부산지법': '부산지방법원',
  '광주지법': '광주지방법원',
  '춘천지법': '춘천지방법원',
  '전주지법': '전주지방법원',
  '인천지법': '인천지방법원',
  '의정부지법': '의정부지방법원',
  '창원지법': '창원지방법원',
  '제주지법': '제주지방법원',
  '수원지법': '수원지방법원',
  '울산지법': '울산지방법원',

  // 회생법원 축약 (회생법원은 독립 법원이므로 정식명 = 축약명)
  // 인천회생법원, 청주회생법원 등은 아직 코드 미확인 - 추후 추가

  // 기타 지원 축약
  '평택지원': '수원지방법원 평택지원',
  '천안지원': '대전지방법원 천안지원',
  '공주지원': '대전지방법원 공주지원',
  '서산지원': '대전지방법원 서산지원',
  '논산지원': '대전지방법원 논산지원',
  '홍성지원': '대전지방법원 홍성지원',
  '여주지원': '수원지방법원 여주지원',
  '성남지원': '수원지방법원 성남지원',
  '안산지원': '수원지방법원 안산지원',
  '안양지원': '수원지방법원 안양지원',
  '아산시법원': '대전지방법원 천안지원 아산시법원',
  '순천지원': '광주지방법원 순천지원',
};

type ScourtCaseCategory =
  | 'family'
  | 'criminal'
  | 'civil'
  | 'application'
  | 'execution'
  | 'insolvency'
  | 'electronicOrder'
  | 'appeal'
  | 'protection'
  | 'contempt'
  | 'order'
  | 'other';

export interface CourtInfo {
  name: string;
  code: string;
}

function mapKorCategoryToEng(korCategory?: string): ScourtCaseCategory | undefined {
  if (!korCategory) return undefined;
  const categoryMap: Record<string, ScourtCaseCategory> = {
    '가사': 'family',
    '형사': 'criminal',
    '민사': 'civil',
    '신청': 'application',
    '집행': 'execution',
    '비송도산': 'insolvency',
    '전자약식': 'criminal',
    '가족관계등록공탁': 'family',
    '보호': 'other',
    '행정': 'other',
    '특허': 'other',
    '선거특별': 'other',
    '감치': 'other',
    '기타': 'other',
  };
  return categoryMap[korCategory] || 'other';
}

/**
 * 법원명 표준화 (정식명 반환)
 *
 * 입력된 축약명/부분명/코드를 사건유형에 맞는 정식 법원명으로 변환
 * 예: "평택지원" + 드단 → "수원가정법원 평택지원"
 */
export function getCourtFullName(courtName: string, caseType?: string): string {
  const trimmed = courtName?.trim();
  if (!trimmed) return trimmed;

  if (/^\d+$/.test(trimmed)) {
    const byCode = getCourtByCode(trimmed);
    return byCode?.name || trimmed;
  }

  const korCategory = caseType ? getCaseCategoryByTypeName(caseType) : undefined;
  const caseCategory = mapKorCategoryToEng(korCategory);

  if (caseCategory) {
    const categoryCode = getCourtCodeByNameAndCategory(trimmed, caseCategory);
    if (categoryCode) {
      const byCode = getCourtByCode(categoryCode);
      if (byCode?.name) return byCode.name;
    }
  }

  if (COURT_ABBREV_MAP[trimmed]) {
    return COURT_ABBREV_MAP[trimmed];
  }

  const code = getCourtCodeByName(trimmed);
  if (code) {
    const byCode = getCourtByCode(code);
    if (byCode?.name) return byCode.name;
  }

  return trimmed;
}

/**
 * 법원 목록 (UI 드롭다운용)
 */
export const COURTS: CourtInfo[] = Object.keys(COURT_CODES).map(name => ({
  name,
  code: COURT_CODES[name],
}));

/**
 * 법원명으로 코드 조회 (축약명 및 부분 매칭 지원)
 */
export function getCourtCodeByName(courtName: string): string | undefined {
  // 1. 정확한 매칭 우선
  if (COURT_CODES[courtName]) {
    return COURT_CODES[courtName];
  }

  // 2. 축약명 매핑 확인 (예: "평택가정" -> "수원가정법원 평택지원")
  const fullName = COURT_ABBREV_MAP[courtName];
  if (fullName && COURT_CODES[fullName]) {
    return COURT_CODES[fullName];
  }

  // 3. 부분 매칭 (예: "천안지원" -> "대전지방법원 천안지원")
  const matches = Object.keys(COURT_CODES).filter(name => name.includes(courtName));
  if (matches.length === 1) {
    return COURT_CODES[matches[0]];
  }

  // 4. 역방향 부분 매칭 (입력에 법원명이 포함된 경우)
  const reverseMatches = Object.keys(COURT_CODES).filter(name => courtName.includes(name));
  if (reverseMatches.length === 1) {
    return COURT_CODES[reverseMatches[0]];
  }

  return undefined;
}

/**
 * 사건유형(caseCategory)을 고려한 법원코드 조회
 *
 * 축약형 입력 + 사건유형으로 올바른 법원코드 반환
 * 예: "평택지원" + family → "평택가정" → 000305
 *     "평택지원" + civil → "평택지원" → 000253
 */
export function getCourtCodeByNameAndCategory(
  courtName: string,
  caseCategory?: string
): string | undefined {
  // 1. 가사(family) 사건인데 지방법원명이면 가정법원으로 변환
  if (caseCategory === 'family') {
    // "OO지방법원 XX지원" → "OO가정법원 XX지원"으로 변환 시도 (풀네임 먼저)
    const fullNameMatch = courtName.match(/^(.+)지방법원\s+(.+)지원$/);
    if (fullNameMatch) {
      const familyFullName = `${fullNameMatch[1]}가정법원 ${fullNameMatch[2]}지원`;
      const familyCode = getCourtCodeByName(familyFullName);
      if (familyCode) {
        console.log(`📍 가사사건 법원코드 변환: "${courtName}" → "${familyFullName}" → ${familyCode}`);
        return familyCode;
      }
    }

    // "XX지원" → "XX가정"으로 변환 시도 (축약형 - 공백 없는 단순 지원명만)
    const branchMatch = courtName.match(/^([^\s]+)지원$/);
    if (branchMatch) {
      const familyAbbrev = `${branchMatch[1]}가정`;
      const familyCode = getCourtCodeByName(familyAbbrev);
      if (familyCode) {
        console.log(`📍 가사사건 법원코드 변환: "${courtName}" → "${familyAbbrev}" → ${familyCode}`);
        return familyCode;
      }
    }
  }

  // 2. 민사/형사 사건인데 가정법원명이면 지방법원으로 변환
  if (caseCategory === 'civil' || caseCategory === 'criminal') {
    // "OO가정법원 XX지원" → "OO지방법원 XX지원"으로 변환 시도 (풀네임 먼저)
    const fullNameMatch = courtName.match(/^(.+)가정법원\s+(.+)지원$/);
    if (fullNameMatch) {
      const civilFullName = `${fullNameMatch[1]}지방법원 ${fullNameMatch[2]}지원`;
      const civilCode = getCourtCodeByName(civilFullName);
      if (civilCode) {
        console.log(`📍 민사사건 법원코드 변환: "${courtName}" → "${civilFullName}" → ${civilCode}`);
        return civilCode;
      }
    }

    // "XX가정" → "XX지원"으로 변환 시도 (축약형)
    const familyMatch = courtName.match(/^([^\s]+)가정$/);
    if (familyMatch) {
      const civilAbbrev = `${familyMatch[1]}지원`;
      const civilCode = getCourtCodeByName(civilAbbrev);
      if (civilCode) {
        console.log(`📍 민사사건 법원코드 변환: "${courtName}" → "${civilAbbrev}" → ${civilCode}`);
        return civilCode;
      }
    }
  }

  // 3. 기본 조회 (변환 없이)
  return getCourtCodeByName(courtName);
}

/**
 * 코드로 법원 정보 조회
 */
export function getCourtByCode(code: string): CourtInfo | undefined {
  const entry = Object.entries(COURT_CODES).find(([, c]) => c === code);
  if (entry) {
    return { name: entry[0], code: entry[1] };
  }
  return undefined;
}

/**
 * 이름으로 법원 정보 조회
 */
export function getCourtByName(name: string): CourtInfo | undefined {
  if (COURT_CODES[name]) {
    return { name, code: COURT_CODES[name] };
  }
  // 부분 매칭
  const code = getCourtCodeByName(name);
  if (code) {
    const fullName = Object.keys(COURT_CODES).find(n => COURT_CODES[n] === code);
    if (fullName) {
      return { name: fullName, code };
    }
  }
  return undefined;
}

/**
 * 법원 검색
 */
export function searchCourts(query: string): CourtInfo[] {
  return COURTS.filter(court => court.name.includes(query));
}

/**
 * 정식명 → 약어 변환 (UI 표시용)
 *
 * 규칙:
 * - 가정법원 지원: "수원가정법원 평택지원" → "평택가정"
 * - 지방법원 지원: "수원지방법원 평택지원" → "평택지원"
 * - 고등법원: "서울고등법원" → "서울고법"
 * - 본원: "서울가정법원" → "서울가정"
 *
 * 저장/API 호출 시에는 정식명을 그대로 사용해야 함
 */
export function getCourtAbbrev(fullName: string | null | undefined): string {
  if (!fullName) return '';

  // 1. COURT_ABBREV_MAP 역방향 조회 (기존 약어 매핑 활용)
  const entry = Object.entries(COURT_ABBREV_MAP).find(([, full]) => full === fullName);
  if (entry) return entry[0];

  // 2. 패턴 기반 약어 생성

  // 2-1. 가정법원 지원: "OO가정법원 XX지원" → "XX가정"
  const familyBranchMatch = fullName.match(/(.+)가정법원\s+(.+)지원/);
  if (familyBranchMatch) {
    return `${familyBranchMatch[2]}가정`;
  }

  // 2-2. 지방법원 지원: "OO지방법원 XX지원" → "XX지원"
  const civilBranchMatch = fullName.match(/(.+)지방법원\s+(.+)지원/);
  if (civilBranchMatch) {
    return `${civilBranchMatch[2]}지원`;
  }

  // 2-3. 고등법원: "OO고등법원" → "OO고법"
  const highCourtMatch = fullName.match(/(.+)고등법원/);
  if (highCourtMatch) {
    return `${highCourtMatch[1]}고법`;
  }

  // 2-4. 가정법원 본원: "OO가정법원" → "OO가정"
  const familyMainMatch = fullName.match(/(.+)가정법원$/);
  if (familyMainMatch) {
    return `${familyMainMatch[1]}가정`;
  }

  // 2-5. 지방법원 본원: "OO지방법원" → "OO지방"
  const civilMainMatch = fullName.match(/(.+)지방법원$/);
  if (civilMainMatch) {
    return `${civilMainMatch[1]}지방`;
  }

  // 3. 매핑 없으면 원본 반환
  return fullName;
}
