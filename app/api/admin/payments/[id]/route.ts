import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdatePaymentRequest } from '@/types/payment'

// GET: Get single payment by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Failed to fetch payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to fetch payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update payment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdatePaymentRequest = await request.json()

    let caseNameFromCase: string | null | undefined = undefined
    if (body.case_id) {
      const { data: caseRow, error: caseError } = await supabase
        .from('legal_cases')
        .select('case_name')
        .eq('id', body.case_id)
        .single()
      if (caseError) {
        console.error('Failed to fetch case name:', caseError)
      } else {
        caseNameFromCase = caseRow?.case_name || null
      }
    }

    const shouldConfirm = !!(body.case_id || body.consultation_id || body.is_confirmed)
    const { data, error } = await supabase
      .from('payments')
      .update({
        ...body,
        case_name: body.case_name || caseNameFromCase || body.case_name,
        is_confirmed: shouldConfirm,
        confirmed_at: shouldConfirm ? new Date().toISOString() : body.confirmed_at ?? null,
        confirmed_by: shouldConfirm ? (user?.email || user?.id || 'admin') : body.confirmed_by || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update case total_received if case_id exists after update
    if (data.case_id) {
      const { data: sums, error: sumError } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', data.case_id)

      if (!sumError && sums) {
        const total = sums.reduce((sum, p) => sum + p.amount, 0)
        await supabase
          .from('legal_cases')
          .update({ total_received: total })
          .eq('id', data.case_id)
      }
    }

    // Update consultation status to 'payment_confirmed' if consultation_id was just linked
    if (data.consultation_id && body.consultation_id) {
      try {
        await supabase
          .from('consultations')
          .update({ status: 'payment_confirmed' })
          .eq('id', data.consultation_id)

        console.log(`✅ Consultation ${data.consultation_id} status updated to payment_confirmed`)
      } catch (consultationError) {
        console.error('Failed to update consultation status:', consultationError)
        // Don't fail the whole operation if status update fails
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to update payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete and capture the payment to recalc totals
    const { data: deletedRows, error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id)
      .select('case_id')

    if (error) {
      console.error('Failed to delete payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deleted = deletedRows?.[0]

    if (deleted?.case_id) {
      const { data: sums, error: sumError } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', deleted.case_id)

      if (!sumError && sums) {
        const total = sums.reduce((sum, p) => sum + p.amount, 0)
        await supabase
          .from('legal_cases')
          .update({ total_received: total })
          .eq('id', deleted.case_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
