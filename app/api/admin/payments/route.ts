import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import type { CreatePaymentRequest } from '@/types/payment'

/**
 * GET /api/admin/payments
 * List payments with filters (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    // Build query
    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    // Apply filters
    const officeLocation = searchParams.get('office_location')
    if (officeLocation) {
      query = query.eq('office_location', officeLocation)
    }

    const paymentCategory = searchParams.get('payment_category')
    if (paymentCategory) {
      query = query.eq('payment_category', paymentCategory)
    }

    const caseId = searchParams.get('case_id')
    if (caseId) {
      query = query.eq('case_id', caseId)
    }

    const consultationId = searchParams.get('consultation_id')
    if (consultationId) {
      query = query.eq('consultation_id', consultationId)
    }

    const fromDate = searchParams.get('from_date')
    if (fromDate) {
      query = query.gte('payment_date', fromDate)
    }

    const toDate = searchParams.get('to_date')
    if (toDate) {
      query = query.lte('payment_date', toDate)
    }

    const depositorName = searchParams.get('depositor_name')
    if (depositorName) {
      query = query.ilike('depositor_name', `%${depositorName}%`)
    }

    const phone = searchParams.get('phone')
    if (phone) {
      query = query.ilike('phone', `%${phone}%`)
    }

    // 확인 상태 필터
    const isConfirmed = searchParams.get('is_confirmed')
    if (isConfirmed === 'true') {
      query = query.eq('is_confirmed', true)
    } else if (isConfirmed === 'false') {
      query = query.eq('is_confirmed', false)
    }

    // Sorting
    const sortBy = searchParams.get('sort_by') || 'payment_date'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Failed to fetch payments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, count })
  } catch (error) {
    console.error('Failed to fetch payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * POST /api/admin/payments
 * Create new payment (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient()

    const body: CreatePaymentRequest = await request.json()

    // Validate required fields
    if (!body.payment_date || !body.depositor_name || !body.amount || !body.payment_category) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_date, depositor_name, amount, payment_category' },
        { status: 400 }
      )
    }

    let officeFromCase: string | null = null
    let caseNameFromCase: string | null = null
    if (body.case_id) {
      const { data: caseRow, error: caseError } = await supabase
        .from('legal_cases')
        .select('office, case_name')
        .eq('id', body.case_id)
        .single()
      if (caseError) {
        console.error('Failed to fetch case office:', caseError)
      } else {
        officeFromCase = caseRow?.office || null
        caseNameFromCase = caseRow?.case_name || null
      }
    }

    const shouldConfirm = !!(body.case_id || body.consultation_id || body.is_confirmed)
    const confirmedBy = shouldConfirm ? (tenant.memberDisplayName || 'admin') : null
    const { data, error } = await supabase
      .from('payments')
      .insert([withTenantId({
        payment_date: body.payment_date,
        depositor_name: body.depositor_name,
        amount: body.amount,
        office_location: officeFromCase || body.office_location || null,
        payment_category: body.payment_category,
        case_id: body.case_id || null,
        case_name: body.case_name || caseNameFromCase || null,
        consultation_id: body.consultation_id || null,
        receipt_type: body.receipt_type || null,
        receipt_issued_at: body.receipt_issued_at || null,
        phone: body.phone || null,
        memo: body.memo || null,
        admin_notes: body.admin_notes || null,
        imported_from_csv: false,
        is_confirmed: shouldConfirm,
        confirmed_at: shouldConfirm ? new Date().toISOString() : null,
        confirmed_by: confirmedBy,
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Failed to create payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update case total_received if case_id exists
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

    // Update consultation status to 'payment_confirmed' if consultation_id exists
    if (data.consultation_id) {
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

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Failed to create payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
