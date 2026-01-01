/**
 * Planning Module 타입 정의
 *
 * 사건 우선순위 계산 및 작업 추천 시스템
 */

// =====================================================
// 우선순위 관련 타입
// =====================================================

export interface CasePriority {
  caseId: string;
  caseNumber: string;
  caseName: string;
  clientName?: string;

  // 종합 점수 (0-100)
  score: number;
  grade: 'A' | 'B' | 'C' | 'D'; // A: 긴급, B: 높음, C: 보통, D: 낮음

  // 세부 점수
  breakdown: {
    urgency: ScoreDetail; // 긴급도
    importance: ScoreDetail; // 중요도
    risk: ScoreDetail; // 리스크
  };

  // 리스크 플래그
  riskFlags: RiskFlag[];

  // 다음 기한
  nextDeadline?: {
    id: string;
    date: string;
    type: string;
    typeName: string;
    daysRemaining: number;
  };

  // 다음 기일
  nextHearing?: {
    id: string;
    date: string;
    type: string;
    typeName: string;
    daysRemaining: number;
    location?: string;
  };

  // 추천 작업
  recommendedActions: RecommendedAction[];
}

export interface ScoreDetail {
  score: number; // 0-100
  weight: number; // 가중치
  factors: string[]; // 점수 요인 설명
}

export interface RiskFlag {
  id: string;
  type: 'deadline' | 'hearing' | 'communication' | 'payment' | 'document';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestion?: string;
}

// =====================================================
// 작업 추천 관련 타입
// =====================================================

export interface RecommendedAction {
  id: string;
  type: ActionType;

  // 작업 정보
  title: string;
  description: string;

  // 우선순위
  priority: 'urgent' | 'high' | 'medium' | 'low';

  // 시간 정보
  deadline?: string;
  estimatedTime?: string; // "30분", "2시간"

  // 관련 정보
  relatedDeadlineId?: string;
  relatedHearingId?: string;
  caseId?: string;
  caseNumber?: string;

  // AI 지원 가능 여부
  aiAssist: {
    available: boolean;
    type?: 'draft' | 'research' | 'review' | 'generate' | 'communication';
    description?: string;
  };

  // 상태
  status: 'suggested' | 'accepted' | 'dismissed' | 'completed';
}

export type ActionType =
  | 'draft_brief' // 서면 작성
  | 'review_document' // 문서 검토
  | 'gather_evidence' // 증거 수집
  | 'client_communication' // 의뢰인 연락
  | 'prepare_hearing' // 기일 준비
  | 'file_submission' // 서류 제출
  | 'deadline_completion' // 기한 완료
  | 'payment_followup'; // 결제 확인

// =====================================================
// 내부 데이터 타입 (DB에서 가져온 데이터)
// =====================================================

export interface CaseData {
  id: string;
  caseNumber: string;
  caseName: string;
  caseType?: string;
  status?: string;
  clientId?: string;
  clientName?: string;
  contractDate?: string;

  // 기일 정보
  upcomingHearings: HearingInfo[];

  // 데드라인 정보
  pendingDeadlines: DeadlineInfo[];

  // 결제 정보
  paymentInfo?: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
  };

  // 활동 정보
  lastActivityDate?: string;
}

export interface HearingInfo {
  id: string;
  hearingType: string;
  hearingTypeName: string;
  hearingDate: string;
  daysUntil: number;
  location?: string;
  status: string;
}

export interface DeadlineInfo {
  id: string;
  deadlineType: string;
  deadlineTypeName: string;
  triggerDate: string;
  deadlineDate: string;
  daysUntil: number;
  status: string;
}

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface PriorityListRequest {
  tenantId?: string;
  limit?: number;
  minGrade?: 'A' | 'B' | 'C' | 'D';
}

export interface PriorityListResponse {
  success: boolean;
  data?: CasePriority[];
  error?: string;
}

export interface TaskRecommendationRequest {
  caseId?: string;
  tenantId?: string;
  limit?: number;
  types?: ActionType[];
}

export interface TaskRecommendationResponse {
  success: boolean;
  data?: RecommendedAction[];
  error?: string;
}
