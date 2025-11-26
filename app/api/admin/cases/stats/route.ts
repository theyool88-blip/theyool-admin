import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    // Fetch all legal cases with lawyer info
    const { data: cases, error: casesError } = await supabase
      .from('legal_cases')
      .select('id, status, office, category, created_at, case_start_date, case_end_date, total_received, assigned_lawyer')

    if (casesError) {
      throw new Error(`Failed to fetch cases: ${casesError.message}`)
    }

    if (!cases) {
      throw new Error('No cases found')
    }

    const total = cases.length

    // Status breakdown
    const byStatus = {
      active: cases.filter(c => c.status === '진행중').length,
      completed: cases.filter(c => c.status === '완료').length,
      suspended: cases.filter(c => c.status === '중단').length,
    }

    // Office distribution
    const byOffice = {
      pyeongtaek: cases.filter(c => c.office === '평택').length,
      cheonan: cases.filter(c => c.office === '천안').length,
    }

    // Category distribution (top categories)
    const categoryMap: Record<string, number> = {}
    cases.forEach(c => {
      if (c.category) {
        categoryMap[c.category] = (categoryMap[c.category] || 0) + 1
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
        completed: monthCases.filter(c => c.status === '완료').length,
      })
    }

    // Average case duration (for completed cases)
    const completedCases = cases.filter(
      c => c.status === '완료' && c.case_start_date && c.case_end_date
    )
    let averageDuration = '계산 중'
    if (completedCases.length > 0) {
      const totalDays = completedCases.reduce((sum, c) => {
        const start = new Date(c.case_start_date!).getTime()
        const end = new Date(c.case_end_date!).getTime()
        return sum + (end - start) / (1000 * 60 * 60 * 24)
      }, 0)
      const avgDays = totalDays / completedCases.length

      if (avgDays < 30) {
        averageDuration = `${Math.round(avgDays)}일`
      } else if (avgDays < 365) {
        averageDuration = `${(avgDays / 30).toFixed(1)}개월`
      } else {
        averageDuration = `${(avgDays / 365).toFixed(1)}년`
      }
    }

    // Revenue statistics
    const totalRevenue = cases.reduce((sum, c) => sum + (c.total_received || 0), 0)
    const averageRevenuePerCase = total > 0 ? Math.round(totalRevenue / total) : 0

    // Lawyer performance comparison
    const lawyerStats: Record<string, {
      active: number;
      completed: number;
      suspended: number;
      totalRevenue: number;
      durations: number[];
    }> = {
      '육심원': { active: 0, completed: 0, suspended: 0, totalRevenue: 0, durations: [] },
      '임은지': { active: 0, completed: 0, suspended: 0, totalRevenue: 0, durations: [] },
    }

    cases.forEach(c => {
      const lawyer = c.assigned_lawyer || '미배정'
      if (lawyer === '육심원' || lawyer === '임은지') {
        if (c.status === '진행중') lawyerStats[lawyer].active++
        if (c.status === '완료') lawyerStats[lawyer].completed++
        if (c.status === '중단') lawyerStats[lawyer].suspended++
        lawyerStats[lawyer].totalRevenue += (c.total_received || 0)

        // Calculate duration for completed cases
        if (c.status === '완료' && c.case_start_date && c.case_end_date) {
          const start = new Date(c.case_start_date).getTime()
          const end = new Date(c.case_end_date).getTime()
          const days = (end - start) / (1000 * 60 * 60 * 24)
          lawyerStats[lawyer].durations.push(days)
        }
      }
    })

    const byLawyer = Object.entries(lawyerStats).map(([lawyer, stats]) => {
      const totalCases = stats.active + stats.completed + stats.suspended
      const avgRevenue = totalCases > 0 ? Math.round(stats.totalRevenue / totalCases) : 0

      let avgDuration = '계산 중'
      if (stats.durations.length > 0) {
        const avgDays = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        if (avgDays < 30) {
          avgDuration = `${Math.round(avgDays)}일`
        } else if (avgDays < 365) {
          avgDuration = `${(avgDays / 30).toFixed(1)}개월`
        } else {
          avgDuration = `${(avgDays / 365).toFixed(1)}년`
        }
      }

      return {
        lawyer,
        active: stats.active,
        completed: stats.completed,
        suspended: stats.suspended,
        totalRevenue: stats.totalRevenue,
        avgRevenue,
        avgDuration,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        total,
        byStatus,
        byOffice,
        byCategory,
        monthlyTrend,
        averageDuration,
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
