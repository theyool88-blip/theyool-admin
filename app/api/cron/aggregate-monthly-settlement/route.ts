import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Cron Job: 매월 말일 자동 정산 집계
 *
 * Vercel Cron 설정:
 * - Schedule: "0 0 1 * *" (매월 1일 00:00 UTC - 전월 정산)
 * - 또는 수동 트리거: GET /api/cron/aggregate-monthly-settlement
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Secret 검증 (프로덕션에서만)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    const now = new Date()

    // 전월 정산 (매월 1일에 실행되므로)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthKey = lastMonth.toISOString().slice(0, 7) // "YYYY-MM"

    console.log(`🔄 Aggregating settlement for ${monthKey}...`)

    // 1. 정산이 이미 존재하는지 확인
    const { data: existingSettlement } = await supabase
      .from('monthly_settlements')
      .select('*')
      .eq('settlement_month', monthKey)
      .single()

    if (existingSettlement && existingSettlement.is_settled) {
      return NextResponse.json({
        success: true,
        message: `Settlement for ${monthKey} is already finalized`,
        settlement: existingSettlement
      })
    }

    // 2. 해당 월의 총 지출 집계
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount')
      .eq('month_key', monthKey)

    if (expensesError) {
      console.error('Expenses fetch error:', expensesError)
      return NextResponse.json(
        { error: 'Failed to fetch expenses', details: expensesError },
        { status: 500 }
      )
    }

    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0

    // 3. 해당 월의 변호사별 인출 집계
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('partner_withdrawals')
      .select('partner_name, amount')
      .eq('month_key', monthKey)

    if (withdrawalsError) {
      console.error('Withdrawals fetch error:', withdrawalsError)
      return NextResponse.json(
        { error: 'Failed to fetch withdrawals', details: withdrawalsError },
        { status: 500 }
      )
    }

    const kimWithdrawals = withdrawals
      ?.filter(w => w.partner_name === '김현성')
      .reduce((sum, w) => sum + w.amount, 0) || 0

    const limWithdrawals = withdrawals
      ?.filter(w => w.partner_name === '임은지')
      .reduce((sum, w) => sum + w.amount, 0) || 0

    // 4. 전월 누적 채권/채무 조회
    const prevMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1)
    const prevMonthKey = prevMonth.toISOString().slice(0, 7)

    const { data: prevSettlement } = await supabase
      .from('monthly_settlements')
      .select('kim_accumulated_debt, lim_accumulated_debt')
      .eq('settlement_month', prevMonthKey)
      .single()

    const prevKimDebt = prevSettlement?.kim_accumulated_debt || 0
    const prevLimDebt = prevSettlement?.lim_accumulated_debt || 0

    // 5. 매출은 기본값 0 (수동 입력 필요)
    const totalRevenue = existingSettlement?.total_revenue || 0

    // 6. 정산 데이터 계산
    const netProfit = totalRevenue - totalExpenses
    const kimShare = Math.floor(netProfit / 2)
    const limShare = Math.floor(netProfit / 2)
    const kimNetBalance = kimShare - kimWithdrawals
    const limNetBalance = limShare - limWithdrawals
    const kimAccumulatedDebt = prevKimDebt + kimNetBalance
    const limAccumulatedDebt = prevLimDebt + limNetBalance

    const settlementData = {
      settlement_month: monthKey,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      kim_withdrawals: kimWithdrawals,
      lim_withdrawals: limWithdrawals,
      kim_accumulated_debt: kimAccumulatedDebt,
      lim_accumulated_debt: limAccumulatedDebt,
      is_settled: false,
      cheonan_revenue: existingSettlement?.cheonan_revenue || 0,
      pyeongtaek_revenue: existingSettlement?.pyeongtaek_revenue || 0
    }

    // 7. 정산 생성 또는 업데이트
    let settlement
    if (existingSettlement) {
      const { data, error } = await supabase
        .from('monthly_settlements')
        .update({
          total_expenses: totalExpenses,
          kim_withdrawals: kimWithdrawals,
          lim_withdrawals: limWithdrawals,
          kim_accumulated_debt: kimAccumulatedDebt,
          lim_accumulated_debt: limAccumulatedDebt,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSettlement.id)
        .select()
        .single()

      if (error) {
        console.error('Settlement update error:', error)
        return NextResponse.json(
          { error: 'Failed to update settlement', details: error },
          { status: 500 }
        )
      }
      settlement = data
    } else {
      const { data, error } = await supabase
        .from('monthly_settlements')
        .insert(settlementData)
        .select()
        .single()

      if (error) {
        console.error('Settlement insert error:', error)
        return NextResponse.json(
          { error: 'Failed to create settlement', details: error },
          { status: 500 }
        )
      }
      settlement = data
    }

    console.log(`✅ Cron: Aggregated settlement for ${monthKey}`)
    console.log(`   Total Expenses: ${totalExpenses.toLocaleString()}원`)
    console.log(`   Kim Withdrawals: ${kimWithdrawals.toLocaleString()}원`)
    console.log(`   Lim Withdrawals: ${limWithdrawals.toLocaleString()}원`)
    console.log(`   Kim Accumulated: ${kimAccumulatedDebt.toLocaleString()}원`)
    console.log(`   Lim Accumulated: ${limAccumulatedDebt.toLocaleString()}원`)

    return NextResponse.json({
      success: true,
      message: `Successfully aggregated settlement for ${monthKey}`,
      settlement,
      aggregation: {
        total_expenses: totalExpenses,
        kim_withdrawals: kimWithdrawals,
        lim_withdrawals: limWithdrawals,
        kim_accumulated_debt: kimAccumulatedDebt,
        lim_accumulated_debt: limAccumulatedDebt
      }
    })
  } catch (error) {
    console.error('Cron job error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
