import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/cases
 * Fetch all legal cases with client and payment info (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const adminClient = createAdminClient()

    // 테넌트 격리된 사건 조회
    let query = adminClient
      .from('legal_cases')
      .select(`
        id,
        contract_number,
        case_name,
        case_type,
        client_id,
        status,
        contract_date,
        court_case_number,
        tenant_id,
        assigned_to,
        client:clients (
          id,
          name
        ),
        assigned_member:tenant_members!assigned_to (
          id,
          display_name,
          role
        )
      `)
      .order('created_at', { ascending: false })

    // 슈퍼 어드민이 아니면 테넌트 필터 적용
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data: cases, error } = await query

    if (error) {
      console.error('Error fetching cases:', error)
      return NextResponse.json(
        { error: `Failed to fetch cases: ${error.message}` },
        { status: 500 }
      )
    }

    // Fetch payment info for each case
    const casesWithPayments = await Promise.all(
      (cases || []).map(async (legalCase) => {
        const { data: payments } = await adminClient
          .from('payments')
          .select('amount')
          .eq('case_id', legalCase.id)

        const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
        const paymentCount = payments?.length || 0

        // Supabase joins return arrays, extract first element
        const clientData = Array.isArray(legalCase.client) ? legalCase.client[0] : legalCase.client

        return {
          ...legalCase,
          client: clientData,
          payment_info: {
            total_amount: totalAmount,
            payment_count: paymentCount
          }
        }
      })
    )

    return NextResponse.json({ cases: casesWithPayments })
  } catch (error) {
    console.error('Error in GET /api/admin/cases:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/cases
 * Create a new legal case (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const body = await request.json() as {
      case_name?: string
      case_type?: string
      client_id?: string
      new_client?: {
        name?: string
        phone?: string
        email?: string
        birth_date?: string
        address?: string
      }
      assigned_to?: string
      status?: string
      contract_date?: string
      retainer_fee?: number
      success_fee_agreement?: string
      notes?: string
      court_case_number?: string
      court_name?: string
      judge_name?: string
      client_role?: 'plaintiff' | 'defendant'
    }

    // Validate required fields
    if (!body.case_name || !body.case_type) {
      return NextResponse.json(
        { error: 'Missing required fields: case_name, case_type' },
        { status: 400 }
      )
    }

    // client_id 또는 new_client 중 하나는 있어야 함
    if (!body.client_id && !body.new_client) {
      return NextResponse.json(
        { error: 'Either client_id or new_client is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    let clientId = body.client_id

    // 새 의뢰인 생성 (테넌트 ID 포함)
    if (body.new_client) {
      if (!body.new_client.name || !body.new_client.phone) {
        return NextResponse.json(
          { error: 'Client name and phone are required' },
          { status: 400 }
        )
      }

      const { data: newClient, error: clientError } = await adminClient
        .from('clients')
        .insert([withTenantId({
          name: body.new_client.name,
          phone: body.new_client.phone,
          email: body.new_client.email || null,
          birth_date: body.new_client.birth_date || null,
          address: body.new_client.address || null
        }, tenant)])
        .select()
        .single()

      if (clientError) {
        console.error('Error creating client:', clientError)
        return NextResponse.json(
          { error: `Failed to create client: ${clientError.message}` },
          { status: 500 }
        )
      }

      clientId = newClient.id
    }

    // Create the case (테넌트 ID 포함)
    const { data: newCase, error } = await adminClient
      .from('legal_cases')
      .insert([withTenantId({
        case_name: body.case_name,
        client_id: clientId,
        case_type: body.case_type,
        assigned_to: body.assigned_to || null,
        status: body.status || '진행중',
        contract_date: body.contract_date || new Date().toISOString().split('T')[0],
        retainer_fee: body.retainer_fee || null,
        success_fee_agreement: body.success_fee_agreement || null,
        notes: body.notes || null,
        court_case_number: body.court_case_number || null,
        court_name: body.court_name || null,
        judge_name: body.judge_name || null,
        client_role: body.client_role || null
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Error creating case:', error)
      return NextResponse.json(
        { error: `Failed to create case: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newCase
    })
  } catch (error) {
    console.error('Error in POST /api/admin/cases:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
