import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

type UpcomingHearing = {
  id: string
  hearing_date: string
  case_id: string | null
}

type UpcomingDeadline = {
  id: string
  deadline_date: string
  case_id: string | null
}

/**
 * GET /api/admin/dashboard
 * 대시보드 통계 (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  const adminSupabase = createAdminClient()

  try {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    // 테넌트 필터 헬퍼
    const addTenantFilter = <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
      if (!tenant.isSuperAdmin && tenant.tenantId) {
        return query.eq('tenant_id', tenant.tenantId)
      }
      return query
    }

    // 1. Consultation Stats
    let allConsultationsQuery = adminSupabase
      .from('consultations')
      .select('id, status, lead_score, created_at, case_id')
      .order('created_at', { ascending: false })
    allConsultationsQuery = addTenantFilter(allConsultationsQuery)
    const { data: allConsultations } = await allConsultationsQuery

    let thisMonthConsultationsQuery = adminSupabase
      .from('consultations')
      .select('id, status, case_id')
      .gte('created_at', thisMonthStart.toISOString())
    thisMonthConsultationsQuery = addTenantFilter(thisMonthConsultationsQuery)
    const { data: thisMonthConsultations } = await thisMonthConsultationsQuery

    let lastMonthConsultationsQuery = adminSupabase
      .from('consultations')
      .select('id, status, case_id')
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString())
    lastMonthConsultationsQuery = addTenantFilter(lastMonthConsultationsQuery)
    const { data: lastMonthConsultations } = await lastMonthConsultationsQuery

    // Consultation conversion funnel
    const statusCounts = {
      pending: allConsultations?.filter(c => c.status === 'pending').length || 0,
      contacted: allConsultations?.filter(c => c.status === 'contacted').length || 0,
      confirmed: allConsultations?.filter(c => c.status === 'confirmed').length || 0,
      retained: allConsultations?.filter(c => c.status === 'retained' || c.status === 'contracted').length || 0,
      cancelled: allConsultations?.filter(c => c.status === 'cancelled').length || 0,
    }

    const linkedToCase = allConsultations?.filter(c => c.case_id).length || 0

    const consultationStats = {
      total: allConsultations?.length || 0,
      thisMonth: thisMonthConsultations?.length || 0,
      lastMonth: lastMonthConsultations?.length || 0,
      pending: statusCounts.pending,
      contacted: statusCounts.contacted,
      confirmed: statusCounts.confirmed,
      retained: statusCounts.retained,
      cancelled: statusCounts.cancelled,
      conversionRate: allConsultations?.length
        ? ((statusCounts.retained / allConsultations.length) * 100).toFixed(1)
        : '0.0',
      highQualityLeads: allConsultations?.filter(c => (c.lead_score || 0) >= 80).length || 0,
      linkedToCase,
    }

    // 2. Payment/Revenue Stats
    let allPaymentsQuery = adminSupabase
      .from('payments')
      .select('amount, payment_date, office_location, payment_category')
    allPaymentsQuery = addTenantFilter(allPaymentsQuery)
    const { data: allPayments } = await allPaymentsQuery

    let thisMonthPaymentsQuery = adminSupabase
      .from('payments')
      .select('amount, office_location')
      .gte('payment_date', thisMonthStart.toISOString().split('T')[0])
    thisMonthPaymentsQuery = addTenantFilter(thisMonthPaymentsQuery)
    const { data: thisMonthPayments } = await thisMonthPaymentsQuery

    let lastMonthPaymentsQuery = adminSupabase
      .from('payments')
      .select('amount, office_location')
      .gte('payment_date', lastMonthStart.toISOString().split('T')[0])
      .lte('payment_date', lastMonthEnd.toISOString().split('T')[0])
    lastMonthPaymentsQuery = addTenantFilter(lastMonthPaymentsQuery)
    const { data: lastMonthPayments } = await lastMonthPaymentsQuery

    const totalRevenue = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const thisMonthRevenue = thisMonthPayments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const lastMonthRevenue = lastMonthPayments?.reduce((sum, p) => sum + p.amount, 0) || 0

    const revenueStats = {
      total: totalRevenue,
      thisMonth: thisMonthRevenue,
      lastMonth: lastMonthRevenue,
      changePercent: lastMonthRevenue > 0
        ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
        : '0.0',
      byOffice: {
        pyeongtaek: thisMonthPayments?.filter(p => p.office_location === '평택').reduce((sum, p) => sum + p.amount, 0) || 0,
        cheonan: thisMonthPayments?.filter(p => p.office_location === '천안').reduce((sum, p) => sum + p.amount, 0) || 0,
      },
    }

    // 3. Cases Stats
    let allCasesQuery = adminSupabase
      .from('legal_cases')
      .select('id, status, office, created_at')
    allCasesQuery = addTenantFilter(allCasesQuery)
    const { data: allCases } = await allCasesQuery

    let thisMonthCasesQuery = adminSupabase
      .from('legal_cases')
      .select('id, status')
      .gte('created_at', thisMonthStart.toISOString())
    thisMonthCasesQuery = addTenantFilter(thisMonthCasesQuery)
    const { data: thisMonthCases } = await thisMonthCasesQuery

    const activeCases = allCases?.filter(c => c.status === '진행중').length || 0
    const completedCases = allCases?.filter(c => c.status === '완료').length || 0

    const casesStats = {
      total: allCases?.length || 0,
      active: activeCases,
      completed: completedCases,
      thisMonth: thisMonthCases?.length || 0,
      byOffice: {
        pyeongtaek: allCases?.filter(c => c.office === '평택').length || 0,
        cheonan: allCases?.filter(c => c.office === '천안').length || 0,
      },
    }

    // 4. Action Items (긴급 알림)
    let upcomingHearings: UpcomingHearing[] = []
    let upcomingDeadlines: UpcomingDeadline[] = []

    try {
      let hearingsQuery = adminSupabase
        .from('court_hearings')
        .select('id, hearing_date, case_id')
        .gte('hearing_date', now.toISOString().split('T')[0])
        .lte('hearing_date', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('hearing_date', { ascending: true })
        .limit(5)
      hearingsQuery = addTenantFilter(hearingsQuery)
      const { data: hearings } = await hearingsQuery
      upcomingHearings = hearings || []
    } catch (error) {
      console.log('Court hearings table not available', error)
    }

    try {
      let deadlinesQuery = adminSupabase
        .from('case_deadlines')
        .select('id, deadline_date, case_id')
        .gte('deadline_date', now.toISOString().split('T')[0])
        .lte('deadline_date', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('deadline_date', { ascending: true })
        .limit(5)
      deadlinesQuery = addTenantFilter(deadlinesQuery)
      const { data: deadlines } = await deadlinesQuery
      upcomingDeadlines = deadlines || []
    } catch (error) {
      console.log('Case deadlines table not available', error)
    }

    const actionItems = {
      pendingConsultations: statusCounts.pending,
      upcomingHearings: upcomingHearings.length,
      upcomingDeadlines: upcomingDeadlines.length,
      hearings: upcomingHearings,
      deadlines: upcomingDeadlines,
    }

    // 5. Expense Stats
    const thisMonth = now.toISOString().slice(0, 7) // YYYY-MM
    const lastMonth = lastMonthStart.toISOString().slice(0, 7)

    let thisMonthExpensesQuery = adminSupabase
      .from('expenses')
      .select('amount')
      .eq('month_key', thisMonth)
    thisMonthExpensesQuery = addTenantFilter(thisMonthExpensesQuery)
    const { data: thisMonthExpenses } = await thisMonthExpensesQuery

    let lastMonthExpensesQuery = adminSupabase
      .from('expenses')
      .select('amount')
      .eq('month_key', lastMonth)
    lastMonthExpensesQuery = addTenantFilter(lastMonthExpensesQuery)
    const { data: lastMonthExpenses } = await lastMonthExpensesQuery

    // Get partner debt status (테넌트별)
    let debtStatusQuery = adminSupabase
      .from('monthly_settlements')
      .select('kim_accumulated_debt, lim_accumulated_debt')
      .order('settlement_month', { ascending: false })
      .limit(1)
    debtStatusQuery = addTenantFilter(debtStatusQuery)
    const { data: debtStatus } = await debtStatusQuery.single()

    const expenseStats = {
      thisMonth: thisMonthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
      lastMonth: lastMonthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
      kimDebt: debtStatus?.kim_accumulated_debt || 0,
      limDebt: debtStatus?.lim_accumulated_debt || 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        consultations: consultationStats,
        revenue: revenueStats,
        cases: casesStats,
        expenses: expenseStats,
        actionItems,
      },
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
})
