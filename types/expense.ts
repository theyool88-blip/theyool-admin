// ============================================================================
// 법무법인 더율 - 지출 관리 시스템 타입 정의
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Constants & Enums
// ----------------------------------------------------------------------------

/**
 * 지출 카테고리 (대분류)
 */
export const EXPENSE_CATEGORIES = [
  '임대료',
  '인건비',
  '필수운영비',
  '마케팅비',
  '광고비',
  '세금',
  '식대',
  '구독료',
  '기타'
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

/**
 * 사무실 위치
 */
export const OFFICE_LOCATIONS = [
  '평택',
  '천안',
  '공통',
  '안쓰는 서비스'
] as const

export type OfficeLocation = typeof OFFICE_LOCATIONS[number]

/**
 * 변호사명 (파트너)
 */
export const PARTNER_NAMES = [
  '임은지',
  '김현성'
] as const

export type PartnerName = typeof PARTNER_NAMES[number]

/**
 * 인출 유형
 */
export const WITHDRAWAL_TYPES = [
  '입금',
  '카드',
  '현금',
  '법인지출'
] as const

export type WithdrawalType = typeof WITHDRAWAL_TYPES[number]

/**
 * 결제 수단
 */
export const PAYMENT_METHODS = [
  '카드',
  '현금',
  '계좌이체',
  '자동이체',
  '기타'
] as const

export type PaymentMethod = typeof PAYMENT_METHODS[number]

// ----------------------------------------------------------------------------
// 2. Database Table Interfaces
// ----------------------------------------------------------------------------

/**
 * expenses 테이블 인터페이스
 */
export interface Expense {
  // PK
  id: string
  created_at: string
  updated_at: string

  // 지출 기본 정보
  expense_date: string // DATE (YYYY-MM-DD)
  amount: number

  // 분류 정보
  expense_category: ExpenseCategory
  subcategory: string | null
  office_location: OfficeLocation | null

  // 고정 지출 관련
  is_recurring: boolean
  recurring_template_id: string | null

  // 상세 정보
  vendor_name: string | null
  memo: string | null
  receipt_url: string | null
  payment_method: PaymentMethod | null

  // 관리 정보
  paid_by: string | null
  created_by: string | null
  admin_notes: string | null

  // 정산 통합 (신규)
  month_key: string | null // YYYY-MM 형식
}

/**
 * recurring_templates 테이블 인터페이스
 */
export interface RecurringTemplate {
  // PK
  id: string
  created_at: string
  updated_at: string

  // 템플릿 정보
  name: string
  amount: number

  // 분류 정보
  expense_category: ExpenseCategory
  subcategory: string | null
  office_location: OfficeLocation | null

  // 상세 정보
  vendor_name: string | null
  payment_method: PaymentMethod | null
  memo: string | null

  // 반복 설정
  is_active: boolean
  start_date: string // DATE
  end_date: string | null // DATE
  day_of_month: number // 1-28

  // 관리 정보
  created_by: string | null
  admin_notes: string | null
}

/**
 * partner_withdrawals 테이블 인터페이스
 */
export interface PartnerWithdrawal {
  // PK
  id: string
  created_at: string
  updated_at: string

  // 인출 기본 정보
  withdrawal_date: string // DATE
  partner_name: PartnerName
  amount: number

  // 인출 유형
  withdrawal_type: WithdrawalType
  payment_method: PaymentMethod | null
  office_location: OfficeLocation | null

  // 정산 정보
  month_key: string // "YYYY-MM"
  settlement_id: string | null

  // 상세 정보
  description: string | null
  memo: string | null
  admin_notes: string | null
}

/**
 * monthly_settlements 테이블 인터페이스
 */
export interface MonthlySettlement {
  // PK
  id: string
  created_at: string
  updated_at: string

  // 정산 기간
  settlement_month: string // "YYYY-MM"

  // 수입 (payments 테이블에서 집계)
  total_revenue: number
  pyeongtaek_revenue: number
  cheonan_revenue: number

  // 지출 (expenses 테이블에서 집계)
  total_expenses: number
  pyeongtaek_expenses: number
  cheonan_expenses: number
  fixed_expenses: number
  marketing_expenses: number
  tax_expenses: number

  // 변호사별 인출
  kim_withdrawals: number
  lim_withdrawals: number

  // 순수익 (자동 계산 - GENERATED ALWAYS AS)
  net_profit: number
  kim_share: number
  lim_share: number

  // 실제 수령액 및 채권/채무 (자동 계산)
  kim_net_balance: number
  lim_net_balance: number

  // 누적 채권/채무
  kim_accumulated_debt: number
  lim_accumulated_debt: number

  // 정산 상태
  is_settled: boolean
  settled_at: string | null
  settled_by: string | null

  // 첨부 파일
  excel_file_url: string | null

  // 메모
  settlement_notes: string | null
  admin_notes: string | null
}

// ----------------------------------------------------------------------------
// 3. Form & Input Interfaces
// ----------------------------------------------------------------------------

/**
 * 지출 생성/수정 폼 데이터
 */
export interface ExpenseFormData {
  expense_date: string
  amount: number
  expense_category: ExpenseCategory | ''
  subcategory?: string
  office_location?: OfficeLocation | ''
  vendor_name?: string
  memo?: string
  payment_method?: PaymentMethod | ''
  paid_by?: string
  admin_notes?: string
}

/**
 * 고정 지출 템플릿 생성/수정 폼 데이터
 */
export interface RecurringTemplateFormData {
  name: string
  amount: number
  expense_category: ExpenseCategory | ''
  subcategory?: string
  office_location?: OfficeLocation | ''
  vendor_name?: string
  payment_method?: PaymentMethod | ''
  memo?: string
  is_active: boolean
  start_date: string
  end_date?: string
  day_of_month: number
  admin_notes?: string
}

/**
 * 변호사 인출 생성/수정 폼 데이터
 */
export interface PartnerWithdrawalFormData {
  withdrawal_date: string
  partner_name: PartnerName | ''
  amount: number
  withdrawal_type: WithdrawalType | ''
  payment_method?: PaymentMethod | ''
  office_location?: OfficeLocation | ''
  month_key: string
  description?: string
  memo?: string
  admin_notes?: string
}

/**
 * 월별 정산 생성/수정 폼 데이터
 */
export interface MonthlySettlementFormData {
  settlement_month: string
  total_revenue?: number
  pyeongtaek_revenue?: number
  cheonan_revenue?: number
  total_expenses?: number
  pyeongtaek_expenses?: number
  cheonan_expenses?: number
  fixed_expenses?: number
  marketing_expenses?: number
  tax_expenses?: number
  kim_withdrawals?: number
  lim_withdrawals?: number
  kim_accumulated_debt?: number
  lim_accumulated_debt?: number
  is_settled: boolean
  settled_by?: string
  excel_file_url?: string
  settlement_notes?: string
  admin_notes?: string
}

// ----------------------------------------------------------------------------
// 4. View Interfaces (통계 뷰)
// ----------------------------------------------------------------------------

/**
 * 월별 수입 합계 뷰
 */
export interface MonthlyRevenueSummary {
  month: string // DATE
  office_location: string
  payment_category: string
  payment_count: number
  total_amount: number
}

/**
 * 월별 지출 합계 뷰
 */
export interface MonthlyExpenseSummary {
  month: string // DATE
  office_location: string
  expense_category: ExpenseCategory
  expense_count: number
  total_amount: number
  recurring_count: number
  recurring_total: number
}

/**
 * 변호사별 현재 채권/채무 뷰
 */
export interface PartnerDebtStatus {
  partner_name: PartnerName
  accumulated_debt: number
  last_settlement_month: string
  total_settlements: number
}

/**
 * 카테고리별 지출 통계 뷰
 */
export interface ExpenseStatsByCategory {
  expense_category: ExpenseCategory
  office_location: string
  expense_count: number
  total_amount: number
  avg_amount: number
  first_expense_date: string
  last_expense_date: string
  recurring_count: number
}

/**
 * 정산 대시보드 뷰
 */
export interface SettlementDashboard {
  settlement_month: string
  total_revenue: number
  total_expenses: number
  net_profit: number
  kim_withdrawals: number
  lim_withdrawals: number
  kim_net_balance: number
  lim_net_balance: number
  kim_accumulated_debt: number
  lim_accumulated_debt: number
  is_settled: boolean
  settled_at: string | null
}

// ----------------------------------------------------------------------------
// 5. API Response Interfaces
// ----------------------------------------------------------------------------

/**
 * 표준 API 응답
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  per_page: number
  error?: string
}

// ----------------------------------------------------------------------------
// 6. Helper Types
// ----------------------------------------------------------------------------

/**
 * CSV 임포트용 지출 데이터
 */
export interface ExpenseImportRow {
  expense_date: string
  amount: number
  expense_category: string
  subcategory?: string
  office_location?: string
  vendor_name?: string
  memo?: string
  payment_method?: string
}

/**
 * CSV 임포트용 고정 지출 데이터
 */
export interface RecurringTemplateImportRow {
  name: string
  amount: number
  expense_category: string
  office_location?: string
  start_date: string
}

/**
 * 월별 정산 집계 결과
 */
export interface SettlementAggregation {
  settlement_month: string
  total_revenue: number
  total_expenses: number
  by_office: {
    평택: { revenue: number; expenses: number }
    천안: { revenue: number; expenses: number }
  }
  by_category: {
    [key: string]: number
  }
  withdrawals: {
    김현성: number
    임은지: number
  }
}
