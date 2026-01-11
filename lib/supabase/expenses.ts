// ============================================================================
// 지출 관리 시스템 Supabase 인터페이스 (SaaS 보편화)
// ============================================================================

import { createAdminClient } from './admin'
import type {
  Expense,
  ExpenseFormData,
  RecurringTemplate,
  RecurringTemplateFormData,
  MonthlyExpenseSummary,
  ExpenseStatsByCategory
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
  tenantId?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('expense_date', { ascending: false })

  if (params?.tenantId) {
    query = query.eq('tenant_id', params.tenantId)
  }
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
export async function createExpense(expenseData: ExpenseFormData & { tenant_id?: string }) {
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
  tenantId?: string
}) {
  const supabase = createAdminClient()

  let query = supabase
    .from('recurring_templates')
    .select('*')
    .order('name', { ascending: true })

  if (params?.tenantId) {
    query = query.eq('tenant_id', params.tenantId)
  }
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
export async function createRecurringTemplate(templateData: RecurringTemplateFormData & { tenant_id?: string }) {
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
// 3. STATISTICS (통계)
// ============================================================================

/**
 * 월별 지출 합계 조회
 */
export async function getMonthlyExpenseSummary(params?: {
  startMonth?: string
  endMonth?: string
  tenantId?: string
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
 * 카테고리별 지출 통계 조회
 */
export async function getExpenseStatsByCategory(_tenantId?: string) {
  const supabase = createAdminClient()

  const query = supabase
    .from('expense_stats_by_category')
    .select('*')
    .order('total_amount', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching expense stats by category:', error)
    throw error
  }

  return data as ExpenseStatsByCategory[]
}

// ============================================================================
// 4. HELPER FUNCTIONS (헬퍼 함수)
// ============================================================================

/**
 * 특정 월의 지출 합계 계산 (동적 사무실별)
 */
export async function calculateMonthlyExpenses(monthKey: string, tenantId?: string) {
  const supabase = createAdminClient()

  const startDate = `${monthKey}-01`
  const endDate = `${monthKey}-31`

  let query = supabase
    .from('expenses')
    .select('amount, office_location, expense_category')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error calculating monthly expenses:', error)
    throw error
  }

  const total = data.reduce((sum, expense) => sum + expense.amount, 0)

  // 동적 사무실별 집계
  const byOffice: Record<string, number> = {}
  data.forEach(e => {
    const office = e.office_location || '미지정'
    byOffice[office] = (byOffice[office] || 0) + e.amount
  })

  // 동적 카테고리별 집계
  const byCategory: Record<string, number> = {}
  data.forEach(e => {
    byCategory[e.expense_category] = (byCategory[e.expense_category] || 0) + e.amount
  })

  return {
    total_expenses: total,
    by_office: byOffice,
    by_category: byCategory
  }
}

/**
 * 고정 지출 자동 생성 (특정 월)
 */
export async function generateRecurringExpenses(monthKey: string, tenantId?: string) {
  const supabase = createAdminClient()

  // 1. 활성 템플릿 조회
  let query = supabase
    .from('recurring_templates')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', `${monthKey}-31`)
    .or(`end_date.is.null,end_date.gte.${monthKey}-01`)

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { data: templates, error: templateError } = await query

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
    recurring_template_id: template.id,
    tenant_id: tenantId
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
