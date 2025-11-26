/**
 * 입금 집계 및 정산 통합 함수
 *
 * 이 파일은 입금 데이터를 집계하고 지출 관리 시스템과 통합하여
 * 월별 재무 정산을 자동화하는 함수들을 제공합니다.
 */

import { createAdminClient } from './admin'

export interface MonthlyRevenueData {
  month_key: string
  total_revenue: number
  payment_count: number
  avg_payment: number

  // 사무소별
  pyeongtaek_revenue: number
  pyeongtaek_count: number
  cheonan_revenue: number
  cheonan_count: number

  // 확인 상태별
  confirmed_revenue: number
  confirmed_count: number
  pending_revenue: number
  pending_count: number

  // 카테고리별
  retainer_revenue: number  // 착수금
  retainer_count: number
  balance_revenue: number   // 잔금
  balance_count: number
  success_fee_revenue: number  // 성공보수
  success_fee_count: number
  consultation_revenue: number  // 상담료
  consultation_count: number
}

/**
 * 특정 월의 입금 합계 계산
 *
 * @param monthKey - YYYY-MM 형식의 월 키
 * @returns 월별 수익 집계 데이터
 */
export async function calculateMonthlyRevenue(monthKey: string): Promise<MonthlyRevenueData | null> {
  const supabase = createAdminClient()

  try {
    // monthly_revenue_aggregation 뷰에서 조회
    const { data, error } = await supabase
      .from('monthly_revenue_aggregation')
      .select('*')
      .eq('month_key', monthKey)
      .single()

    if (error) {
      // 뷰가 없으면 직접 계산
      console.log('View not available, calculating manually...')
      return await calculateMonthlyRevenueManually(monthKey)
    }

    return data as MonthlyRevenueData
  } catch (error) {
    console.error('Error calculating monthly revenue:', error)
    return null
  }
}

/**
 * 뷰가 없을 경우 수동으로 월별 수익 계산
 */
async function calculateMonthlyRevenueManually(monthKey: string): Promise<MonthlyRevenueData | null> {
  const supabase = createAdminClient()

  const startDate = `${monthKey}-01`
  const endDate = `${monthKey}-31`

  const { data: payments, error } = await supabase
    .from('payments')
    .select('amount, office_location, payment_category, is_confirmed')
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)

  if (error || !payments) {
    console.error('Error fetching payments:', error)
    return null
  }

  // 집계 계산
  const result: MonthlyRevenueData = {
    month_key: monthKey,
    total_revenue: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    payment_count: payments.length,
    avg_payment: payments.length > 0
      ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) / payments.length
      : 0,

    pyeongtaek_revenue: payments
      .filter(p => p.office_location === '평택')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    pyeongtaek_count: payments.filter(p => p.office_location === '평택').length,

    cheonan_revenue: payments
      .filter(p => p.office_location === '천안')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    cheonan_count: payments.filter(p => p.office_location === '천안').length,

    confirmed_revenue: payments
      .filter(p => p.is_confirmed === true)
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    confirmed_count: payments.filter(p => p.is_confirmed === true).length,

    pending_revenue: payments
      .filter(p => p.is_confirmed === false)
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    pending_count: payments.filter(p => p.is_confirmed === false).length,

    retainer_revenue: payments
      .filter(p => p.payment_category === '착수금')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    retainer_count: payments.filter(p => p.payment_category === '착수금').length,

    balance_revenue: payments
      .filter(p => p.payment_category === '잔금')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    balance_count: payments.filter(p => p.payment_category === '잔금').length,

    success_fee_revenue: payments
      .filter(p => p.payment_category === '성공보수')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    success_fee_count: payments.filter(p => p.payment_category === '성공보수').length,

    consultation_revenue: payments
      .filter(p => p.payment_category === '모든 상담')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    consultation_count: payments.filter(p => p.payment_category === '모든 상담').length,
  }

  return result
}

/**
 * 입금 확인 처리
 *
 * @param paymentId - 확인할 입금 ID
 * @param confirmedBy - 확인자 (관리자 이메일 또는 이름)
 * @param notes - 확인 메모 (선택사항)
 * @returns 업데이트된 입금 정보
 */
export async function confirmPayment(
  paymentId: string,
  confirmedBy: string,
  _notes?: string
) {
  const supabase = createAdminClient()
  void _notes

  try {
    // 1. 입금 확인 처리
    const { data: payment, error: updateError } = await supabase
      .from('payments')
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 2. 해당 월 정산 자동 업데이트 (있다면)
    if (payment && payment.month_key) {
      await syncMonthlySettlement(payment.month_key)
    }

    return { success: true, data: payment }
  } catch (error) {
    console.error('Error confirming payment:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * 입금 일괄 확인 처리
 *
 * @param paymentIds - 확인할 입금 ID 배열
 * @param confirmedBy - 확인자
 * @returns 처리 결과
 */
export async function confirmPaymentsBatch(
  paymentIds: string[],
  confirmedBy: string
) {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('payments')
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      })
      .in('id', paymentIds)
      .select()

    if (error) {
      return { success: false, error: error.message }
    }

    // 영향받은 월의 정산 업데이트
    const uniqueMonths = [...new Set(data.map(p => p.month_key).filter(Boolean))]
    for (const month of uniqueMonths) {
      await syncMonthlySettlement(month as string)
    }

    return { success: true, data, count: data.length }
  } catch (error) {
    console.error('Error confirming payments batch:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * 정산 데이터 자동 업데이트 (수익 + 지출 통합)
 *
 * @param monthKey - YYYY-MM 형식의 월 키
 * @returns 업데이트 결과
 */
export async function syncMonthlySettlement(monthKey: string) {
  const supabase = createAdminClient()

  try {
    // 1. 수익 집계
    const revenueData = await calculateMonthlyRevenue(monthKey)

    if (!revenueData) {
      console.error('Failed to calculate revenue for', monthKey)
      return { success: false, error: 'Failed to calculate revenue' }
    }

    // 2. 기존 정산 레코드 확인
    const { data: existingSettlement } = await supabase
      .from('monthly_settlements')
      .select('*')
      .eq('settlement_month', monthKey)
      .single()

    if (existingSettlement) {
      // 3. 기존 정산 업데이트 (수익 데이터만 갱신)
      const { data, error } = await supabase
        .from('monthly_settlements')
        .update({
          total_revenue: revenueData.total_revenue,
          pyeongtaek_revenue: revenueData.pyeongtaek_revenue,
          cheonan_revenue: revenueData.cheonan_revenue,
          updated_at: new Date().toISOString(),
        })
        .eq('settlement_month', monthKey)
        .select()
        .single()

      if (error) {
        console.error('Error updating settlement:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } else {
      // 4. 신규 정산 생성 (지출/인출은 0으로 초기화)
      const { data, error } = await supabase
        .from('monthly_settlements')
        .insert({
          settlement_month: monthKey,
          total_revenue: revenueData.total_revenue,
          pyeongtaek_revenue: revenueData.pyeongtaek_revenue,
          cheonan_revenue: revenueData.cheonan_revenue,
          total_expenses: 0,
          pyeongtaek_expenses: 0,
          cheonan_expenses: 0,
          net_profit: revenueData.total_revenue,
          kim_share: Math.floor(revenueData.total_revenue / 2),
          lim_share: Math.ceil(revenueData.total_revenue / 2),
          kim_withdrawals: 0,
          lim_withdrawals: 0,
          kim_net_balance: Math.floor(revenueData.total_revenue / 2),
          lim_net_balance: Math.ceil(revenueData.total_revenue / 2),
          kim_accumulated_debt: 0,
          lim_accumulated_debt: 0,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating settlement:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    }
  } catch (error) {
    console.error('Error syncing monthly settlement:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * 확인율 계산
 *
 * @param monthKey - YYYY-MM 형식의 월 키
 * @returns 확인율 (%)
 */
export async function calculateConfirmationRate(monthKey: string): Promise<number> {
  const revenueData = await calculateMonthlyRevenue(monthKey)

  if (!revenueData || revenueData.payment_count === 0) {
    return 0
  }

  return Math.round((revenueData.confirmed_count / revenueData.payment_count) * 100)
}

/**
 * 미확인 입금 목록 조회
 *
 * @param monthKey - YYYY-MM 형식의 월 키 (선택사항)
 * @returns 미확인 입금 목록
 */
export async function getPendingPayments(monthKey?: string) {
  const supabase = createAdminClient()

  try {
    let query = supabase
      .from('payments')
      .select('*')
      .eq('is_confirmed', false)
      .order('payment_date', { ascending: false })

    if (monthKey) {
      query = query.eq('month_key', monthKey)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data, count: data?.length || 0 }
  } catch (error) {
    console.error('Error fetching pending payments:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
