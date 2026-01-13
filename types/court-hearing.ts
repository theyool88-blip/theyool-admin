/**
 * 법원 기일 관리 시스템 타입 정의
 * @description 법무법인 더율 이혼사건 기일 및 데드라인 관리
 */

// =====================================================
// ENUM 타입
// =====================================================

export const HEARING_TYPES = {
  HEARING_MAIN: 'HEARING_MAIN',
  HEARING_INTERIM: 'HEARING_INTERIM',
  HEARING_MEDIATION: 'HEARING_MEDIATION',
  HEARING_INVESTIGATION: 'HEARING_INVESTIGATION',
  HEARING_PARENTING: 'HEARING_PARENTING',
  HEARING_JUDGMENT: 'HEARING_JUDGMENT',
  HEARING_LAWYER_MEETING: 'HEARING_LAWYER_MEETING',
} as const;

export type HearingType = keyof typeof HEARING_TYPES;

export const DEADLINE_TYPES = {
  DL_APPEAL: 'DL_APPEAL',                       // 민사/가사소송 상소기간 (14일)
  DL_MEDIATION_OBJ: 'DL_MEDIATION_OBJ',         // 조정·화해 이의기간 (14일)
  DL_IMM_APPEAL: 'DL_IMM_APPEAL',               // 민사 즉시항고기간 (7일)
  DL_APPEAL_BRIEF: 'DL_APPEAL_BRIEF',           // 항소이유서 제출기한 (40일)
  DL_RETRIAL: 'DL_RETRIAL',                     // 재심의 소 제기기한 (30일)
  DL_CRIMINAL_APPEAL: 'DL_CRIMINAL_APPEAL',     // 형사 상소기간 (7일) - 형소법 §358
  DL_FAMILY_NONLIT: 'DL_FAMILY_NONLIT',         // 가사비송 즉시항고 (14일) - 가사소송법
  DL_PAYMENT_ORDER: 'DL_PAYMENT_ORDER',         // 지급명령 이의신청 (14일) - 민소법 §470
} as const;

export type DeadlineType = keyof typeof DEADLINE_TYPES;

export const HEARING_STATUS = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
} as const;

export type HearingStatus = keyof typeof HEARING_STATUS;

// 변론기일 결과 타입
export const HEARING_RESULT = {
  CONTINUED: 'CONTINUED',      // 속행
  CONCLUDED: 'CONCLUDED',      // 종결
  POSTPONED: 'POSTPONED',      // 연기
  DISMISSED: 'DISMISSED',      // 추정
} as const;

export type HearingResult = keyof typeof HEARING_RESULT;

export const DEADLINE_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
} as const;

export type DeadlineStatus = keyof typeof DEADLINE_STATUS;

// =====================================================
// 한글 라벨 매핑
// =====================================================

export const HEARING_TYPE_LABELS: Record<HearingType, string> = {
  HEARING_MAIN: '변론기일',
  HEARING_INTERIM: '사전·보전처분 심문기일',
  HEARING_MEDIATION: '조정기일',
  HEARING_INVESTIGATION: '조사기일',
  HEARING_PARENTING: '상담·교육·프로그램 기일',
  HEARING_JUDGMENT: '선고기일',
  HEARING_LAWYER_MEETING: '변호사미팅',
};

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  DL_APPEAL: '상소기간',
  DL_MEDIATION_OBJ: '조정·화해 이의기간',
  DL_IMM_APPEAL: '즉시항고기간',
  DL_APPEAL_BRIEF: '항소이유서 제출기한',
  DL_RETRIAL: '재심의 소 제기기한',
  DL_CRIMINAL_APPEAL: '형사 상소기간',
  DL_FAMILY_NONLIT: '가사비송 즉시항고',
  DL_PAYMENT_ORDER: '지급명령 이의신청',
};

export const HEARING_STATUS_LABELS: Record<HearingStatus, string> = {
  SCHEDULED: '예정',
  COMPLETED: '완료',
  POSTPONED: '연기',
  CANCELLED: '취소',
};

export const HEARING_RESULT_LABELS: Record<HearingResult, string> = {
  CONTINUED: '속행',
  CONCLUDED: '종결',
  POSTPONED: '연기',
  DISMISSED: '추정',
};

export const DEADLINE_STATUS_LABELS: Record<DeadlineStatus, string> = {
  PENDING: '대기 중',
  COMPLETED: '완료',
  OVERDUE: '기한 초과',
};

// =====================================================
// 세부 기일명 옵션 (대표 기일별)
// =====================================================

export const HEARING_DETAIL_OPTIONS: Record<HearingType, string[]> = {
  HEARING_MAIN: [
    '변론',
    '변론기일',
    '변론준비',
    '변론준비기일',
    '증인신문',
    '증인신문기일',
    '당사자신문',
    '당사자신문기일',
    '감정',
    '감정기일',
    '검증',
    '검증기일',
  ],
  HEARING_INTERIM: [
    '심문',
    '가처분',
    '가처분 심문기일',
    '가압류',
    '가압류 심문기일',
    '보전처분',
    '보전처분 심문기일',
  ],
  HEARING_MEDIATION: [
    '조정',
    '조정기일',
    '조정조치',
    '화해권고',
    '화해권고기일',
    '조정회부',
    '조정회부기일',
  ],
  HEARING_INVESTIGATION: [
    '조사',
    '면접조사',
    '사실조회',
    '사실조회기일',
    '현장조사',
    '현장조사기일',
    '자료제출기일',
  ],
  HEARING_PARENTING: [
    '상담',
    '교육',
    '양육상담',
    '양육상담기일',
    '부모교육',
    '부모교육기일',
    '면접교섭',
    '면접교섭 프로그램 기일',
  ],
  HEARING_JUDGMENT: [
    '선고',
    '선고기일',
    '판결선고',
    '판결선고기일',
    '결정선고',
    '결정선고기일',
  ],
  HEARING_LAWYER_MEETING: [
    '변호사 상담',
    '의뢰인 미팅',
    '사건 협의',
    '전략 회의',
  ],
};

// =====================================================
// 데이터베이스 테이블 타입
// =====================================================

/**
 * 불변기간 마스터 데이터
 * 테이블: deadline_types
 * 5개 고정 데이터 (법정 불변기간)
 */
export interface DeadlineTypeMaster {
  id: string;
  type: DeadlineType;
  name: string;
  days: number; // 기간 (일수)
  description: string | null;
  created_at: string;
}

/**
 * 법원 기일
 * 테이블: court_hearings
 */
export interface CourtHearing {
  id: string;
  case_id: string; // 사건 ID (legal_cases 참조, 필수)
  case_number: string | null; // 사건번호 (예: "2024드단12345", 선택적)
  hearing_type: HearingType;
  hearing_date: string; // 기일 일시 (ISO 8601 datetime)
  location: string | null; // 법정 (예: "서울가정법원 301호")
  judge_name: string | null; // 담당 판사 (deprecated - legal_cases.judge_name 사용 권장)
  report: string | null; // 재판기일 보고서
  result: HearingResult | null; // 변론기일 결과 (속행/종결/연기/추정)
  notes: string | null;
  status: HearingStatus;
  created_at: string;
  updated_at: string;
  // SCOURT 원본 데이터 (나의사건검색 동일 표시용)
  scourt_type_raw: string | null;    // SCOURT 원본 기일명 (예: "제1회 변론기일")
  scourt_result_raw: string | null;  // SCOURT 원본 결과 (예: "다음기일지정(2025.02.15)")
  hearing_sequence: number | null;   // 기일 회차 (1, 2, 3...)
}

/**
 * 사건별 데드라인
 * 테이블: case_deadlines
 *
 * 자동 계산: trigger_date와 deadline_type만 제공하면
 *           deadline_date와 deadline_datetime이 트리거로 자동 계산됨
 */
export interface CaseDeadline {
  id: string;
  case_id: string; // 사건 ID (legal_cases 참조, 필수)
  case_number: string | null; // 사건번호 (선택적)
  deadline_type: DeadlineType;
  trigger_date: string; // 기산일 (ISO 8601 date, YYYY-MM-DD)
  deadline_date: string; // 만료일 (자동 계산, ISO 8601 date)
  deadline_datetime: string; // 만료 일시 (자동 계산, ISO 8601 datetime)
  notes: string | null;
  status: DeadlineStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface CreateCourtHearingRequest {
  case_id: string; // 사건 ID (필수)
  case_number?: string; // 사건번호 (선택적)
  hearing_type: HearingType;
  hearing_date: string; // ISO 8601 datetime
  location?: string;
  judge_name?: string;
  notes?: string;
  status?: HearingStatus; // 기본값: SCHEDULED
}

export interface UpdateCourtHearingRequest {
  case_number?: string;
  hearing_type?: HearingType;
  hearing_date?: string;
  location?: string;
  judge_name?: string;
  notes?: string;
  status?: HearingStatus;
}

export interface CreateCaseDeadlineRequest {
  case_id: string; // 사건 ID (필수)
  case_number?: string; // 사건번호 (선택적)
  deadline_type: DeadlineType;
  trigger_date: string; // ISO 8601 date (YYYY-MM-DD)
  notes?: string;
  status?: DeadlineStatus; // 기본값: PENDING
}

export interface UpdateCaseDeadlineRequest {
  case_number?: string;
  deadline_type?: DeadlineType;
  trigger_date?: string; // 변경 시 deadline_date도 자동 재계산
  notes?: string;
  status?: DeadlineStatus;
  completed_at?: string | null;
}

// =====================================================
// VIEW 타입 (upcoming_hearings, urgent_deadlines)
// =====================================================

/**
 * 다가오는 법원 기일 (VIEW)
 * VIEW: upcoming_hearings
 * 용도: 향후 30일 이내 법원 기일 조회
 */
export interface UpcomingHearing extends CourtHearing {
  days_until_hearing: number; // 남은 일수
}

/**
 * 긴급 데드라인 (VIEW)
 * VIEW: urgent_deadlines
 * 용도: 7일 이내 만료 데드라인 조회
 */
export interface UrgentDeadline extends CaseDeadline {
  deadline_type_name: string; // 데드라인 한글명
  days_until_deadline: number; // 남은 일수
}

// =====================================================
// 필터 타입 (API 쿼리 파라미터)
// =====================================================

export interface CourtHearingListQuery {
  case_id?: string; // 사건 ID로 필터링
  case_number?: string; // 사건번호로 필터링 (하위호환)
  hearing_type?: HearingType;
  status?: HearingStatus;
  from_date?: string; // ISO 8601 date
  to_date?: string;   // ISO 8601 date
  limit?: number;
  offset?: number;
}

export interface CaseDeadlineListQuery {
  case_id?: string; // 사건 ID로 필터링
  case_number?: string; // 사건번호로 필터링 (하위호환)
  deadline_type?: DeadlineType;
  status?: DeadlineStatus;
  urgent_only?: boolean; // 7일 이내만 조회
  limit?: number;
  offset?: number;
}

// =====================================================
// API 응답 타입
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data?: T[];
  count?: number;
  error?: string;
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * D-day 표시 헬퍼
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return 'D-day';
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

/**
 * 긴급도 판정 (7일 이내)
 */
export function isUrgent(daysUntil: number): boolean {
  return daysUntil >= 0 && daysUntil <= 7;
}

/**
 * 기한초과 판정
 */
export function isOverdue(daysUntil: number): boolean {
  return daysUntil < 0;
}
