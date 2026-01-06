/**
 * 사건 당사자 관리 타입 정의
 * case_parties, case_representatives 테이블
 */

// 당사자 유형
export type PartyType =
  | "plaintiff"   // 원고
  | "defendant"   // 피고
  | "creditor"    // 채권자
  | "debtor"      // 채무자
  | "applicant"   // 신청인
  | "respondent"; // 피신청인

// 당사자 유형 라벨 매핑
export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  plaintiff: "원고",
  defendant: "피고",
  creditor: "채권자",
  debtor: "채무자",
  applicant: "신청인",
  respondent: "피신청인",
};

// 상대 당사자 유형 매핑
export const OPPOSITE_PARTY_TYPE: Record<PartyType, PartyType> = {
  plaintiff: "defendant",
  defendant: "plaintiff",
  creditor: "debtor",
  debtor: "creditor",
  applicant: "respondent",
  respondent: "applicant",
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

  // 수임료 배분 (금액 기준)
  fee_allocation_amount: number | null;

  // SCOURT 연동
  scourt_synced: boolean;
  scourt_party_index: number | null;
  adjdoc_rch_ymd: string | null;   // 판결도달일
  indvd_cfmtn_ymd: string | null;  // 확정일

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
  fee_allocation_amount?: number | null;
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
  fee_allocation_amount?: number | null;
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

// 유틸리티: SCOURT 당사자 구분명 → PartyType 변환
export function mapScourtPartyType(btprDvsNm: string): PartyType {
  const mapping: Record<string, PartyType> = {
    "원고": "plaintiff",
    "피고": "defendant",
    "채권자": "creditor",
    "채무자": "debtor",
    "신청인": "applicant",
    "피신청인": "respondent",
    // 추가 매핑
    "항소인": "plaintiff",
    "피항소인": "defendant",
    "상고인": "plaintiff",
    "피상고인": "defendant",
    "재항고인": "plaintiff",
    "상대방": "defendant",
    "청구인": "applicant",
    "피청구인": "respondent",
  };

  return mapping[btprDvsNm] || "plaintiff";
}

// 유틸리티: PartyType → 라벨
export function getPartyTypeLabel(partyType: PartyType): string {
  return PARTY_TYPE_LABELS[partyType] || partyType;
}

// 유틸리티: 상대 PartyType 가져오기
export function getOppositePartyType(partyType: PartyType): PartyType {
  return OPPOSITE_PARTY_TYPE[partyType] || "defendant";
}
