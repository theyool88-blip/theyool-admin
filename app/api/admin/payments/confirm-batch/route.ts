import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import { confirmPaymentsBatchWithTenant } from '@/lib/supabase/payments-aggregation'

interface BatchConfirmBody {
  paymentIds: string[]
  confirmedBy: string
}

/**
 * POST /api/admin/payments/confirm-batch
 *
 * 입금 일괄 확인 처리 (테넌트 격리 적용)
 * Body: { paymentIds: string[], confirmedBy: string }
 */
export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const body = (await request.json()) as Partial<BatchConfirmBody>
    const { paymentIds, confirmedBy } = body

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json(
        { error: 'paymentIds array is required' },
        { status: 400 }
      )
    }

    if (!confirmedBy) {
      return NextResponse.json(
        { error: 'confirmedBy is required' },
        { status: 400 }
      )
    }

    // 테넌트 ID 전달
    const tenantId = !tenant.isSuperAdmin && tenant.tenantId ? tenant.tenantId : undefined

    const result = await confirmPaymentsBatchWithTenant(paymentIds, confirmedBy, tenantId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      message: `Successfully confirmed ${result.count} payments`,
    })
  } catch (error) {
    console.error('Batch confirmation API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
