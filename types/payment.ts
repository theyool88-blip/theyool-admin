/**
 * 입금 관리 시스템 타입 정의
 * @description 멀티테넌트 SaaS 입금 내역 및 통계 관리
 */

// =====================================================
// 기본값 (테넌트 설정에서 오버라이드 가능)
// =====================================================

/**
 * 기본 수임료 카테고리
 * 테넌트 설정에서 추가/수정 가능
 */
export const DEFAULT_PAYMENT_CATEGORIES = [
  { value: '착수금', label: '착수금' },
  { value: '잔금', label: '잔금' },
  { value: '성공보수', label: '성공보수' },
  { value: '모든 상담', label: '모든 상담' },
  { value: '내용증명', label: '내용증명' },
  { value: '집행(소송비용)', label: '집행(소송비용)' },
  { value: '기타', label: '기타' },
  { value: '환불', label: '환불' },
] as const;

/**
 * 기본 영수증 유형
 * 테넌트 설정에서 추가/수정 가능
 */
export const DEFAULT_RECEIPT_TYPES = [
  { value: '현금영수증', label: '현금영수증' },
  { value: '카드결제', label: '카드결제' },
  { value: '세금계산서', label: '세금계산서' },
  { value: '현금', label: '현금' },
  { value: '네이버페이', label: '네이버페이' },
  { value: '자진발급', label: '자진발급' },
] as const;

// 동적 타입 - 테넌트 설정에서 가져옴
export type PaymentCategory = string;
export type ReceiptType = string;
export type OfficeLocation = string;

// =====================================================
// 호환성 상수 (레거시 지원)
// TODO: 프론트엔드를 동적 테넌트 설정으로 마이그레이션 후 삭제
// =====================================================

/**
 * @deprecated 테넌트 설정에서 동적으로 가져와야 함
 * 호환성을 위해 임시 유지
 */
export const PAYMENT_CATEGORIES = {
  RETAINER: '착수금',
  BALANCE: '잔금',
  SUCCESS_FEE: '성공보수',
  CONSULTATION: '모든 상담',
  CERT_CONTENT: '내용증명',
  LITIGATION_COST: '집행(소송비용)',
  OTHER: '기타',
  REFUND: '환불',
} as const;

/**
 * @deprecated 테넌트 설정에서 동적으로 가져와야 함
 * 호환성을 위해 임시 유지
 */
export const RECEIPT_TYPES = {
  CASH_RECEIPT: '현금영수증',
  CARD: '카드결제',
  TAX_INVOICE: '세금계산서',
  CASH: '현금',
  NAVER_PAY: '네이버페이',
  SELF_ISSUED: '자진발급',
} as const;

/**
 * @deprecated 테넌트 설정에서 동적으로 가져와야 함
 * 호환성을 위해 임시 유지
 */
export const OFFICE_LOCATIONS = {
  PYEONGTAEK: '평택',
  CHEONAN: '천안',
  LITIGATION_AID: '소송구조',
} as const;

// 레거시 라벨 매핑 (호환성)
export const PAYMENT_CATEGORY_LABELS: Record<string, string> = {
  '착수금': '착수금',
  '잔금': '잔금',
  '성공보수': '성공보수',
  '모든 상담': '모든 상담',
  '내용증명': '내용증명',
  '집행(소송비용)': '집행(소송비용)',
  '기타': '기타',
  '환불': '환불',
};

export const OFFICE_LOCATION_LABELS: Record<string, string> = {
  '평택': '평택',
  '천안': '천안',
  '소송구조': '소송구조',
};

export const RECEIPT_TYPE_LABELS: Record<string, string> = {
  '현금영수증': '현금영수증',
  '카드결제': '카드결제',
  '세금계산서': '세금계산서',
  '현금': '현금',
  '네이버페이': '네이버페이',
  '자진발급': '자진발급',
};

export const OFFICE_LOCATION_COLORS: Record<string, string> = {
  '평택': 'bg-emerald-100 text-emerald-800',
  '천안': 'bg-sky-100 text-sky-800',
  '소송구조': 'bg-amber-100 text-amber-800',
};

export const PAYMENT_CATEGORY_COLORS: Record<string, string> = {
  '착수금': 'bg-blue-100 text-blue-800',
  '잔금': 'bg-green-100 text-green-800',
  '성공보수': 'bg-purple-100 text-purple-800',
  '모든 상담': 'bg-amber-100 text-amber-800',
  '내용증명': 'bg-gray-100 text-gray-800',
  '집행(소송비용)': 'bg-orange-100 text-orange-800',
  '기타': 'bg-gray-100 text-gray-700',
  '환불': 'bg-red-100 text-red-800',
};

/**
 * 동적 지점 색상 생성
 */
export function getOfficeLocationColor(index: number): string {
  const colors = [
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-amber-100 text-amber-800',
    'bg-purple-100 text-purple-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
  ];
  return colors[index % colors.length];
}

// =====================================================
// 데이터베이스 테이블 타입
// =====================================================

/**
 * 입금 내역
 * 테이블: payments
 */
export interface Payment {
  id: string;
  created_at: string;
  updated_at: string;

  // 입금 기본 정보
  payment_date: string;  // ISO 8601 date (YYYY-MM-DD)
  depositor_name: string;
  amount: number;  // 원 단위 정수

  // 분류 정보
  office_location: OfficeLocation | null;
  payment_category: PaymentCategory;

  // 사건 연결
  case_id: string | null;
  case_name: string | null;

  // 의뢰인 연결 (직접)
  client_id: string | null;

  // 상담 연결
  consultation_id: string | null;

  // 영수증/세금 정보
  receipt_type: ReceiptType | null;
  receipt_issued_at: string | null;  // ISO 8601 datetime

  // 연락처 및 메모
  phone: string | null;
  memo: string | null;

  // 관리용
  admin_notes: string | null;
  imported_from_csv: boolean;

  // 정산 통합
  month_key: string | null;  // YYYY-MM
  is_confirmed: boolean;
  confirmed_at: string | null;  // ISO 8601 datetime
  confirmed_by: string | null;
}

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface CreatePaymentRequest {
  payment_date: string;  // YYYY-MM-DD
  depositor_name: string;
  amount: number;
  office_location?: OfficeLocation;
  payment_category: PaymentCategory;
  case_id?: string;
  case_name?: string;
  client_id?: string;  // 의뢰인 직접 연결
  consultation_id?: string;
  receipt_type?: ReceiptType;
  receipt_issued_at?: string;
  phone?: string;
  memo?: string;
  admin_notes?: string;
  is_confirmed?: boolean;
}

export interface UpdatePaymentRequest {
  payment_date?: string;
  depositor_name?: string;
  amount?: number;
  office_location?: OfficeLocation | null;
  payment_category?: PaymentCategory;
  case_id?: string | null;
  case_name?: string | null;
  client_id?: string | null;  // 의뢰인 직접 연결
  consultation_id?: string | null;
  receipt_type?: ReceiptType | null;
  receipt_issued_at?: string | null;
  phone?: string | null;
  memo?: string | null;
  admin_notes?: string | null;
  is_confirmed?: boolean;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
}

// =====================================================
// 통계 타입
// =====================================================

/**
 * 사무실별 통계 (동적 지점)
 */
export interface PaymentStatsByOffice {
  office_location: string;  // 동적 지점명 | '미지정'
  payment_category: PaymentCategory;
  payment_count: number;
  total_amount: number;
  avg_amount: number;
  first_payment: string;  // ISO date
  last_payment: string;   // ISO date
}

/**
 * 명목별 통계 (동적 지점별 집계 포함)
 */
export interface PaymentStatsByCategory {
  payment_category: PaymentCategory;
  payment_count: number;
  total_amount: number;
  avg_amount: number;
  // 동적 지점별 통계
  by_office: {
    [office: string]: {
      count: number;
      total: number;
    };
  };
  // 레거시 필드 (호환성) - TODO: 동적 지점으로 마이그레이션 후 삭제
  /** @deprecated by_office 사용 권장 */
  pyeongtaek_count: number;
  /** @deprecated by_office 사용 권장 */
  cheonan_count: number;
  /** @deprecated by_office 사용 권장 */
  pyeongtaek_total: number;
  /** @deprecated by_office 사용 권장 */
  cheonan_total: number;
}

/**
 * 월별 통계
 */
export interface PaymentStatsByMonth {
  month: string;  // ISO date (YYYY-MM-01)
  office_location: string;  // 동적 지점명 | '미지정'
  payment_category: PaymentCategory;
  payment_count: number;
  total_amount: number;
}

/**
 * 사건별 입금 합계
 */
export interface CasePaymentSummary {
  case_id: string;
  court_case_number: string;
  case_name: string;
  payment_count: number;
  total_amount: number;
  retainer_amount: number;      // 착수금
  balance_amount: number;        // 잔금
  success_fee_amount: number;    // 성공보수
  first_payment_date: string | null;
  last_payment_date: string | null;
}

/**
 * 상담별 입금 합계
 */
export interface ConsultationPaymentSummary {
  consultation_id: string;
  name: string;
  phone: string;
  request_type: string;
  payment_count: number;
  total_amount: number;
  first_payment_date: string | null;
  last_payment_date: string | null;
}

/**
 * 대시보드 전체 통계 (동적 지점 지원)
 */
export interface PaymentDashboardStats {
  total_amount: number;
  this_month_amount: number;
  last_month_amount: number;
  month_growth_rate: number;  // 전월 대비 증감률 (%)
  total_count: number;

  // 동적 지점별 통계
  by_office_amount: Record<string, number>;
  by_office_count: Record<string, number>;

  // 레거시 필드 (호환성) - TODO: 동적 지점으로 마이그레이션 후 삭제
  /** @deprecated by_office_amount 사용 권장 */
  pyeongtaek_amount: number;
  /** @deprecated by_office_amount 사용 권장 */
  cheonan_amount: number;
  /** @deprecated by_office_count 사용 권장 */
  pyeongtaek_count: number;
  /** @deprecated by_office_count 사용 권장 */
  cheonan_count: number;

  by_category: PaymentStatsByCategory[];
  by_office: PaymentStatsByOffice[];
  by_month: PaymentStatsByMonth[];
}

// =====================================================
// 필터 타입 (API 쿼리 파라미터)
// =====================================================

export interface PaymentListQuery {
  office_location?: OfficeLocation;
  payment_category?: PaymentCategory;
  case_id?: string;
  consultation_id?: string;
  from_date?: string;  // ISO date
  to_date?: string;    // ISO date
  depositor_name?: string;
  phone?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'payment_date' | 'amount' | 'created_at';
  sort_order?: 'asc' | 'desc';
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
 * 금액 포맷팅 (원화)
 */
export function formatCurrency(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

/**
 * 날짜 포맷팅 (한글)
 */
export function formatDateKorean(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 증감률 계산
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * 입금 유형 판별
 */
export function getPaymentType(payment: Payment): 'case' | 'consultation' | 'general' {
  if (payment.case_id) return 'case';
  if (payment.consultation_id) return 'consultation';
  return 'general';
}

/**
 * CSV 금액 파싱 ("3,245,000" → 3245000)
 */
export function parseCSVAmount(amountStr: string): number {
  return parseInt(amountStr.replace(/[^0-9]/g, ''), 10);
}

/**
 * 전화번호 포맷팅 (010-XXXX-XXXX)
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
 * 카테고리 색상 가져오기 (없으면 기본값)
 */
export function getCategoryColor(category: string): string {
  return PAYMENT_CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-700';
}
