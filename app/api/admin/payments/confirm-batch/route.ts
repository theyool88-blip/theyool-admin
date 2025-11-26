import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confirmPaymentsBatch } from '@/lib/supabase/payments-aggregation'

interface BatchConfirmBody {
  paymentIds: string[]
  confirmedBy: string
}

/**
 * POST /api/admin/payments/confirm-batch
 *
 * 입금 일괄 확인 처리
 * Body: { paymentIds: string[], confirmedBy: string }
 */
export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    const result = await confirmPaymentsBatch(paymentIds, confirmedBy)

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
}
