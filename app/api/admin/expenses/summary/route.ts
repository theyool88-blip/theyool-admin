import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Get current month
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // "YYYY-MM"
    const firstDayOfMonth = `${currentMonth}-01`
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    // Fetch total expenses (all time)
    const { count: totalExpensesCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })

    // Fetch monthly expenses (current month)
    const { data: monthlyExpensesData } = await supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', firstDayOfMonth)
      .lte('expense_date', lastDayOfMonth)

    const monthlyExpenses = monthlyExpensesData?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

    // Fetch recurring templates count (active only)
    const { count: recurringCount } = await supabase
      .from('recurring_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Fetch pending settlements count (not settled)
    const { count: pendingSettlements } = await supabase
      .from('monthly_settlements')
      .select('*', { count: 'exact', head: true })
      .eq('is_settled', false)

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
}
