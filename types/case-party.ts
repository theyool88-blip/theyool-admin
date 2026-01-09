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
