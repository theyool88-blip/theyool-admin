/**
 * 의뢰인 포털 미리보기 관련 타입 정의
 * @description 관리자가 의뢰인 포털 화면을 미리보기 위한 API 응답 타입
 */

// ============================================================================
// Client Preview - 의뢰인 포털 미리보기
// ============================================================================

export interface ClientInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birth_date?: string;
  resident_number?: string;
  bank_account?: string;
  client_type?: 'individual' | 'corporation';
  company_name?: string;
  registration_number?: string;
}

export interface CaseInfo {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
}

export interface UpcomingHearing {
  id: string;
  hearing_date: string;
  hearing_time: string | null;
  court_name: string | null;
  case_number: string;
  case_name: string;
}

export interface UpcomingDeadline {
  id: string;
  deadline_date: string;
  deadline_type: string;
  description: string;
  case_name: string;
}

export interface ClientPreviewResponse {
  success: true;
  client: ClientInfo;
  cases: CaseInfo[];
  upcomingHearings: UpcomingHearing[];
  upcomingDeadlines: UpcomingDeadline[];
}

// ============================================================================
// Case Detail - 사건 상세 정보
// ============================================================================

export interface CaseDetail {
  id: string;
  case_name: string;
  contract_number: string;
  case_type: string;
  status: string;
  office: string;
  contract_date: string;
  created_at: string;
}

export interface Hearing {
  id: string;
  hearing_date: string;
  hearing_time: string | null;
  court_name: string | null;
  hearing_type: string | null;
  hearing_result: string | null;
  judge_name: string | null;
  hearing_report: string | null;
  case_number: string | null;
}

export interface Deadline {
  id: string;
  deadline_date: string;
  deadline_type: string | null;
  description: string | null;
  is_completed: boolean;
}

export interface CaseDetailResponse {
  success: true;
  case: CaseDetail;
  hearings: Hearing[];
  deadlines: Deadline[];
}

// ============================================================================
// Error Response
// ============================================================================

export interface ErrorResponse {
  error: string;
}
