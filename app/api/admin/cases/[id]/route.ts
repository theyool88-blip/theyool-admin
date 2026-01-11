import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { parseCaseNumber } from '@/lib/scourt/case-number-utils'

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
      .select('client_id, client_role')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching existing case:', fetchError)
      return NextResponse.json(
        { error: `Case not found: ${fetchError.message}` },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    const parsedCourtNumber = body.court_case_number
      ? parseCaseNumber(body.court_case_number)
      : null
    const resolvedCourtName = body.court_name
      ? getCourtFullName(
          body.court_name,
          parsedCourtNumber?.valid ? parsedCourtNumber.caseType : undefined
        )
      : null

    // 2. legal_cases 업데이트 (opponent_name은 case_parties로 관리하므로 저장하지 않음)
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
        court_name: resolvedCourtName,
        case_type: body.case_type || null,
        application_type: body.application_type || null,
        judge_name: body.judge_name || null,
        notes: body.notes || null,
        onedrive_folder_url: body.onedrive_folder_url || null,
        client_role: body.client_role || null,
        // opponent_name은 더 이상 legal_cases에 저장하지 않음 (case_parties로 관리)
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

    // 3. client_id 변경 시 case_parties 동기화
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

    // 4. opponent_name 변경 시 case_parties 동기화
    if (body.opponent_name !== undefined) {
      const opponentName = (body.opponent_name || '').trim()

      if (opponentName) {
        // 4a. 상대방측 primary 당사자 찾기
        const { data: opponentParty } = await adminClient
          .from('case_parties')
          .select('id, party_name')
          .eq('case_id', id)
          .eq('is_our_client', false)
          .eq('is_primary', true)
          .maybeSingle()

        if (opponentParty) {
          // 기존 primary 상대방 이름 업데이트 (prefix 보존)
          const currentName = opponentParty.party_name || ''
          const numberPrefixMatch = currentName.match(/^(\d+\.\s*)/)
          const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''
          const newName = `${numberPrefix}${opponentName}`

          await adminClient
            .from('case_parties')
            .update({
              party_name: newName,
              updated_at: new Date().toISOString()
            })
            .eq('id', opponentParty.id)
        } else {
          // primary 상대방이 없으면 is_our_client=false, manual_override=false인 당사자 중 첫 번째 찾기
          const { data: anyOpponent } = await adminClient
            .from('case_parties')
            .select('id, party_name')
            .eq('case_id', id)
            .eq('is_our_client', false)
            .eq('manual_override', false)
            .order('party_order', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (anyOpponent) {
            // 기존 상대방 이름 업데이트 (prefix 보존)
            const currentName = anyOpponent.party_name || ''
            const numberPrefixMatch = currentName.match(/^(\d+\.\s*)/)
            const numberPrefix = numberPrefixMatch ? numberPrefixMatch[1] : ''
            const newName = `${numberPrefix}${opponentName}`

            await adminClient
              .from('case_parties')
              .update({
                party_name: newName,
                is_primary: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', anyOpponent.id)
          } else {
            // 상대방 당사자가 없으면 새로 생성
            const clientRole = body.client_role || existingCase.client_role || 'plaintiff'
            const opponentRole = clientRole === 'plaintiff' ? 'defendant' : 'plaintiff'

            await adminClient
              .from('case_parties')
              .insert({
                case_id: id,
                party_name: opponentName,
                party_type: opponentRole,
                is_our_client: false,
                is_primary: true,
                party_order: 1,
                manual_override: false,
                scourt_synced: false
              })
          }
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

/**
 * DELETE /api/admin/cases/[id]
 * Delete a legal case and all related data
 */
export async function DELETE(
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

    // 1. 사건 존재 여부 확인
    const { data: existingCase, error: fetchError } = await adminClient
      .from('legal_cases')
      .select('id, case_name')
      .eq('id', id)
      .single()

    if (fetchError || !existingCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 2. 관련 데이터 삭제 (순서 중요 - FK 제약조건)
    // 2a. case_parties 삭제
    await adminClient.from('case_parties').delete().eq('case_id', id)

    // 2b. case_representatives 삭제
    await adminClient.from('case_representatives').delete().eq('case_id', id)

    // 2c. case_deadlines 삭제
    await adminClient.from('case_deadlines').delete().eq('case_id', id)

    // 2d. court_hearings 삭제
    await adminClient.from('court_hearings').delete().eq('case_id', id)

    // 2e. payments 삭제
    await adminClient.from('payments').delete().eq('case_id', id)

    // 2f. case_relations 삭제 (양방향)
    await adminClient.from('case_relations').delete().eq('case_id', id)
    await adminClient.from('case_relations').delete().eq('related_case_id', id)

    // 2g. scourt_case_snapshots 삭제
    await adminClient.from('scourt_case_snapshots').delete().eq('case_id', id)

    // 2h. scourt_case_updates 삭제
    await adminClient.from('scourt_case_updates').delete().eq('case_id', id)

    // 2i. case_notices 삭제
    await adminClient.from('case_notices').delete().eq('case_id', id)

    // 3. 사건 삭제
    const { error: deleteError } = await adminClient
      .from('legal_cases')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting case:', deleteError)
      return NextResponse.json(
        { error: `사건 삭제 실패: ${deleteError.message}` },
        { status: 500 }
      )
    }

    console.log(`Case deleted: ${id} (${existingCase.case_name})`)

    return NextResponse.json({
      success: true,
      message: '사건이 삭제되었습니다'
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/cases/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
