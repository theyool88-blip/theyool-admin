// ============================================================================
// 법무법인 더율 - 지출 관리 시스템 Supabase 인터페이스
// ============================================================================

import { createAdminClient } from './admin'
import type {
  Expense,
  ExpenseFormData,
  RecurringTemplate,
  RecurringTemplateFormData,
  PartnerWithdrawal,
  PartnerWithdrawalFormData,
  MonthlySettlement,
  MonthlySettlementFormData,
  MonthlyRevenueSummary,
  MonthlyExpenseSummary,
  ExpenseStatsByCategory,
  SettlementDashboard
} from '@/types/expense'

// ============================================================================
// 1. EXPENSES (지출 내역)
// ============================================================================

/**
 * 지출 목록 조회
 */
export async function getExpenses(params?: {
  startDate?: string
  endDate?: string
  category?: string
  officeLocation?: string
  isRecurring?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('expense_date', { ascending: false })

  if (params?.startDate) {
    query = query.gte('expense_date', params.startDate)
  }
  if (params?.endDate) {
    query = query.lte('expense_date', params.endDate)
  }
  if (params?.category) {
    query = query.eq('expense_category', params.category)
  }
  if (params?.officeLocation) {
    query = query.eq('office_location', params.officeLocation)
  }
  if (params?.isRecurring !== undefined) {
    query = query.eq('is_recurring', params.isRecurring)
  }
  if (params?.limit) {
    query = query.limit(params.limit)
  }
  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching expenses:', error)
    throw error
  }

  return { data: data as Expense[], count: count || 0 }
}

/**
 * 지출 상세 조회
 */
export async function getExpenseById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching expense:', error)
    throw error
  }

  return data as Expense
}

/**
 * 지출 생성
 */
export async function createExpense(expenseData: ExpenseFormData) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('expenses')
    .insert([expenseData])
    .select()
    .single()

  if (error) {
    console.error('Error creating expense:', error)
    throw error
  }

  return data as Expense
}

/**
 * 지출 수정
 */
export async function updateExpense(id: string, expenseData: Partial<ExpenseFormData>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('expenses')
    .update(expenseData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating expense:', error)
    throw error
  }

  return data as Expense
}

/**
 * 지출 삭제
 */
export async function deleteExpense(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting expense:', error)
    throw error
  }

  return true
}

// ============================================================================
// 2. RECURRING_TEMPLATES (고정 지출 템플릿)
// ============================================================================

/**
 * 고정 지출 템플릿 목록 조회
 */
export async function getRecurringTemplates(params?: {
  isActive?: boolean
  category?: string
  officeLocation?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('recurring_templates')
    .select('*')
    .order('name', { ascending: true })

  if (params?.isActive !== undefined) {
    query = query.eq('is_active', params.isActive)
  }
  if (params?.category) {
    query = query.eq('expense_category', params.category)
  }
  if (params?.officeLocation) {
    query = query.eq('office_location', params.officeLocation)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching recurring templates:', error)
    throw error
  }

  return data as RecurringTemplate[]
}

/**
 * 고정 지출 템플릿 상세 조회
 */
export async function getRecurringTemplateById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching recurring template:', error)
    throw error
  }

  return data as RecurringTemplate
}

/**
 * 고정 지출 템플릿 생성
 */
export async function createRecurringTemplate(templateData: RecurringTemplateFormData) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('recurring_templates')
    .insert([templateData])
    .select()
    .single()

  if (error) {
    console.error('Error creating recurring template:', error)
    throw error
  }

  return data as RecurringTemplate
}

/**
 * 고정 지출 템플릿 수정
 */
export async function updateRecurringTemplate(id: string, templateData: Partial<RecurringTemplateFormData>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('recurring_templates')
    .update(templateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating recurring template:', error)
    throw error
  }

  return data as RecurringTemplate
}

/**
 * 고정 지출 템플릿 삭제
 */
export async function deleteRecurringTemplate(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('recurring_templates')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting recurring template:', error)
    throw error
  }

  return true
}

/**
 * 고정 지출 템플릿 활성화/비활성화 토글
 */
export async function toggleRecurringTemplate(id: string, isActive: boolean) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('recurring_templates')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error toggling recurring template:', error)
    throw error
  }

  return data as RecurringTemplate
}

// ============================================================================
// 3. PARTNER_WITHDRAWALS (변호사 인출/지급)
// ============================================================================

/**
 * 변호사 인출 목록 조회
 */
export async function getPartnerWithdrawals(params?: {
  partnerName?: string
  monthKey?: string
  startDate?: string
  endDate?: string
  withdrawalType?: string
  limit?: number
  offset?: number
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('partner_withdrawals')
    .select('*', { count: 'exact' })
    .order('withdrawal_date', { ascending: false })

  if (params?.partnerName) {
    query = query.eq('partner_name', params.partnerName)
  }
  if (params?.monthKey) {
    query = query.eq('month_key', params.monthKey)
  }
  if (params?.startDate) {
    query = query.gte('withdrawal_date', params.startDate)
  }
  if (params?.endDate) {
    query = query.lte('withdrawal_date', params.endDate)
  }
  if (params?.withdrawalType) {
    query = query.eq('withdrawal_type', params.withdrawalType)
  }
  if (params?.limit) {
    query = query.limit(params.limit)
  }
  if (params?.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching partner withdrawals:', error)
    throw error
  }

  return { data: data as PartnerWithdrawal[], count: count || 0 }
}

/**
 * 변호사 인출 상세 조회
 */
export async function getPartnerWithdrawalById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('partner_withdrawals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching partner withdrawal:', error)
    throw error
  }

  return data as PartnerWithdrawal
}

/**
 * 변호사 인출 생성
 */
export async function createPartnerWithdrawal(withdrawalData: PartnerWithdrawalFormData) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('partner_withdrawals')
    .insert([withdrawalData])
    .select()
    .single()

  if (error) {
    console.error('Error creating partner withdrawal:', error)
    throw error
  }

  return data as PartnerWithdrawal
}

/**
 * 변호사 인출 수정
 */
export async function updatePartnerWithdrawal(id: string, withdrawalData: Partial<PartnerWithdrawalFormData>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('partner_withdrawals')
    .update(withdrawalData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating partner withdrawal:', error)
    throw error
  }

  return data as PartnerWithdrawal
}

/**
 * 변호사 인출 삭제
 */
export async function deletePartnerWithdrawal(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('partner_withdrawals')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting partner withdrawal:', error)
    throw error
  }

  return true
}

// ============================================================================
// 4. MONTHLY_SETTLEMENTS (월별 정산)
// ============================================================================

/**
 * 월별 정산 목록 조회
 */
export async function getMonthlySettlements(params?: {
  isSettled?: boolean
  limit?: number
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('monthly_settlements')
    .select('*')
    .order('settlement_month', { ascending: false })

  if (params?.isSettled !== undefined) {
    query = query.eq('is_settled', params.isSettled)
  }
  if (params?.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching monthly settlements:', error)
    throw error
  }

  return data as MonthlySettlement[]
}

/**
 * 월별 정산 상세 조회
 */
export async function getMonthlySettlementById(id: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('monthly_settlements')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching monthly settlement:', error)
    throw error
  }

  return data as MonthlySettlement
}

/**
 * 월별 정산 조회 (월 키로)
 */
export async function getMonthlySettlementByMonth(monthKey: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('monthly_settlements')
    .select('*')
    .eq('settlement_month', monthKey)
    .maybeSingle()

  if (error) {
    console.error('Error fetching monthly settlement:', error)
    throw error
  }

  return data as MonthlySettlement | null
}

/**
 * 월별 정산 생성
 */
export async function createMonthlySettlement(settlementData: MonthlySettlementFormData) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('monthly_settlements')
    .insert([settlementData])
    .select()
    .single()

  if (error) {
    console.error('Error creating monthly settlement:', error)
    throw error
  }

  return data as MonthlySettlement
}

/**
 * 월별 정산 수정
 */
export async function updateMonthlySettlement(id: string, settlementData: Partial<MonthlySettlementFormData>) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('monthly_settlements')
    .update(settlementData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating monthly settlement:', error)
    throw error
  }

  return data as MonthlySettlement
}

/**
 * 월별 정산 삭제
 */
export async function deleteMonthlySettlement(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('monthly_settlements')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting monthly settlement:', error)
    throw error
  }

  return true
}

/**
 * 월별 정산 확정/취소
 */
export async function settleMonthlySettlement(id: string, isSettled: boolean, settledBy?: string) {
  const supabase = createAdminClient()

  const updateData: Partial<MonthlySettlement> = { is_settled: isSettled }
  if (isSettled) {
    updateData.settled_at = new Date().toISOString()
    updateData.settled_by = settledBy
  } else {
    updateData.settled_at = null
    updateData.settled_by = null
  }

  const { data, error } = await supabase
    .from('monthly_settlements')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error settling monthly settlement:', error)
    throw error
  }

  return data as MonthlySettlement
}

// ============================================================================
// 5. STATISTICS & VIEWS (통계 뷰)
// ============================================================================

/**
 * 월별 수입 합계 조회
 */
export async function getMonthlyRevenueSummary(params?: {
  startMonth?: string
  endMonth?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('monthly_revenue_summary')
    .select('*')
    .order('month', { ascending: false })

  if (params?.startMonth) {
    query = query.gte('month', params.startMonth)
  }
  if (params?.endMonth) {
    query = query.lte('month', params.endMonth)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching monthly revenue summary:', error)
    throw error
  }

  return data as MonthlyRevenueSummary[]
}

/**
 * 월별 지출 합계 조회
 */
export async function getMonthlyExpenseSummary(params?: {
  startMonth?: string
  endMonth?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('monthly_expense_summary')
    .select('*')
    .order('month', { ascending: false })

  if (params?.startMonth) {
    query = query.gte('month', params.startMonth)
  }
  if (params?.endMonth) {
    query = query.lte('month', params.endMonth)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching monthly expense summary:', error)
    throw error
  }

  return data as MonthlyExpenseSummary[]
}

/**
 * 변호사별 채권/채무 상태 조회
 */
export async function getPartnerDebtStatus() {
  const supabase = createAdminClient()

  // Get the latest settlement to get accumulated debt
  const { data, error } = await supabase
    .from('monthly_settlements')
    .select('settlement_month, kim_accumulated_debt, lim_accumulated_debt')
    .order('settlement_month', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching partner debt status:', error)
    return {
      success: false,
      error: error.message
    }
  }

  return {
    success: true,
    data: {
      kim_accumulated_debt: data.kim_accumulated_debt || 0,
      lim_accumulated_debt: data.lim_accumulated_debt || 0,
      last_settlement_month: data.settlement_month
    }
  }
}

/**
 * 카테고리별 지출 통계 조회
 */
export async function getExpenseStatsByCategory() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('expense_stats_by_category')
    .select('*')
    .order('total_amount', { ascending: false })

  if (error) {
    console.error('Error fetching expense stats by category:', error)
    throw error
  }

  return data as ExpenseStatsByCategory[]
}

/**
 * 정산 대시보드 조회 (최근 12개월)
 */
export async function getSettlementDashboard() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('settlement_dashboard')
    .select('*')

  if (error) {
    console.error('Error fetching settlement dashboard:', error)
    throw error
  }

  return data as SettlementDashboard[]
}

// ============================================================================
// 6. AGGREGATION & HELPER FUNCTIONS (집계 및 헬퍼 함수)
// ============================================================================

/**
 * 특정 월의 지출 합계 계산
 */
export async function calculateMonthlyExpenses(monthKey: string) {
  const supabase = createAdminClient()

  const startDate = `${monthKey}-01`
  const endDate = `${monthKey}-31` // 간단히 처리, 실제로는 말일 계산 필요

  const { data, error } = await supabase
    .from('expenses')
    .select('amount, office_location, expense_category')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)

  if (error) {
    console.error('Error calculating monthly expenses:', error)
    throw error
  }

  const total = data.reduce((sum, expense) => sum + expense.amount, 0)
  const pyeongtaek = data
    .filter(e => e.office_location === '평택')
    .reduce((sum, e) => sum + e.amount, 0)
  const cheonan = data
    .filter(e => e.office_location === '천안')
    .reduce((sum, e) => sum + e.amount, 0)
  const fixed = data
    .filter(e => ['임대료', '인건비', '필수운영비'].includes(e.expense_category))
    .reduce((sum, e) => sum + e.amount, 0)
  const marketing = data
    .filter(e => ['마케팅비', '광고비'].includes(e.expense_category))
    .reduce((sum, e) => sum + e.amount, 0)
  const tax = data
    .filter(e => e.expense_category === '세금')
    .reduce((sum, e) => sum + e.amount, 0)

  return {
    total_expenses: total,
    pyeongtaek_expenses: pyeongtaek,
    cheonan_expenses: cheonan,
    fixed_expenses: fixed,
    marketing_expenses: marketing,
    tax_expenses: tax
  }
}

/**
 * 특정 월의 변호사 인출 합계 계산
 */
export async function calculateMonthlyWithdrawals(monthKey: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('partner_withdrawals')
    .select('partner_name, amount')
    .eq('month_key', monthKey)

  if (error) {
    console.error('Error calculating monthly withdrawals:', error)
    throw error
  }

  const kimTotal = data
    .filter(w => w.partner_name === '김현성')
    .reduce((sum, w) => sum + w.amount, 0)
  const limTotal = data
    .filter(w => w.partner_name === '임은지')
    .reduce((sum, w) => sum + w.amount, 0)

  return {
    kim_withdrawals: kimTotal,
    lim_withdrawals: limTotal
  }
}

/**
 * 고정 지출 자동 생성 (특정 월)
 */
export async function generateRecurringExpenses(monthKey: string) {
  const supabase = createAdminClient()

  // 1. 활성 템플릿 조회
  const { data: templates, error: templateError } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', `${monthKey}-31`)
    .or(`end_date.is.null,end_date.gte.${monthKey}-01`)

  if (templateError) {
    console.error('Error fetching recurring templates:', templateError)
    throw templateError
  }

  // 2. 각 템플릿으로부터 지출 생성
  const expensesToCreate = templates.map(template => ({
    expense_date: `${monthKey}-${String(template.day_of_month).padStart(2, '0')}`,
    amount: template.amount,
    expense_category: template.expense_category,
    subcategory: template.subcategory,
    office_location: template.office_location,
    vendor_name: template.vendor_name,
    payment_method: template.payment_method,
    memo: template.memo,
    is_recurring: true,
    recurring_template_id: template.id
  }))

  if (expensesToCreate.length === 0) {
    return []
  }

  // 3. 일괄 삽입
  const { data: createdExpenses, error: createError } = await supabase
    .from('expenses')
    .insert(expensesToCreate)
    .select()

  if (createError) {
    console.error('Error creating recurring expenses:', createError)
    throw createError
  }

  return createdExpenses as Expense[]
}

/**
 * 월별 정산 자동 생성/업데이트
 */
export async function autoGenerateMonthlySettlement(monthKey: string, revenueData: {
  total_revenue: number
  pyeongtaek_revenue: number
  cheonan_revenue: number
}) {
  // 1. 지출 합계 계산
  const expenseData = await calculateMonthlyExpenses(monthKey)

  // 2. 인출 합계 계산
  const withdrawalData = await calculateMonthlyWithdrawals(monthKey)

  // 3. 기존 정산 레코드 확인
  const existingSettlement = await getMonthlySettlementByMonth(monthKey)

  const settlementData: MonthlySettlementFormData = {
    settlement_month: monthKey,
    total_revenue: revenueData.total_revenue,
    pyeongtaek_revenue: revenueData.pyeongtaek_revenue,
    cheonan_revenue: revenueData.cheonan_revenue,
    ...expenseData,
    ...withdrawalData,
    is_settled: false
  }

  // 4. 생성 또는 업데이트
  if (existingSettlement) {
    return await updateMonthlySettlement(existingSettlement.id, settlementData)
  } else {
    return await createMonthlySettlement(settlementData)
  }
}
