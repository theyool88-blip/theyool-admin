import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()

    // Get current month
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // "YYYY-MM"
    const firstDayOfMonth = `${currentMonth}-01`
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    // Fetch total expenses (all time)
    let totalCountQuery = supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      totalCountQuery = totalCountQuery.eq('tenant_id', tenant.tenantId)
    }

    const { count: totalExpensesCount } = await totalCountQuery

    // Fetch monthly expenses (current month)
    let monthlyQuery = supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', firstDayOfMonth)
      .lte('expense_date', lastDayOfMonth)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      monthlyQuery = monthlyQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: monthlyExpensesData } = await monthlyQuery

    const monthlyExpenses = monthlyExpensesData?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

    // Fetch recurring templates count (active only)
    let recurringQuery = supabase
      .from('recurring_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      recurringQuery = recurringQuery.eq('tenant_id', tenant.tenantId)
    }

    const { count: recurringCount } = await recurringQuery

    // Fetch pending settlements count (not settled)
    let settlementsQuery = supabase
      .from('monthly_settlements')
      .select('*', { count: 'exact', head: true })
      .eq('is_settled', false)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      settlementsQuery = settlementsQuery.eq('tenant_id', tenant.tenantId)
    }

    const { count: pendingSettlements } = await settlementsQuery

    return NextResponse.json({
      total_expenses: totalExpensesCount || 0,
      monthly_expenses: monthlyExpenses,
      recurring_count: recurringCount || 0,
      pending_settlements: pendingSettlements || 0
    })
  } catch (error) {
    console.error('Error fetching expense summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense summary' },
      { status: 500 }
    )
  }
})
