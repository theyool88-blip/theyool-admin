// ============================================================================
// 지출 관리 시스템 타입 정의 (SaaS 보편화)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Constants & Enums
// ----------------------------------------------------------------------------

/**
 * 기본 지출 카테고리 (테넌트 설정에서 오버라이드 가능)
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
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

// 동적 타입 - 테넌트 설정에서 가져옴
export type ExpenseCategory = string

// 동적 사무실 위치 - 테넌트 설정에서 가져옴
export type OfficeLocation = string

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

  // 정산 통합
  month_key: string | null // YYYY-MM 형식

  // 테넌트
  tenant_id?: string | null
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

  // 테넌트
  tenant_id?: string | null
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

// ----------------------------------------------------------------------------
// 4. View Interfaces (통계 뷰)
// ----------------------------------------------------------------------------

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
