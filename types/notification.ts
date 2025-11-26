/**
 * 알림 시스템 타입 정의
 */

// 발송 채널
export type NotificationChannel = 'sms' | 'kakao_alimtalk';

// 템플릿 카테고리
export type TemplateCategory =
  | 'hearing_reminder'      // 재판기일 알림
  | 'consultation_reminder' // 상담 리마인더
  | 'deadline_reminder'     // 기한 마감 알림
  | 'manual';               // 수동 발송

// 발송 상태
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

// 메시지 타입
export type MessageType = 'SMS' | 'LMS';

// 수신자 유형
export type RecipientType = 'client' | 'consultation';

// 관련 타입
export type RelatedType = 'hearing' | 'consultation' | 'deadline' | 'case';

/**
 * 알림 템플릿
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  category: TemplateCategory;
  title?: string;               // 알림톡용 제목
  content: string;
  variables: string[];          // 사용 가능한 변수 목록
  message_type: MessageType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 알림 발송 이력
 */
export interface NotificationLog {
  id: string;
  template_id?: string;

  // 수신자 정보
  recipient_type: RecipientType;
  recipient_id?: string;
  recipient_phone: string;
  recipient_name?: string;

  // 발송 정보
  channel: NotificationChannel;
  message_type: MessageType;
  content: string;

  // 상태 정보
  status: NotificationStatus;
  error_message?: string;
  provider_message_id?: string;
  cost?: number;

  // 연관 정보
  related_type?: RelatedType;
  related_id?: string;

  // 시간 정보
  sent_at?: string;
  delivered_at?: string;
  created_at: string;

  // 조인된 데이터
  template?: NotificationTemplate;
}

/**
 * 자동 발송 설정
 */
export interface NotificationSchedule {
  id: string;
  category: TemplateCategory;
  template_id?: string;
  days_before: number;
  time_of_day: string;          // HH:mm 형식
  is_active: boolean;
  channel: NotificationChannel | 'both';
  created_at: string;
  updated_at: string;

  // 조인된 데이터
  template?: NotificationTemplate;
}

/**
 * 템플릿 생성/수정 요청
 */
export interface CreateTemplateRequest {
  name: string;
  channel: NotificationChannel;
  category: TemplateCategory;
  title?: string;
  content: string;
  variables?: string[];
  message_type?: MessageType;
  is_active?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id: string;
}

/**
 * 수동 발송 요청
 */
export interface SendNotificationRequest {
  template_id?: string;         // 템플릿 사용시
  custom_content?: string;      // 직접 입력시
  channel: NotificationChannel;
  recipients: {
    type: RecipientType;
    id?: string;
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }[];
  related_type?: RelatedType;
  related_id?: string;
}

/**
 * 발송 이력 필터
 */
export interface NotificationLogFilters {
  status?: NotificationStatus;
  channel?: NotificationChannel;
  recipient_type?: RecipientType;
  related_type?: RelatedType;
  date_from?: string;
  date_to?: string;
  search?: string;              // 이름 또는 전화번호 검색
}

/**
 * 발송 결과
 */
export interface SendResult {
  success: boolean;
  message_id?: string;
  error?: string;
  cost?: number;
}

/**
 * 템플릿 변수 치환 결과
 */
export interface RenderedMessage {
  content: string;
  message_type: MessageType;
  title?: string;
}

/**
 * 발송 통계
 */
export interface NotificationStatistics {
  date: string;
  channel: NotificationChannel;
  total_sent: number;
  delivered: number;
  sent: number;
  failed: number;
  total_cost: number;
}

/**
 * 카테고리별 라벨
 */
export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  hearing_reminder: '재판기일 알림',
  consultation_reminder: '상담 리마인더',
  deadline_reminder: '기한 마감 알림',
  manual: '수동 발송',
};

/**
 * 채널별 라벨
 */
export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  sms: 'SMS',
  kakao_alimtalk: '카카오 알림톡',
};

/**
 * 상태별 라벨
 */
export const STATUS_LABELS: Record<NotificationStatus, string> = {
  pending: '대기',
  sent: '발송',
  delivered: '전달',
  failed: '실패',
};

/**
 * 상태별 색상
 */
export const STATUS_COLORS: Record<NotificationStatus, string> = {
  pending: 'text-yellow-600 bg-yellow-50',
  sent: 'text-blue-600 bg-blue-50',
  delivered: 'text-green-600 bg-green-50',
  failed: 'text-red-600 bg-red-50',
};
