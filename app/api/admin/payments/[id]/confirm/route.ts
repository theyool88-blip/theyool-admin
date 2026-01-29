import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import { confirmPaymentWithTenant } from '@/lib/supabase/payments-aggregation'

interface ConfirmPaymentBody {
  confirmedBy: string
  notes?: string
}

/**
 * POST /api/admin/payments/[id]/confirm
 *
 * 입금 확인 처리 (테넌트 격리 적용)
 * Body: { confirmedBy: string, notes?: string }
 */
export const POST = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const body = (await request.json()) as Partial<ConfirmPaymentBody>
    const { confirmedBy, notes } = body

    if (!confirmedBy) {
      return NextResponse.json(
        { error: 'confirmedBy is required' },
        { status: 400 }
      )
    }

    // 테넌트 ID 전달
    const tenantId = !tenant.isSuperAdmin && tenant.tenantId ? tenant.tenantId : undefined

    const result = await confirmPaymentWithTenant(id, confirmedBy, tenantId, notes)

    if (!result.success) {
      if (result.error === 'Payment not found in your tenant') {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Payment confirmed successfully',
    })
  } catch (error) {
    console.error('Payment confirmation API error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
