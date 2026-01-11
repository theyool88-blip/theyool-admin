/**
 * 사건 당사자 관리 타입 정의
 * case_parties, case_representatives 테이블
 */

// 당사자 유형
export type PartyType =
  | "plaintiff"     // 원고
  | "defendant"     // 피고
  | "creditor"      // 채권자
  | "debtor"        // 채무자
  | "applicant"     // 신청인
  | "respondent"    // 피신청인
  | "third_debtor"  // 제3채무자 (집행사건)
  // 보호사건 당사자 (2026.01.07 추가)
  | "actor"         // 행위자
  | "victim"        // 피해자/피해아동
  | "assistant"     // 보조인
  | "juvenile"      // 보호소년
  | "investigator"  // 조사관
  // 형사사건 당사자
  | "accused"       // 피고인
  | "crime_victim"  // 범죄피해자
  // 기타
  | "related";      // 관련자

// 당사자 유형 라벨 매핑
export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  plaintiff: "원고",
  defendant: "피고",
  creditor: "채권자",
  debtor: "채무자",
  applicant: "신청인",
  respondent: "피신청인",
  third_debtor: "제3채무자",
  // 보호사건 당사자 (2026.01.07 추가)
  actor: "행위자",
  victim: "피해아동",
  assistant: "보조인",
  juvenile: "보호소년",
  investigator: "조사관",
  // 형사사건 당사자
  accused: "피고인",
  crime_victim: "피해자",
  // 기타
  related: "관련자",
};

// 상대 당사자 유형 매핑
export const OPPOSITE_PARTY_TYPE: Record<PartyType, PartyType> = {
  plaintiff: "defendant",
  defendant: "plaintiff",
  creditor: "debtor",
  debtor: "creditor",
  applicant: "respondent",
  respondent: "applicant",
  third_debtor: "creditor",
  // 보호사건 당사자 (2026.01.07 추가)
  actor: "victim",
  victim: "actor",
  assistant: "actor",
  juvenile: "investigator",
  investigator: "juvenile",
  // 형사사건 당사자
  accused: "crime_victim",
  crime_victim: "accused",
  // 기타
  related: "related",
};

// 사건 당사자
export interface CaseParty {
  id: string;
  tenant_id: string;
  case_id: string;

  // 당사자 정보
  party_name: string;
  party_type: PartyType;
  party_type_label: string | null;
  party_order: number;

  // 의뢰인 연결
  client_id: string | null;
  is_our_client: boolean;

  // 수임료
  fee_allocation_amount: number | null;  // 착수금 (원)
  success_fee_terms: string | null;      // 성공보수 약정내용

  // SCOURT 연동
  scourt_synced: boolean;
  scourt_party_index: number | null;
  adjdoc_rch_ymd: string | null;   // 판결도달일
  indvd_cfmtn_ymd: string | null;  // 확정일
  manual_override: boolean;

  notes: string | null;
  created_at: string;
  updated_at: string;

  // 조인 데이터
  clients?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
}

// 사건 대리인
export interface CaseRepresentative {
  id: string;
  tenant_id: string;
  case_id: string;
  case_party_id: string | null;

  representative_name: string;
  representative_type_label: string | null;  // '원고 소송대리인', '피고 소송대리인' 등
  law_firm_name: string | null;
  is_our_firm: boolean;

  scourt_synced: boolean;
  manual_override: boolean;
  created_at: string;
}

// 당사자 생성 요청
export interface CreateCasePartyRequest {
  case_id: string;
  party_name: string;
  party_type: PartyType;
  party_type_label?: string;
  party_order?: number;
  client_id?: string | null;
  is_our_client?: boolean;
  fee_allocation_amount?: number | null;  // 착수금 (원)
  success_fee_terms?: string | null;      // 성공보수 약정내용
  notes?: string;
}

// 당사자 수정 요청
export interface UpdateCasePartyRequest {
  party_name?: string;
  party_type?: PartyType;
  party_type_label?: string;
  party_order?: number;
  client_id?: string | null;
  is_our_client?: boolean;
  fee_allocation_amount?: number | null;  // 착수금 (원)
  success_fee_terms?: string | null;      // 성공보수 약정내용
  notes?: string;
}

// 대리인 생성 요청
export interface CreateCaseRepresentativeRequest {
  case_id: string;
  case_party_id?: string | null;
  representative_name: string;
  representative_type_label?: string;
  law_firm_name?: string;
  is_our_firm?: boolean;
}

// SCOURT 당사자 데이터 (API 응답)
export interface ScourtParty {
  btprNm: string;       // 당사자명
  btprDvsNm: string;    // 당사자구분명 ('원고', '피고' 등)
  btprSn?: number;      // 당사자순번
}

// SCOURT 대리인 데이터 (API 응답)
export interface ScourtRepresentative {
  athrzNm: string;       // 대리인명
  athrzDvsNm: string;    // 대리인구분명 ('원고 소송대리인' 등)
  lawFirmNm?: string;    // 법무법인명
}

// 당사자 목록 응답
export interface CasePartiesResponse {
  parties: CaseParty[];
  representatives: CaseRepresentative[];
}

export function normalizePartyLabel(label?: string | null): string {
  if (!label) return "";
  const trimmed = label.trim();
  const withoutParens = trimmed.replace(/[\(\[].*$/, "").trim();
  const withoutTrailingDigits = withoutParens.replace(/\d+$/, "").trim();
  return withoutTrailingDigits;
}

// 유틸리티: SCOURT 당사자 구분명 → PartyType 변환
export function mapScourtPartyType(btprDvsNm: string): PartyType {
  const normalized = normalizePartyLabel(btprDvsNm);
  const mapping: Record<string, PartyType> = {
    "원고": "plaintiff",
    "피고": "defendant",
    "채권자": "creditor",
    "채무자": "debtor",
    "신청인": "applicant",
    "피신청인": "respondent",
    // 항소/상고심
    "항소인": "plaintiff",
    "피항소인": "defendant",
    "상고인": "plaintiff",
    "피상고인": "defendant",
    "재항고인": "plaintiff",
    "항고인": "plaintiff",
    "상대방": "defendant",
    "청구인": "applicant",
    "피청구인": "respondent",
    // 집행 사건
    "제3채무자": "third_debtor",
    "압류채권자": "creditor",
    // 보호사건 (2026.01.07 추가)
    "행위자": "actor",
    "피해아동": "victim",
    "피해자": "victim",
    "보조인": "assistant",
    "보호소년": "juvenile",
    "조사관": "investigator",
    // 형사사건
    "피고인": "accused",
    "피고인명": "accused",
    "검사": "plaintiff",
    "검사/항소인": "plaintiff",
    // 기타
    "관련자": "related",
    "소송관계인": "related",
    "사건본인": "related",
  };

  if (mapping[normalized]) return mapping[normalized];

  const fallbackLabel = normalized || btprDvsNm || "";
  const fallbackMappings: Array<[RegExp, PartyType]> = [
    [/피고인명|피고인/, "accused"],
    [/피신청인|피청구인/, "respondent"],
    [/피항소인|피상고인/, "defendant"],
    [/피고/, "defendant"],
    [/상대방/, "defendant"],
    [/항소인|상고인|재항고인|항고인/, "plaintiff"],
    [/원고/, "plaintiff"],
    [/신청인|청구인/, "applicant"],
    [/채권자/, "creditor"],
    [/채무자/, "debtor"],
    [/제3채무자/, "third_debtor"],
    [/압류채권자/, "creditor"],
    [/행위자/, "actor"],
    [/피해아동|피해자/, "victim"],
    [/보조인/, "assistant"],
    [/보호소년/, "juvenile"],
    [/조사관/, "investigator"],
    [/검사/, "plaintiff"],
    [/관련자|소송관계인|사건본인/, "related"],
  ];

  for (const [pattern, partyType] of fallbackMappings) {
    if (pattern.test(fallbackLabel)) {
      return partyType;
    }
  }

  return "plaintiff";
}

// 유틸리티: PartyType → 라벨
export function getPartyTypeLabel(partyType: PartyType): string {
  return PARTY_TYPE_LABELS[partyType] || partyType;
}

// 유틸리티: 상대 PartyType 가져오기
export function getOppositePartyType(partyType: PartyType): PartyType {
  return OPPOSITE_PARTY_TYPE[partyType] || "defendant";
}

const MASKED_NAME_TOKEN_REGEX = /[O○●*Xx□]/;
const MASKED_NAME_TOKEN_GLOBAL_REGEX = /[O○●*Xx□]/g;
const HANGUL_CHAR_REGEX = /[가-힣]/;

export function isMaskedPartyName(name: string): boolean {
  if (!name) return false;
  const cleaned = name.replace(/^\d+\.\s*/, "").trim();
  if (!cleaned) return false;
  if (!MASKED_NAME_TOKEN_REGEX.test(cleaned)) return false;

  const withoutMaskTokens = cleaned.replace(MASKED_NAME_TOKEN_GLOBAL_REGEX, "").replace(/\s+/g, "");
  if (!withoutMaskTokens) return true;

  return HANGUL_CHAR_REGEX.test(cleaned);
}

// ============================================================
// 사건유형별 당사자 라벨 매핑 (통합됨: lib/scourt/party-labels.ts)
// ============================================================

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
  default: { plaintiff: '원고', defendant: '피고' },
  criminal: { plaintiff: '', defendant: '피고인' },
  familyPreservation: { plaintiff: '채권자', defendant: '채무자' },
  familyNonlitigation: { plaintiff: '신청인', defendant: '피신청인' },
  application: { plaintiff: '신청인', defendant: '피신청인' },
  execution: { plaintiff: '채권자', defendant: '채무자' },
  familyProtection: { plaintiff: '행위자', defendant: '피해아동' },
  juvenileProtection: { plaintiff: '조사관', defendant: '보호소년' },
  appeal: { plaintiff: '항고인', defendant: '상대방' },
  insolvency: { plaintiff: '신청인', defendant: '채무자' },
  electronicOrder: { plaintiff: '채권자', defendant: '채무자' },
};

// 사건유형 패턴들
const CRIMINAL_PATTERNS = [
  '고단', '고합', '고약', '고정', '고약전',
  '노', '도', '로', '모', '오', '조', '초', '코', '토',
  '감고', '감노', '감도', '감로', '감모',
  '전고', '전노', '전도', '전로', '전모',
  '치고', '치노', '치도', '치로', '치모',
  '보고', '보노', '보도', '보로', '보모',
  '초재',
];

const FAMILY_PRESERVATION_PATTERNS = ['즈단', '즈합'];
const FAMILY_NONLITIGATION_PATTERNS = ['즈기', '느단', '느합', '후기', '후개'];
const APPEAL_PATTERNS = ['너', '브', '스', '마', '그'];
const APPLICATION_PATTERNS = [
  '카단', '카합', '카기', '카공', '카담', '카명', '카조', '카구',
  '카불', '카확', '카열', '카임', '카정', '카경', '카소', '아',
];
const EXECUTION_PATTERNS = ['타기', '타채', '타경', '타인', '타배'];
const FAMILY_PROTECTION_PATTERNS = [
  '동버', '동서', '동어', '동저', '버', '서', '어', '저',
  '동처', '동커', '동터', '처', '커', '터',
];
const JUVENILE_PROTECTION_PATTERNS = [
  '푸', '인', '인라', '인마', '인카', '성', '성로', '성모', '성초',
];
const INSOLVENCY_PATTERNS = [
  '개회', '개확', '하단', '하면', '하기', '하합', '하확',
  '회단', '회합', '회확', '간회단', '간회합',
];
const ELECTRONIC_ORDER_PATTERNS = ['차전', '차', '자'];

function extractCaseType(input: string): string {
  if (!input) return '';
  if (!/\d/.test(input.slice(0, 4))) return input;
  const match = input.match(/\d{4}([가-힣]+)\d+/);
  return match ? match[1] : input;
}

function matchesPattern(caseType: string, patterns: string[]): boolean {
  return patterns.some(pattern => caseType.includes(pattern));
}

/**
 * 사건유형/사건번호로 당사자 라벨 조회
 */
export function getPartyLabels(caseTypeOrNumber: string): PartyLabelsWithType {
  const caseType = extractCaseType(caseTypeOrNumber);

  if (matchesPattern(caseType, CRIMINAL_PATTERNS)) {
    return { ...PARTY_LABELS.criminal, isCriminal: true };
  }
  if (matchesPattern(caseType, APPEAL_PATTERNS)) {
    return { ...PARTY_LABELS.appeal, isCriminal: false };
  }
  if (matchesPattern(caseType, FAMILY_PRESERVATION_PATTERNS)) {
    return { ...PARTY_LABELS.familyPreservation, isCriminal: false };
  }
  if (matchesPattern(caseType, FAMILY_NONLITIGATION_PATTERNS)) {
    return { ...PARTY_LABELS.familyNonlitigation, isCriminal: false };
  }
  if (matchesPattern(caseType, APPLICATION_PATTERNS)) {
    return { ...PARTY_LABELS.application, isCriminal: false };
  }
  if (matchesPattern(caseType, INSOLVENCY_PATTERNS)) {
    return { ...PARTY_LABELS.insolvency, isCriminal: false };
  }
  if (matchesPattern(caseType, ELECTRONIC_ORDER_PATTERNS)) {
    return { ...PARTY_LABELS.electronicOrder, isCriminal: false };
  }
  if (matchesPattern(caseType, EXECUTION_PATTERNS)) {
    return { ...PARTY_LABELS.execution, isCriminal: false };
  }
  if (matchesPattern(caseType, FAMILY_PROTECTION_PATTERNS)) {
    return { ...PARTY_LABELS.familyProtection, isCriminal: false };
  }
  if (matchesPattern(caseType, JUVENILE_PROTECTION_PATTERNS)) {
    return { ...PARTY_LABELS.juvenileProtection, isCriminal: false };
  }

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

  if (['구', '누', '두', '아'].some(c => caseType.startsWith(c))) return '행정';
  if (['드', '르', '므'].some(c => caseType.startsWith(c))) return '가사소송';

  return '민사';
}

// ============================================================
// 당사자 치환 유틸리티 (단순화된 시스템)
// ============================================================

/**
 * 라벨(한글 지위) → SCOURT API 이름 필드 매핑
 *
 * 확정된 당사자의 라벨로 직접 필드를 찾아 치환
 * 예: "신청인" → rprsAplcntNm 필드에 확정된 이름 넣기
 */
export const LABEL_TO_NAME_FIELDS: Record<string, string[]> = {
  // 민사 - 일부 사건(증거보전 등)에서는 rprsPtnrNm/rprsRqstrNm 사용
  '원고': ['rprsClmntNm', 'clmntNm', 'rprsPtnrNm', 'aplNm'],
  '피고': ['rprsAcsdNm', 'acsdNm', 'dfndtNm', 'rprsRqstrNm', 'rspNm'],
  // 가사 (채권/채무)
  '채권자': ['rprsPtnrNm', 'ptnrNm'],
  '채무자': ['rprsRqstrNm', 'rqstrNm'],
  // 가사 (신청) - 증거보전 등 일부 사건은 rprsPtnrNm/rprsRqstrNm 사용
  '신청인': ['rprsAplcntNm', 'aplNm', 'aplcntNm', 'rprsPtnrNm'],
  '피신청인': ['rprsRspndnNm', 'rspNm', 'rprsRqstrNm'],
  // 항고/항소/상고
  '항고인': ['rprsAplcntNm', 'aplNm'],
  '상대방': ['rprsRspndnNm', 'rspNm', 'rprsRqstrNm'],
  '항소인': ['rprsClmntNm', 'clmntNm'],
  '피항소인': ['rprsAcsdNm', 'acsdNm'],
  '상고인': ['rprsClmntNm', 'clmntNm'],
  '피상고인': ['rprsAcsdNm', 'acsdNm'],
  // 집행
  '압류채권자': ['rprsGrnshNm'],
  '제3채무자': ['thrdDbtrNm'],
  // 형사
  '피고인': ['dfndtNm', 'acsFullNm', 'acsNm', 'acsdNm', 'btprtNm'],
  '피고인명': ['dfndtNm', 'acsFullNm', 'acsNm', 'acsdNm', 'btprtNm'],
  // 보호
  '행위자': ['rprsAplcntNm', 'btprtNm', 'hngwzNm', 'actorNm', 'offenderNm', 'pnshObjNm'],
  '보호소년': ['rprsRspndnNm', 'rspNm'],
  '피해아동': ['rprsRspndnNm', 'rspNm'],
  '피해자': ['rprsRspndnNm', 'rspNm'],
  // 청구
  '청구인': ['rprsAplcntNm'],
  '피청구인': ['rprsRspndnNm'],
};

/**
 * 라벨로 해당하는 이름 필드들 가져오기
 */
export function getNameFieldsByLabel(label: string): string[] {
  const normalized = normalizePartyLabel(label);
  return LABEL_TO_NAME_FIELDS[normalized] || [];
}

const PARTY_NAME_PREFIX_REGEX = /^\d+\.\s*/;
const PARTY_NAME_SUFFIX_REGEX = /\s*외\s*\d+\s*(?:명)?\s*$/;

/**
 * 당사자 이름에서 번호 prefix 제거
 * 예: "1. 이명규" → "이명규"
 */
export function normalizePartyName(name: string): string {
  if (!name) return '';
  return name.replace(PARTY_NAME_PREFIX_REGEX, '').trim();
}

/**
 * 당사자 이름 매칭용 정규화
 * - 번호 prefix 제거
 * - "외1/외 1/외1명" 같은 부가 표기 제거
 */
export function normalizePartyNameForMatch(name: string): string {
  if (!name) return '';
  return name
    .replace(PARTY_NAME_PREFIX_REGEX, '')
    .replace(PARTY_NAME_SUFFIX_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 번호 prefix 보존하며 이름 치환
 * 예: preservePrefix("1. 이OO", "이명규") → "1. 이명규"
 */
export function preservePrefix(originalValue: string, newName: string): string {
  if (!originalValue) return newName;
  const prefixMatch = originalValue.match(PARTY_NAME_PREFIX_REGEX);
  const suffixMatch = originalValue.match(PARTY_NAME_SUFFIX_REGEX);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const cleanedName = newName.replace(PARTY_NAME_SUFFIX_REGEX, '').trim();
  const combined = `${prefix}${cleanedName}${suffix}`;
  return combined.trim() || cleanedName;
}

/**
 * 확정된 당사자 정보 타입
 * 라벨(지위)과 이름만 있으면 됨 - side 개념 불필요
 */
export interface ConfirmedParty {
  label: string;        // "신청인", "피신청인" 등 (한글 지위)
  name: string;         // 마스킹 해제된 이름
  isClient: boolean;    // 의뢰인 여부
}
