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
    // NOTE: monthly_settlements 테이블이 스키마에서 제거됨 (SaaS 전환으로 불필요)
    // 정산 기능이 필요하면 테넌트별 설정으로 재구현 필요

    // 4. 순이익 계산
    const totalRevenue = revenueData?.total_revenue || 0
    const netProfit = totalRevenue - totalExpenses

    // 5. 파트너별 분배 (50:50) - 테이블 제거로 기본값 계산
    // NOTE: monthly_settlements, partner_withdrawals 테이블이 스키마에서 제거됨
    // SaaS 전환으로 더율 특화 기능 제거 - 파트너 정산 기능 비활성화
    const kimShare = Math.floor(netProfit / 2)
    const limShare = Math.ceil(netProfit / 2)
    const kimWithdrawals = 0
    const limWithdrawals = 0
    const cumulativeClaims = { kim: 0, lim: 0 }

    // 7. 최근 6개월 추세 데이터
    // NOTE: monthly_settlements 테이블이 스키마에서 제거됨
    // 추세 데이터는 payments와 expenses에서 직접 집계하도록 변경 필요
    const settlements: Array<{
      settlement_month: string
      total_revenue: number
      total_expenses: number
      net_profit: number
    }> = []

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

        // 파트너 분배 (테이블 제거로 기본값 계산)
        partners: {
          kim: {
            share: kimShare,
            withdrawals: kimWithdrawals,
            balance: kimShare - kimWithdrawals,
            accumulatedDebt: cumulativeClaims.kim,
          },
          lim: {
            share: limShare,
            withdrawals: limWithdrawals,
            balance: limShare - limWithdrawals,
            accumulatedDebt: cumulativeClaims.lim,
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
