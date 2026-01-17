import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'
import { getCurrentTenantContext } from '@/lib/auth/tenant-context'

export async function GET() {
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantContext = await getCurrentTenantContext()
  const adminClient = createAdminClient()

  try {
    // Fetch all legal cases
    let casesQuery = adminClient
      .from('legal_cases')
      .select('id, status, case_type, created_at, assigned_to')

    if (!tenantContext?.isSuperAdmin && tenantContext?.tenantId) {
      casesQuery = casesQuery.eq('tenant_id', tenantContext.tenantId)
    }

    const { data: cases, error: casesError } = await casesQuery

    if (casesError) {
      throw new Error(`Failed to fetch cases: ${casesError.message}`)
    }

    if (!cases) {
      throw new Error('No cases found')
    }

    const total = cases.length
    const caseIds = cases.map(c => c.id)

    // Get payments for revenue calculation
    let paymentsQuery = adminClient
      .from('payments')
      .select('case_id, amount')
      .in('case_id', caseIds)
      .gt('amount', 0)

    if (!tenantContext?.isSuperAdmin && tenantContext?.tenantId) {
      paymentsQuery = paymentsQuery.eq('tenant_id', tenantContext.tenantId)
    }

    const { data: payments } = await paymentsQuery

    // Calculate total received per case
    const paymentsByCase = new Map<string, number>()
    payments?.forEach(p => {
      const current = paymentsByCase.get(p.case_id) || 0
      paymentsByCase.set(p.case_id, current + (p.amount || 0))
    })

    // Get assigned member names
    const assignedToIds = [...new Set(cases.map(c => c.assigned_to).filter(Boolean))]
    const membersMap = new Map<string, string>()

    if (assignedToIds.length > 0) {
      const { data: members } = await adminClient
        .from('tenant_members')
        .select('id, display_name')
        .in('id', assignedToIds)

      members?.forEach(m => {
        membersMap.set(m.id, m.display_name || '미배정')
      })
    }

    // Status breakdown (use English status values from schema)
    const byStatus = {
      active: cases.filter(c => c.status === 'active').length,
      completed: cases.filter(c => c.status === 'closed').length,
      suspended: cases.filter(c => c.status === 'suspended').length,
    }

    // Case type distribution (top categories)
    const categoryMap: Record<string, number> = {}
    cases.forEach(c => {
      if (c.case_type) {
        categoryMap[c.case_type] = (categoryMap[c.case_type] || 0) + 1
      }
    })

    const byCategory = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8) // Top 8 categories

    // Monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const monthCases = cases.filter(c => {
        const createdDate = c.created_at ? new Date(c.created_at) : null
        return createdDate && createdDate >= monthStart && createdDate <= monthEnd
      })

      monthlyTrend.push({
        month: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`,
        total: monthCases.length,
        completed: monthCases.filter(c => c.status === 'closed').length,
      })
    }

    // Revenue statistics (from payments)
    let totalRevenue = 0
    paymentsByCase.forEach(amount => {
      totalRevenue += amount
    })
    const averageRevenuePerCase = total > 0 ? Math.round(totalRevenue / total) : 0

    // Assignee performance comparison
    const assigneeStats: Record<string, {
      active: number;
      completed: number;
      suspended: number;
      totalRevenue: number;
    }> = {}

    cases.forEach(c => {
      const assigneeId = c.assigned_to
      if (!assigneeId) return

      const assigneeName = membersMap.get(assigneeId) || '미배정'

      if (!assigneeStats[assigneeName]) {
        assigneeStats[assigneeName] = { active: 0, completed: 0, suspended: 0, totalRevenue: 0 }
      }

      if (c.status === 'active') assigneeStats[assigneeName].active++
      if (c.status === 'closed') assigneeStats[assigneeName].completed++
      if (c.status === 'suspended') assigneeStats[assigneeName].suspended++
      assigneeStats[assigneeName].totalRevenue += (paymentsByCase.get(c.id) || 0)
    })

    const byLawyer = Object.entries(assigneeStats).map(([lawyer, stats]) => {
      const totalCases = stats.active + stats.completed + stats.suspended
      const avgRevenue = totalCases > 0 ? Math.round(stats.totalRevenue / totalCases) : 0

      return {
        lawyer,
        active: stats.active,
        completed: stats.completed,
        suspended: stats.suspended,
        totalRevenue: stats.totalRevenue,
        avgRevenue,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        total,
        byStatus,
        byCategory,
        monthlyTrend,
        totalRevenue,
        averageRevenuePerCase,
        byLawyer,
      },
    })
  } catch (error) {
    console.error('Cases stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cases stats' },
      { status: 500 }
    )
  }
}
