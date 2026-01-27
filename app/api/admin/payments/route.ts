import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import { canAccessModuleWithContext } from '@/lib/auth/permissions'
import type { CreatePaymentRequest } from '@/types/payment'

/**
 * GET /api/admin/payments
 * List payments with filters (테넌트 격리 + 권한 체크)
 */
export const GET = withTenant(async (request, { tenant }) => {
  // 회계 모듈 권한 체크
  if (!canAccessModuleWithContext(tenant, 'payments')) {
    return NextResponse.json(
      { error: '수임료 관리 접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

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

    // NOTE: is_confirmed 컬럼이 스키마에서 제거됨
    // 확인 상태 필터 비활성화
    // const isConfirmed = searchParams.get('is_confirmed')

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
  // 회계 모듈 권한 체크
  if (!canAccessModuleWithContext(tenant, 'payments')) {
    return NextResponse.json(
      { error: '수임료 관리 접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

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

    let caseNameFromCase: string | null = null
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

    // NOTE: is_confirmed, confirmed_at, confirmed_by 컬럼이 스키마에서 제거됨
    const { data, error } = await supabase
      .from('payments')
      .insert([withTenantId({
        payment_date: body.payment_date,
        depositor_name: body.depositor_name,
        amount: body.amount,
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
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Failed to create payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // NOTE: total_received 컬럼이 스키마에서 제거됨
    // 입금 합계는 payments 테이블을 조회하여 실시간 계산

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
