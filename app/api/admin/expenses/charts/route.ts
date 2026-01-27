import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

export const dynamic = 'force-dynamic'

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()

    // 1. 최근 6개월 데이터 조회
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const startMonth = sixMonthsAgo.toISOString().slice(0, 7)

    // 월별 정산 데이터 (매출/지출 추이)
    let settlementsQuery = supabase
      .from('monthly_settlements')
      .select('*')
      .gte('settlement_month', startMonth)
      .order('settlement_month', { ascending: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      settlementsQuery = settlementsQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: settlements, error: settlementsError } = await settlementsQuery

    if (settlementsError) {
      console.error('Settlements fetch error:', settlementsError)
      return NextResponse.json(
        { error: 'Failed to fetch settlements' },
        { status: 500 }
      )
    }

    // 월별 추이 데이터 가공
    const monthlyTrend = (settlements || []).map(s => ({
      month: s.settlement_month,
      revenue: s.total_revenue,
      expenses: s.total_expenses,
      profit: s.total_revenue - s.total_expenses
    }))

    // 2. 카테고리별 지출 집계 (최근 6개월)
    let expensesQuery = supabase
      .from('expenses')
      .select('expense_category, amount')
      .gte('month_key', startMonth)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      expensesQuery = expensesQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: expenses, error: expensesError } = await expensesQuery

    if (expensesError) {
      console.error('Expenses fetch error:', expensesError)
      return NextResponse.json(
        { error: 'Failed to fetch expenses' },
        { status: 500 }
      )
    }

    // 카테고리별 합계 계산
    const categoryMap = new Map<string, number>()
    expenses?.forEach(expense => {
      const category = expense.expense_category || '기타'
      const current = categoryMap.get(category) || 0
      categoryMap.set(category, current + expense.amount)
    })

    const totalExpenses = Array.from(categoryMap.values()).reduce((sum, val) => sum + val, 0)

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)

    // 3. 변호사별 인출 추이 (최근 6개월)
    let withdrawalsQuery = supabase
      .from('partner_withdrawals')
      .select('partner_name, month_key, amount')
      .gte('month_key', startMonth)
      .order('month_key', { ascending: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      withdrawalsQuery = withdrawalsQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: withdrawals, error: withdrawalsError } = await withdrawalsQuery

    if (withdrawalsError) {
      console.error('Withdrawals fetch error:', withdrawalsError)
    }

    // 월별/변호사별 인출 집계
    const withdrawalMap = new Map<string, { kim: number; lim: number }>()
    withdrawals?.forEach(w => {
      const monthData = withdrawalMap.get(w.month_key) || { kim: 0, lim: 0 }
      if (w.partner_name === '김현성') {
        monthData.kim += w.amount
      } else if (w.partner_name === '임은지') {
        monthData.lim += w.amount
      }
      withdrawalMap.set(w.month_key, monthData)
    })

    const withdrawalTrend = Array.from(withdrawalMap.entries()).map(([month, data]) => ({
      month,
      kim: data.kim,
      lim: data.lim,
      total: data.kim + data.lim
    }))

    return NextResponse.json({
      monthlyTrend,
      categoryBreakdown,
      withdrawalTrend
    })
  } catch (error) {
    console.error('Charts API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
