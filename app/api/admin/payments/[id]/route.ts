import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withTenant } from '@/lib/api/with-tenant'
import type { UpdatePaymentRequest } from '@/types/payment'

// GET: Get single payment by ID
export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('payments')
      .select('*')
      .eq('id', id)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query.single()

    if (error) {
      console.error('Failed to fetch payment:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to fetch payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// PATCH: Update payment
export const PATCH = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const body: UpdatePaymentRequest = await request.json()

    // 기존 결제 데이터 조회 (테넌트 검증 포함)
    let existingQuery = supabase
      .from('payments')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      existingQuery = existingQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingPayment, error: existingError } = await existingQuery.single()

    if (existingError || !existingPayment) {
      return NextResponse.json({ error: 'Payment not found in your tenant' }, { status: 404 })
    }

    let caseNameFromCase: string | null | undefined = undefined
    if (body.case_id) {
      // case_id 변경 시 해당 케이스가 현재 테넌트 소속인지 확인
      let caseQuery = supabase
        .from('legal_cases')
        .select('case_name, tenant_id')
        .eq('id', body.case_id)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data: caseRow, error: caseError } = await caseQuery.single()

      if (caseError || !caseRow) {
        return NextResponse.json({ error: 'Case not found in your tenant' }, { status: 403 })
      }
      caseNameFromCase = caseRow.case_name || null
    }

    // consultation_id 변경 시 해당 상담이 현재 테넌트 소속인지 확인
    if (body.consultation_id) {
      let consultationQuery = supabase
        .from('consultations')
        .select('id, tenant_id')
        .eq('id', body.consultation_id)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        consultationQuery = consultationQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data: consultation, error: consultationError } = await consultationQuery.single()

      if (consultationError || !consultation) {
        return NextResponse.json({ error: 'Consultation not found in your tenant' }, { status: 403 })
      }
    }

    // NOTE: is_confirmed, confirmed_at, confirmed_by 컬럼이 스키마에서 제거됨
    let updateQuery = supabase
      .from('payments')
      .update({
        ...body,
        case_name: body.case_name || caseNameFromCase || body.case_name,
      })
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await updateQuery.select().single()

    if (error) {
      console.error('Failed to update payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // NOTE: total_received 컬럼이 스키마에서 제거됨
    // 입금 합계는 payments 테이블을 조회하여 실시간 계산

    // Update consultation status to 'payment_confirmed' if consultation_id was just linked
    if (data.consultation_id && body.consultation_id) {
      try {
        let consultationUpdateQuery = supabase
          .from('consultations')
          .update({ status: 'payment_confirmed' })
          .eq('id', data.consultation_id)

        if (!tenant.isSuperAdmin && tenant.tenantId) {
          consultationUpdateQuery = consultationUpdateQuery.eq('tenant_id', tenant.tenantId)
        }

        await consultationUpdateQuery

        console.log(`✅ Consultation ${data.consultation_id} status updated to payment_confirmed`)
      } catch (consultationError) {
        console.error('Failed to update consultation status:', consultationError)
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Failed to update payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// DELETE: Delete payment
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 먼저 해당 결제가 현재 테넌트 소속인지 확인
    let checkQuery = supabase
      .from('payments')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      checkQuery = checkQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingPayment, error: checkError } = await checkQuery.single()

    if (checkError || !existingPayment) {
      return NextResponse.json({ error: 'Payment not found in your tenant' }, { status: 404 })
    }

    // 결제 삭제
    let deleteQuery = supabase
      .from('payments')
      .delete()
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('Failed to delete payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // NOTE: total_received 컬럼이 스키마에서 제거됨
    // 입금 합계는 payments 테이블을 조회하여 실시간 계산

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
