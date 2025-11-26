import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confirmPayment } from '@/lib/supabase/payments-aggregation'

interface ConfirmPaymentBody {
  confirmedBy: string
  notes?: string
}

/**
 * POST /api/admin/payments/[id]/confirm
 *
 * 입금 확인 처리
 * Body: { confirmedBy: string, notes?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = (await request.json()) as Partial<ConfirmPaymentBody>
    const { confirmedBy, notes } = body

    if (!confirmedBy) {
      return NextResponse.json(
        { error: 'confirmedBy is required' },
        { status: 400 }
      )
    }

    const result = await confirmPayment(id, confirmedBy, notes)

    if (!result.success) {
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
}
