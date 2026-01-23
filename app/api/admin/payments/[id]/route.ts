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

    // 기존 결제 데이터 조회 (부분 수정 시 기존 상태 유지를 위해)
    const { data: existingPayment, error: existingError } = await supabase
      .from('payments')
      .select('case_id, is_confirmed, confirmed_at, confirmed_by')
      .eq('id', id)
      .single()

    if (existingError || !existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const previousCaseId = existingPayment.case_id

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

    // 기존 확인 상태 유지하면서, 명시적으로 case_id/consultation_id/is_confirmed를 보낸 경우만 확인 처리
    const shouldConfirm = body.is_confirmed === true
      || (body.is_confirmed !== false && existingPayment.is_confirmed)
      || !!(body.case_id || body.consultation_id)

    const { data, error } = await supabase
      .from('payments')
      .update({
        ...body,
        case_name: body.case_name || caseNameFromCase || body.case_name,
        is_confirmed: shouldConfirm,
        confirmed_at: shouldConfirm
          ? (existingPayment.confirmed_at || new Date().toISOString())
          : null,
        confirmed_by: shouldConfirm
          ? (existingPayment.confirmed_by || user?.email || user?.id || 'admin')
          : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update case total_received - 이전 case_id와 새 case_id 모두 처리
    const caseIdsToUpdate = new Set<string>()
    if (previousCaseId) caseIdsToUpdate.add(previousCaseId)
    if (data.case_id) caseIdsToUpdate.add(data.case_id)

    for (const caseId of caseIdsToUpdate) {
      const { data: sums, error: sumError } = await supabase
        .from('payments')
        .select('amount')
        .eq('case_id', caseId)

      if (!sumError && sums) {
        const total = sums.reduce((sum, p) => sum + p.amount, 0)
        await supabase
          .from('legal_cases')
          .update({ total_received: total })
          .eq('id', caseId)
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
