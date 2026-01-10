import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * PATCH /api/admin/cases/[id]
 * Update a legal case with case_parties sync
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

    const adminClient = createAdminClient()

    // 1. 기존 사건 정보 조회 (변경 감지용)
    const { data: existingCase, error: fetchError } = await adminClient
      .from('legal_cases')
      .select('client_id, opponent_name, client_role')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching existing case:', fetchError)
      return NextResponse.json(
        { error: `Case not found: ${fetchError.message}` },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // 2. legal_cases 업데이트
    const { data, error } = await adminClient
      .from('legal_cases')
      .update({
        contract_number: body.contract_number || null,
        case_name: body.case_name,
        client_id: body.client_id,
        status: body.status,
        assigned_to: body.assigned_to || null,
        contract_date: body.contract_date || null,
        retainer_fee: body.retainer_fee,
        total_received: body.total_received,
        success_fee_agreement: body.success_fee_agreement || null,
        calculated_success_fee: body.calculated_success_fee,
        court_case_number: body.court_case_number || null,
        court_name: body.court_name || null,
        case_type: body.case_type || null,
        application_type: body.application_type || null,
        judge_name: body.judge_name || null,
        notes: body.notes || null,
        onedrive_folder_url: body.onedrive_folder_url || null,
        client_role: body.client_role || null,
        opponent_name: body.opponent_name || null,
        enc_cs_no: body.enc_cs_no || null,
        scourt_case_name: body.scourt_case_name || null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating case:', error)
      return NextResponse.json(
        { error: `Failed to update case: ${error.message}` },
        { status: 500 }
      )
    }

    // 3. opponent_name 변경 시 case_parties 동기화
    if (body.opponent_name !== undefined && body.opponent_name !== existingCase.opponent_name) {
      // 상대방 당사자 업데이트 (is_our_client=false, manual_override=false인 경우만)
      const { data: opponentParties } = await adminClient
        .from('case_parties')
        .select('id, party_name')
        .eq('case_id', id)
        .eq('is_our_client', false)
        .eq('manual_override', false)

      if (opponentParties && opponentParties.length > 0) {
        for (const party of opponentParties) {
          // 번호 prefix 보존
          const prefixMatch = party.party_name.match(/^(\d+\.\s*)/)
          const prefix = prefixMatch ? prefixMatch[1] : ''
          const newPartyName = body.opponent_name ? prefix + body.opponent_name : party.party_name

          if (body.opponent_name) {
            await adminClient
              .from('case_parties')
              .update({
                party_name: newPartyName,
                updated_at: new Date().toISOString()
              })
              .eq('id', party.id)
          }
        }
      }
    }

    // 4. client_id 변경 시 case_parties 동기화
    if (body.client_id && body.client_id !== existingCase.client_id) {
      // 4a. 기존 의뢰인 당사자의 is_our_client 해제 (manual_override=false인 경우만)
      if (existingCase.client_id) {
        await adminClient
          .from('case_parties')
          .update({
            is_our_client: false,
            client_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('case_id', id)
          .eq('client_id', existingCase.client_id)
          .eq('manual_override', false)
      }

      // 4b. 새 의뢰인 정보 조회
      const { data: newClient } = await adminClient
        .from('clients')
        .select('name')
        .eq('id', body.client_id)
        .single()

      if (newClient) {
        // 4c. 이 사건에서 새 의뢰인과 이름이 일치하는 당사자가 있는지 확인
        const { data: matchingParty } = await adminClient
          .from('case_parties')
          .select('id, party_name')
          .eq('case_id', id)
          .eq('manual_override', false)
          .ilike('party_name', `%${newClient.name}%`)
          .maybeSingle()

        if (matchingParty) {
          // 기존 당사자를 의뢰인으로 업데이트
          await adminClient
            .from('case_parties')
            .update({
              is_our_client: true,
              client_id: body.client_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', matchingParty.id)
        } else {
          // 일치하는 당사자가 없으면 새 의뢰인 당사자 생성
          const clientRole = body.client_role || existingCase.client_role || 'plaintiff'
          await adminClient
            .from('case_parties')
            .insert({
              case_id: id,
              party_name: newClient.name,
              party_type: clientRole,
              is_our_client: true,
              client_id: body.client_id,
              party_order: 1,
              manual_override: false,
              scourt_synced: false
            })
        }
      }
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/cases/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/cases/[id]
 * Get a single case by ID with deadlines and hearings
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

    // 사건 기본 정보 조회
    const { data, error } = await adminClient
      .from('legal_cases')
      .select(`
        *,
        client:clients (
          id,
          name,
          phone
        ),
        assigned_member:tenant_members!assigned_to (
          id,
          display_name,
          role
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching case:', error)
      return NextResponse.json(
        { error: `Failed to fetch case: ${error.message}` },
        { status: 500 }
      )
    }

    // 해당 사건의 기한(deadlines) 조회
    const { data: deadlines } = await adminClient
      .from('case_deadlines')
      .select('*')
      .eq('case_id', id)
      .order('deadline_date', { ascending: true })

    // 해당 사건의 기일(hearings) 조회
    const { data: hearings } = await adminClient
      .from('court_hearings')
      .select('*')
      .eq('case_id', id)
      .order('hearing_date', { ascending: true })

    // 기일 충돌 감지를 위해 모든 사건의 기일 조회 (향후 30일)
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    const { data: allHearings } = await adminClient
      .from('court_hearings')
      .select('*')
      .gte('hearing_date', today.toISOString())
      .lte('hearing_date', thirtyDaysLater.toISOString())
      .eq('status', 'SCHEDULED')
      .order('hearing_date', { ascending: true })

    return NextResponse.json({
      success: true,
      data,
      deadlines: deadlines || [],
      hearings: hearings || [],
      allHearings: allHearings || [],
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
