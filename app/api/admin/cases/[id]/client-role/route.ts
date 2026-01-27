import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/cases/[id]/client-role
 * 현재 의뢰인 역할 조회 (테넌트 격리 적용)
 */
export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 먼저 해당 사건이 현재 테넌트 소속인지 확인
    let caseQuery = adminClient
      .from('legal_cases')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: caseData, error: caseError } = await caseQuery.single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found in your tenant' },
        { status: 404 }
      )
    }

    // case_clients에서 primary 의뢰인의 linked_party_id 조회
    const { data: caseClient, error: clientError } = await adminClient
      .from('case_clients')
      .select('linked_party_id')
      .eq('case_id', id)
      .eq('is_primary_client', true)
      .maybeSingle()

    if (clientError) {
      console.error('Error fetching case client:', clientError)
      return NextResponse.json(
        { error: `Failed to fetch client role: ${clientError.message}` },
        { status: 500 }
      )
    }

    let clientRole: string | null = null

    if (caseClient?.linked_party_id) {
      // linked_party_id로 당사자의 party_type 조회
      const { data: party } = await adminClient
        .from('case_parties')
        .select('party_type')
        .eq('id', caseClient.linked_party_id)
        .single()

      if (party) {
        clientRole = party.party_type
      }
    } else {
      // linked_party_id가 없으면 is_primary=true인 당사자의 party_type 사용
      const { data: primaryParty } = await adminClient
        .from('case_parties')
        .select('party_type')
        .eq('case_id', id)
        .eq('is_primary', true)
        .maybeSingle()

      if (primaryParty) {
        clientRole = primaryParty.party_type
      }
    }

    return NextResponse.json({
      success: true,
      client_role: clientRole,
      client_role_status: 'confirmed',
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/client-role:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * PATCH /api/admin/cases/[id]/client-role
 * 의뢰인 역할 변경 (테넌트 격리 적용)
 */
export const PATCH = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const { client_role } = body

    // Validation
    if (!client_role || !['plaintiff', 'defendant'].includes(client_role)) {
      return NextResponse.json(
        { error: 'Invalid client_role. Must be "plaintiff" or "defendant"' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 먼저 해당 사건이 현재 테넌트 소속인지 확인
    let caseQuery = adminClient
      .from('legal_cases')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: caseData, error: caseError } = await caseQuery.single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found in your tenant' },
        { status: 404 }
      )
    }

    // 1. case_clients에서 primary 의뢰인의 linked_party_id 조회
    const { data: caseClient } = await adminClient
      .from('case_clients')
      .select('linked_party_id')
      .eq('case_id', id)
      .eq('is_primary_client', true)
      .maybeSingle()

    // 2. case_parties 동기화 (역할 변경 시 당사자 유형도 업데이트)
    const clientPartyType = client_role === 'plaintiff' ? 'plaintiff' : 'defendant'
    const opponentPartyType = client_role === 'plaintiff' ? 'defendant' : 'plaintiff'

    // 의뢰인 당사자 업데이트
    if (caseClient?.linked_party_id) {
      await adminClient
        .from('case_parties')
        .update({ party_type: clientPartyType, updated_at: new Date().toISOString() })
        .eq('id', caseClient.linked_party_id)
    } else {
      await adminClient
        .from('case_parties')
        .update({ party_type: clientPartyType, updated_at: new Date().toISOString() })
        .eq('case_id', id)
        .eq('is_primary', true)
    }

    // 상대방 당사자 업데이트
    await adminClient
      .from('case_parties')
      .update({ party_type: opponentPartyType, updated_at: new Date().toISOString() })
      .eq('case_id', id)
      .eq('is_primary', false)
      .eq('manual_override', false)

    console.log(`Client role updated: case=${id}, role=${client_role}`)

    return NextResponse.json({
      success: true,
      data: {
        id,
        client_role: clientPartyType,
        client_role_status: 'confirmed',
      },
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/cases/[id]/client-role:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
