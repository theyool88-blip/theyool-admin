import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * GET /api/admin/cases/[id]/client-role
 * 현재 의뢰인 역할 조회 (case_clients + case_parties에서 추론)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

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
      // client_role_status는 더 이상 사용하지 않음 (항상 confirmed로 간주)
      client_role_status: 'confirmed',
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/client-role:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/cases/[id]/client-role
 * 의뢰인 역할 변경 (case_parties.party_type 업데이트)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // 의뢰인 당사자 업데이트 (linked_party_id 또는 is_primary=true)
    if (caseClient?.linked_party_id) {
      await adminClient
        .from('case_parties')
        .update({ party_type: clientPartyType, updated_at: new Date().toISOString() })
        .eq('id', caseClient.linked_party_id)
    } else {
      // linked_party_id가 없으면 is_primary=true인 당사자 업데이트
      await adminClient
        .from('case_parties')
        .update({ party_type: clientPartyType, updated_at: new Date().toISOString() })
        .eq('case_id', id)
        .eq('is_primary', true)
    }

    // 상대방 당사자 업데이트 (is_primary=false, manual_override=false인 경우만)
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
}
