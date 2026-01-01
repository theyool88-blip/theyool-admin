/**
 * Communication Module 타입 정의
 *
 * 의뢰인 커뮤니케이션 자동화 시스템
 */

// =====================================================
// 메시지 타입
// =====================================================

export interface ClientUpdate {
  id: string;
  caseId: string;
  clientId: string;
  clientName?: string;
  caseNumber?: string;

  // 메시지 정보
  type: UpdateType;
  subject: string;
  body: string;

  // 채널
  channel: MessageChannel;

  // 상태
  status: MessageStatus;

  // 메타데이터
  generatedAt: string;
  generatedBy: 'ai' | 'user';
  approvedAt?: string;
  approvedBy?: string;
  sentAt?: string;
  error?: string;
}

export type UpdateType =
  | 'hearing_reminder' // 기일 안내
  | 'deadline_reminder' // 기한 안내
  | 'submission_complete' // 서면 제출 완료
  | 'judgment_notice' // 판결/결정 안내
  | 'progress_report' // 정기 진행상황
  | 'payment_reminder' // 결제 안내
  | 'document_request' // 자료 요청
  | 'custom'; // 사용자 정의

export type MessageChannel = 'email' | 'sms' | 'kakao';
export type MessageStatus = 'draft' | 'approved' | 'sent' | 'failed';

// =====================================================
// 템플릿 타입
// =====================================================

export interface MessageTemplate {
  type: UpdateType;
  channel: MessageChannel;
  subject?: string; // 이메일용
  body: string;
  variables: string[]; // 사용 가능한 변수 목록
}

export interface TemplateVariables {
  // 의뢰인 정보
  clientName?: string;
  clientPhone?: string;

  // 사건 정보
  caseNumber?: string;
  caseName?: string;
  caseType?: string;

  // 기일 정보
  hearingDate?: string;
  hearingTime?: string;
  hearingType?: string;
  hearingTypeName?: string;
  courtName?: string;
  courtRoom?: string;

  // 기한 정보
  deadlineDate?: string;
  deadlineType?: string;
  deadlineTypeName?: string;
  daysRemaining?: number;

  // 서면 정보
  briefType?: string;
  submittedDate?: string;
  summary?: string;

  // 결제 정보
  totalAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;

  // 진행 상황
  caseStatus?: string;
  recentActivities?: string[];
  upcomingEvents?: string[];

  // 법무법인 정보
  lawFirmName?: string;
  lawyerName?: string;
  lawyerPhone?: string;
}

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface GenerateMessageRequest {
  caseId: string;
  type: UpdateType;
  channel?: MessageChannel;
  customContext?: Record<string, string>;
}

export interface GenerateMessageResponse {
  success: boolean;
  data?: ClientUpdate;
  error?: string;
}

export interface SendMessageRequest {
  messageId: string;
  channel?: MessageChannel;
}

export interface SendMessageResponse {
  success: boolean;
  sentAt?: string;
  error?: string;
}

export interface MessageListRequest {
  caseId?: string;
  clientId?: string;
  type?: UpdateType;
  status?: MessageStatus;
  limit?: number;
  offset?: number;
}

export interface MessageListResponse {
  success: boolean;
  data?: ClientUpdate[];
  count?: number;
  error?: string;
}
