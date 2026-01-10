import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * GET /api/admin/cases/[id]/client-role
 * 현재 의뢰인 역할 조회
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

    const { data, error } = await adminClient
      .from('legal_cases')
      .select('client_role, client_role_status')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching client role:', error)
      return NextResponse.json(
        { error: `Failed to fetch client role: ${error.message}` },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      client_role: data.client_role,
      client_role_status: data.client_role_status,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/client-role:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/cases/[id]/client-role
 * 의뢰인 역할 확정/변경
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
    const { client_role, status = 'confirmed' } = body

    // Validation
    if (!client_role || !['plaintiff', 'defendant'].includes(client_role)) {
      return NextResponse.json(
        { error: 'Invalid client_role. Must be "plaintiff" or "defendant"' },
        { status: 400 }
      )
    }

    if (!['provisional', 'confirmed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "provisional" or "confirmed"' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 1. legal_cases 업데이트
    const { data, error } = await adminClient
      .from('legal_cases')
      .update({
        client_role,
        client_role_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, client_role, client_role_status, client_id, opponent_name')
      .single()

    if (error) {
      console.error('Error updating client role:', error)
      return NextResponse.json(
        { error: `Failed to update client role: ${error.message}` },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // 2. case_parties 동기화 (역할 변경 시 당사자 유형도 업데이트)
    // 의뢰인(is_our_client=true)의 party_type 업데이트
    const clientPartyType = client_role === 'plaintiff' ? 'plaintiff' : 'defendant'
    const opponentPartyType = client_role === 'plaintiff' ? 'defendant' : 'plaintiff'

    // 의뢰인 당사자 업데이트
    await adminClient
      .from('case_parties')
      .update({ party_type: clientPartyType })
      .eq('case_id', id)
      .eq('is_our_client', true)

    // 상대방 당사자 업데이트 (manual_override가 false인 경우만)
    await adminClient
      .from('case_parties')
      .update({ party_type: opponentPartyType })
      .eq('case_id', id)
      .eq('is_our_client', false)
      .eq('manual_override', false)

    console.log(`Client role updated: case=${id}, role=${client_role}, status=${status}`)

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        client_role: data.client_role,
        client_role_status: data.client_role_status,
      },
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/cases/[id]/client-role:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
