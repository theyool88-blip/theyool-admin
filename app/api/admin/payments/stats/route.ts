import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET: Get payment statistics
export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for data queries (bypasses RLS)
    const adminSupabase = await createAdminClient()

    // Get all payments for total calculations
    const { data: allPayments, error: paymentsError } = await adminSupabase
      .from('payments')
      .select('amount, office_location, payment_date')

    if (paymentsError) {
      throw paymentsError
    }

    // Calculate totals
    const totalAmount = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const pyeongtaekAmount = allPayments?.filter(p => p.office_location === '평택').reduce((sum, p) => sum + p.amount, 0) || 0
    const cheonanAmount = allPayments?.filter(p => p.office_location === '천안').reduce((sum, p) => sum + p.amount, 0) || 0

    const totalCount = allPayments?.length || 0
    const pyeongtaekCount = allPayments?.filter(p => p.office_location === '평택').length || 0
    const cheonanCount = allPayments?.filter(p => p.office_location === '천안').length || 0

    // Calculate this month and last month
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    const thisMonthAmount = allPayments?.filter(p => p.payment_date >= thisMonthStart).reduce((sum, p) => sum + p.amount, 0) || 0
    const lastMonthAmount = allPayments?.filter(p => p.payment_date >= lastMonthStart && p.payment_date <= lastMonthEnd).reduce((sum, p) => sum + p.amount, 0) || 0

    const monthGrowthRate = lastMonthAmount > 0
      ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100)
      : thisMonthAmount > 0 ? 100 : 0

    // Get statistics from views
    const { data: byCategory, error: categoryError } = await adminSupabase
      .from('payment_stats_by_category')
      .select('*')
      .order('total_amount', { ascending: false })

    if (categoryError) {
      throw categoryError
    }

    const { data: byOffice, error: officeError } = await adminSupabase
      .from('payment_stats_by_office')
      .select('*')
      .order('office_location')
      .order('payment_category')

    if (officeError) {
      throw officeError
    }

    const { data: byMonth, error: monthError } = await adminSupabase
      .from('payment_stats_by_month')
      .select('*')
      .order('month', { ascending: false })
      .limit(12)

    if (monthError) {
      throw monthError
    }

    return NextResponse.json({
      data: {
        total_amount: totalAmount,
        pyeongtaek_amount: pyeongtaekAmount,
        cheonan_amount: cheonanAmount,
        this_month_amount: thisMonthAmount,
        last_month_amount: lastMonthAmount,
        month_growth_rate: monthGrowthRate,
        total_count: totalCount,
        pyeongtaek_count: pyeongtaekCount,
        cheonan_count: cheonanCount,
        by_category: byCategory,
        by_office: byOffice,
        by_month: byMonth,
      }
    })
  } catch (error) {
    console.error('Failed to fetch payment statistics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
