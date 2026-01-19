/**
 * Unified Consultation System Types
 * Supports 4 consultation request types: callback, visit, video, info
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type RequestType = 'callback' | 'visit' | 'video' | 'info';

export type ConsultationStatus =
  | 'pending'           // New request, awaiting admin review
  | 'contacted'         // Admin has contacted customer
  | 'confirmed'         // Appointment confirmed (visit/video only)
  | 'payment_pending'   // Awaiting payment
  | 'payment_confirmed' // Payment confirmed by admin (입금확인)
  | 'payment_completed' // Payment fully processed
  | 'in_progress'       // Consultation in progress
  | 'completed'         // Consultation completed
  | 'cancelled'         // Cancelled by customer or admin
  | 'no_show';          // Customer didn't show up (visit/video only)

// 동적 타입 - 테넌트 설정에서 가져옴
export type OfficeLocation = string;
export type LawyerName = string;
export type PaymentMethod = 'card' | 'transfer' | 'cash' | 'free';
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'free';

// ============================================================================
// BASE INTERFACES
// ============================================================================

/**
 * Base consultation interface (common fields for all types)
 */
interface BaseConsultation {
  id: string;
  created_at: string;
  updated_at: string;

  // Core fields
  request_type: RequestType;
  status: ConsultationStatus;
  name: string;
  phone: string;
  email?: string | null;
  category?: string | null;
  message?: string | null;

  // Lawyer assignment
  preferred_lawyer?: LawyerName | null;
  assigned_lawyer?: LawyerName | null;

  // Payment (future use)
  consultation_fee?: number | null;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus | null;
  paid_at?: string | null;
  payment_transaction_id?: string | null;

  // Admin fields
  admin_notes?: string | null;
  contacted_at?: string | null;
  confirmed_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;

  // Metadata
  source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  lead_score?: number | null;
}

// ============================================================================
// CONSULTATION TYPE INTERFACES (Discriminated Union)
// ============================================================================

/**
 * Callback consultation - Simple phone callback request
 */
export interface CallbackConsultation extends BaseConsultation {
  request_type: 'callback';
  // No scheduling fields required
}

/**
 * Visit consultation - In-person consultation at office
 */
export interface VisitConsultation extends BaseConsultation {
  request_type: 'visit';
  preferred_date: string;
  preferred_time: string;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  office_location: OfficeLocation;
}

/**
 * Video consultation - Online consultation via Zoom/Meet
 */
export interface VideoConsultation extends BaseConsultation {
  request_type: 'video';
  preferred_date: string;
  preferred_time: string;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  video_link?: string | null;
}

/**
 * Info consultation - Information request only (no follow-up)
 */
export interface InfoConsultation extends BaseConsultation {
  request_type: 'info';
  // No scheduling or follow-up needed
}

/**
 * Discriminated union of all consultation types
 */
export type Consultation =
  | CallbackConsultation
  | VisitConsultation
  | VideoConsultation
  | InfoConsultation;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isCallbackConsultation(c: Consultation): c is CallbackConsultation {
  return c.request_type === 'callback';
}

export function isVisitConsultation(c: Consultation): c is VisitConsultation {
  return c.request_type === 'visit';
}

export function isVideoConsultation(c: Consultation): c is VideoConsultation {
  return c.request_type === 'video';
}

export function isInfoConsultation(c: Consultation): c is InfoConsultation {
  return c.request_type === 'info';
}

export function isScheduledConsultation(c: Consultation): c is VisitConsultation | VideoConsultation {
  return c.request_type === 'visit' || c.request_type === 'video';
}

export function requiresPayment(c: Consultation): boolean {
  return (c.consultation_fee || 0) > 0;
}

export function isPaid(c: Consultation): boolean {
  return c.payment_status === 'completed';
}

// ============================================================================
// CREATE INPUT TYPES
// ============================================================================

export interface CreateCallbackInput {
  request_type: 'callback';
  name: string;
  phone: string;
  email?: string;
  category?: string;
  message?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface CreateVisitInput {
  request_type: 'visit';
  name: string;
  phone: string;
  email?: string;
  category?: string;
  message?: string;
  preferred_date: string;  // YYYY-MM-DD format
  preferred_time: string;  // HH:MM format
  office_location: OfficeLocation;
  preferred_lawyer?: LawyerName;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface CreateVideoInput {
  request_type: 'video';
  name: string;
  phone: string;
  email?: string;
  category?: string;
  message?: string;
  preferred_date: string;  // YYYY-MM-DD format
  preferred_time: string;  // HH:MM format
  preferred_lawyer?: LawyerName;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface CreateInfoInput {
  request_type: 'info';
  name: string;
  phone: string;
  email?: string;
  category?: string;
  message?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export type CreateConsultationInput =
  | CreateCallbackInput
  | CreateVisitInput
  | CreateVideoInput
  | CreateInfoInput;

// ============================================================================
// UPDATE INPUT TYPES
// ============================================================================

export interface UpdateConsultationInput {
  status?: ConsultationStatus;
  assigned_to?: string;  // UUID (tenant_members.id 참조)
  case_id?: string | null;
  preferred_date?: string | null;  // 스키마에서 confirmed_date 대신 preferred_date 사용
  preferred_time?: string | null;  // 스키마에서 confirmed_time 대신 preferred_time 사용
  video_link?: string;
  admin_notes?: string;
  cancellation_reason?: string;
  office_location?: OfficeLocation;
  source?: string;

  // Payment fields (future use)
  consultation_fee?: number;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_transaction_id?: string;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface ConsultationFilters {
  request_type?: RequestType;
  status?: ConsultationStatus;
  assigned_to?: string;  // UUID (tenant_members.id 참조) - 스키마에서 assigned_lawyer 대신 사용
  date_from?: string;  // ISO date string
  date_to?: string;    // ISO date string
  office_location?: OfficeLocation;
  payment_status?: PaymentStatus;
  search?: string;     // Search in name, phone, email, message
  source?: string;     // Filter by consultation source
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface ConsultationStats {
  total: number;
  pending: number;
  contacted: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byType: Record<RequestType, number>;
  byStatus: Record<ConsultationStatus, number>;
  byLawyer: Record<string, number>;  // 동적 변호사명
  revenue: number;  // Total revenue from paid consultations
  avgLeadScore: number;
}

// ============================================================================
// DISPLAY LABELS & COLORS
// ============================================================================

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  callback: '콜백 요청',
  visit: '방문 상담',
  video: '화상 상담',
  info: '정보 문의',
};

export const REQUEST_TYPE_COLORS: Record<RequestType, string> = {
  callback: 'bg-blue-100 text-blue-800',
  visit: 'bg-green-100 text-green-800',
  video: 'bg-purple-100 text-purple-800',
  info: 'bg-gray-100 text-gray-800',
};

export const STATUS_LABELS: Record<ConsultationStatus, string> = {
  pending: '대기중',
  contacted: '연락완료',
  confirmed: '확정',
  payment_pending: '결제대기',
  payment_confirmed: '입금확인',
  payment_completed: '결제완료',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

export const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  payment_pending: 'bg-orange-100 text-orange-800',
  payment_confirmed: 'bg-teal-100 text-teal-800',
  payment_completed: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-200 text-red-900',
};

// 하드코딩된 상수 제거됨 - 테넌트 설정에서 동적으로 가져옴
// OFFICE_LOCATIONS -> tenant_settings.consultations.officeLocations
// LAWYER_NAMES -> tenant_members (role='lawyer') 에서 조회

// 기본 카테고리 (테넌트 설정에서 오버라이드 가능)
export const DEFAULT_CONSULTATION_CATEGORIES = [
  { value: 'alimony', label: '위자료' },
  { value: 'property', label: '재산분할' },
  { value: 'custody', label: '양육권' },
  { value: 'adultery', label: '상간사건' },
  { value: 'consultation', label: '일반 상담' },
  { value: 'other', label: '기타' },
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format phone number to standard format (010-XXXX-XXXX)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Format date to Korean format (YYYY년 MM월 DD일)
 */
export function formatDateKorean(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * Format time to Korean format (오전/오후 HH:MM)
 */
export function formatTimeKorean(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours <= 12 ? hours : hours - 12;
  return `${period} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get status workflow next steps
 */
export function getNextStatuses(currentStatus: ConsultationStatus, requestType: RequestType): ConsultationStatus[] {
  const workflows: Record<ConsultationStatus, ConsultationStatus[]> = {
    pending: ['contacted', 'cancelled'],
    contacted: requestType === 'callback' ? ['completed', 'cancelled'] : ['confirmed', 'payment_pending', 'cancelled'],
    confirmed: ['payment_pending', 'payment_confirmed', 'in_progress', 'no_show', 'cancelled'],
    payment_pending: ['payment_confirmed', 'cancelled'],
    payment_confirmed: ['payment_completed', 'in_progress', 'cancelled'],
    payment_completed: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    no_show: ['confirmed'],  // Allow rescheduling after no-show
  };

  return workflows[currentStatus] || [];
}

/**
 * Validate status transition
 */
export function isValidStatusTransition(
  currentStatus: ConsultationStatus,
  newStatus: ConsultationStatus,
  requestType: RequestType
): boolean {
  const allowedStatuses = getNextStatuses(currentStatus, requestType);
  return allowedStatuses.includes(newStatus);
}
