import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateMonthlyRevenue } from '@/lib/supabase/payments-aggregation'

/**
 * GET /api/admin/financial/dashboard?month=YYYY-MM
 *
 * 통합 재무 대시보드 데이터 조회
 * - 월별 수익/지출 통합
 * - 순이익 계산
 * - 파트너별 분배 현황
 * - 월별 추세 데이터
 */
export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = await createAdminClient()

  try {
    const { searchParams } = request.nextUrl
    const currentMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(currentMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    // 1. 현재 월 수익 데이터
    const revenueData = await calculateMonthlyRevenue(currentMonth)

    // 2. 현재 월 지출 데이터
    const { data: expenses } = await adminSupabase
      .from('expenses')
      .select('amount, category, office')
      .eq('month_key', currentMonth)

    const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0
    const pyeongtaekExpenses = expenses
      ?.filter(e => e.office === '평택')
      .reduce((sum, e) => sum + (e.amount || 0), 0) || 0
    const cheonanExpenses = expenses
      ?.filter(e => e.office === '천안')
      .reduce((sum, e) => sum + (e.amount || 0), 0) || 0

    // 3. 현재 월 정산 데이터 (파트너 분배)
    const { data: settlement } = await adminSupabase
      .from('monthly_settlements')
      .select('*')
      .eq('settlement_month', currentMonth)
      .single()

    // 4. 순이익 계산
    const totalRevenue = revenueData?.total_revenue || 0
    const netProfit = totalRevenue - totalExpenses

    // 5. 파트너별 분배 (50:50)
    const kimShare = settlement?.kim_share && settlement.kim_share > 0 ? settlement.kim_share : Math.floor(netProfit / 2)
    const limShare = settlement?.lim_share && settlement.lim_share > 0 ? settlement.lim_share : Math.ceil(netProfit / 2)

    // 6. 파트너별 인출 현황
    const partnerNames = {
      kim: ['김현성', '김현성 파트너', '김심원'],
      lim: ['임은지', '임은지 파트너']
    }

    const normalizePartner = (p?: string | null) => {
      if (!p) return ''
      return p.replace('파트너', '').trim()
    }

    const normalizeAmount = (val: unknown) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const num = Number(val.replace(/[^0-9.-]/g, ''))
        return Number.isFinite(num) ? num : 0
      }
      return 0
    }

    const normalizeMonthKey = (value?: string | null) => {
      if (!value) return ''
      const cleaned = value.toString().replace(/\./g, '-').replace(/\s+/g, '').trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned.slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(cleaned)) return cleaned
      if (/^\d{6}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}`
      return cleaned.slice(0, 7)
    }

    const sumByRows = (
      rows: Array<{
        amount: number
        partner_name?: string | null
        partner?: string | null
        month_key?: string | null
        withdrawal_date?: string | null
      }>
    ) => {
      return rows.reduce(
        (acc, w) => {
          const name = normalizePartner(w.partner_name || w.partner)
          const amount = normalizeAmount(w.amount)
          if (partnerNames.kim.some(n => name === normalizePartner(n))) acc.kim += amount
          if (partnerNames.lim.some(n => name === normalizePartner(n))) acc.lim += amount
          return acc
        },
        { kim: 0, lim: 0 }
      )
    }

    const targetMonth = normalizeMonthKey(currentMonth)

    const { data: rangeWithdrawals } = await adminSupabase
      .from('partner_withdrawals')
      .select('amount, partner_name, partner, month_key, withdrawal_date')
      .order('withdrawal_date', { ascending: true })

    const monthFiltered = (rangeWithdrawals || []).filter((w) => {
      const keyFromMonth = normalizeMonthKey(w.month_key)
      const keyFromDate = normalizeMonthKey(
        typeof w.withdrawal_date === 'string' ? w.withdrawal_date : null
      )
      const normalizedKey = keyFromMonth || keyFromDate
      return normalizedKey === targetMonth
    })

    const rangeTotals = sumByRows(monthFiltered)
    let kimWithdrawals = rangeTotals.kim
    let limWithdrawals = rangeTotals.lim

    // 그래도 0이면 전체 합계 폴백
    let cumulativeClaims = { kim: 0, lim: 0 }
    if (kimWithdrawals === 0 && limWithdrawals === 0) {
      const { data: allWithdrawals } = await adminSupabase
        .from('partner_withdrawals')
        .select('amount, partner_name, partner')

      const allTotals = sumByRows(allWithdrawals || [])
      kimWithdrawals = allTotals.kim
      limWithdrawals = allTotals.lim

      const totalDiff = allTotals.kim - allTotals.lim
      cumulativeClaims = {
        kim: totalDiff < 0 ? Math.abs(totalDiff) : 0,
        lim: totalDiff > 0 ? totalDiff : 0
      }
    }

    // 정산 테이블 값이 있으면 우선
    if (settlement?.kim_withdrawals !== null && settlement?.kim_withdrawals !== undefined && settlement.kim_withdrawals > 0) {
      kimWithdrawals = settlement.kim_withdrawals
    }
    if (settlement?.lim_withdrawals !== null && settlement?.lim_withdrawals !== undefined && settlement.lim_withdrawals > 0) {
      limWithdrawals = settlement.lim_withdrawals
    }

    // 전체 인출 기반 누적 채권 (월 관계없이)
    const { data: allWithdrawalsForClaim } = await adminSupabase
      .from('partner_withdrawals')
      .select('amount, partner_name, partner')
    const allTotalsClaim = sumByRows(allWithdrawalsForClaim || [])
    const totalDiffClaim = allTotalsClaim.kim - allTotalsClaim.lim
    cumulativeClaims = {
      kim: totalDiffClaim < 0 ? Math.abs(totalDiffClaim) : cumulativeClaims.kim,
      lim: totalDiffClaim > 0 ? totalDiffClaim : cumulativeClaims.lim
    }

    // 7. 최근 6개월 추세 데이터
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const startMonth = sixMonthsAgo.toISOString().slice(0, 7)

    const { data: settlements } = await adminSupabase
      .from('monthly_settlements')
      .select('*')
      .gte('settlement_month', startMonth)
      .order('settlement_month', { ascending: true })

    // 8. 카테고리별 지출 분석
    const expensesByCategory = expenses?.reduce<Record<string, number>>((acc, e) => {
      const category = e.category || '기타'
      acc[category] = (acc[category] || 0) + (e.amount || 0)
      return acc
    }, {}) || {}

    // 9. 수익 카테고리별 분석
    const revenueByCategory = {
      '착수금': revenueData?.retainer_revenue || 0,
      '잔금': revenueData?.balance_revenue || 0,
      '성공보수': revenueData?.success_fee_revenue || 0,
      '상담료': revenueData?.consultation_revenue || 0,
    }

    // 10. 확인율 계산
    const confirmationRate = revenueData?.payment_count
      ? Math.round((revenueData.confirmed_count / revenueData.payment_count) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        month: currentMonth,

        // 요약 지표
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin: totalRevenue > 0
            ? Math.round((netProfit / totalRevenue) * 100)
            : 0,
          confirmationRate,
        },

        // 수익 상세
        revenue: {
          total: totalRevenue,
          confirmed: revenueData?.confirmed_revenue || 0,
          pending: revenueData?.pending_revenue || 0,
          paymentCount: revenueData?.payment_count || 0,
          byOffice: {
            pyeongtaek: revenueData?.pyeongtaek_revenue || 0,
            cheonan: revenueData?.cheonan_revenue || 0,
          },
          byCategory: revenueByCategory,
        },

        // 지출 상세
        expenses: {
          total: totalExpenses,
          byOffice: {
            pyeongtaek: pyeongtaekExpenses,
            cheonan: cheonanExpenses,
          },
          byCategory: expensesByCategory,
        },

        // 파트너 분배
        partners: {
          kim: {
            share: settlement?.kim_share ?? kimShare,
            withdrawals: kimWithdrawals,
            balance: kimShare - kimWithdrawals,
            accumulatedDebt: settlement?.kim_accumulated_debt || cumulativeClaims.kim,
          },
          lim: {
            share: settlement?.lim_share ?? limShare,
            withdrawals: limWithdrawals,
            balance: limShare - limWithdrawals,
            accumulatedDebt: settlement?.lim_accumulated_debt || cumulativeClaims.lim,
          },
        },

        // 월별 추세 (최근 6개월)
        trends: settlements?.map(s => ({
          month: s.settlement_month,
          revenue: s.total_revenue,
          expenses: s.total_expenses,
          netProfit: s.net_profit,
        })) || [],
      },
    })
  } catch (error) {
    console.error('Financial dashboard API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
