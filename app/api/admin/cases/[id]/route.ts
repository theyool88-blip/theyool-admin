import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { parseCaseNumber } from '@/lib/scourt/case-number-utils'

/**
 * PATCH /api/admin/cases/[id]
 * Update a legal case with case_parties sync (테넌트 격리 적용)
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
    const adminClient = createAdminClient()

    // 1. 기존 사건 정보 조회 (변경 감지용, tenant_id 포함)
    let existingQuery = adminClient
      .from('legal_cases')
      .select('id, tenant_id, primary_client_id')
      .eq('id', id)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      existingQuery = existingQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingCase, error: fetchError } = await existingQuery.single()

    if (fetchError || !existingCase) {
      return NextResponse.json(
        { error: 'Case not found in your tenant' },
        { status: 404 }
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

    // 2. legal_cases 업데이트
    let updateQuery = adminClient
      .from('legal_cases')
      .update({
        contract_number: body.contract_number || null,
        case_name: body.case_name,
        status: body.status,
        assigned_to: body.assigned_to || null,
        contract_date: body.contract_date || null,
        court_case_number: body.court_case_number || null,
        court_name: resolvedCourtName,
        case_type: body.case_type || null,
        application_type: body.application_type || null,
        judge_name: body.judge_name || null,
        notes: body.notes || null,
        onedrive_folder_url: body.onedrive_folder_url || null,
        scourt_enc_cs_no: body.scourt_enc_cs_no || null,
      })
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await updateQuery.select().single()

    if (error) {
      console.error('Error updating case:', error)
      return NextResponse.json(
        { error: `Failed to update case: ${error.message}` },
        { status: 500 }
      )
    }

    // 3. client_id 변경 시 case_clients 동기화
    if (body.client_id && body.client_id !== existingCase.primary_client_id) {
      // 3a. 기존 primary 의뢰인 해제
      if (existingCase.primary_client_id) {
        await adminClient
          .from('case_clients')
          .update({
            is_primary_client: false,
            updated_at: new Date().toISOString()
          })
          .eq('case_id', id)
          .eq('client_id', existingCase.primary_client_id)
      }

      // 3b. 새 의뢰인 정보 조회
      const { data: newClient } = await adminClient
        .from('clients')
        .select('name')
        .eq('id', body.client_id)
        .single()

      if (newClient) {
        // 3c. case_clients에 이미 있는지 확인
        const { data: existingCaseClient } = await adminClient
          .from('case_clients')
          .select('id')
          .eq('case_id', id)
          .eq('client_id', body.client_id)
          .maybeSingle()

        if (existingCaseClient) {
          // 기존 연결을 primary로 설정
          await adminClient
            .from('case_clients')
            .update({
              is_primary_client: true,
              retainer_fee: body.retainer_fee || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingCaseClient.id)
        } else {
          // 3d. 이 사건에서 새 의뢰인과 이름이 일치하는 당사자가 있는지 확인
          const { data: matchingParty } = await adminClient
            .from('case_parties')
            .select('id, party_name')
            .eq('case_id', id)
            .eq('manual_override', false)
            .ilike('party_name', `%${newClient.name}%`)
            .maybeSingle()

          // 새 case_clients 레코드 생성 (tenant_id 필수)
          await adminClient
            .from('case_clients')
            .insert({
              tenant_id: existingCase.tenant_id,
              case_id: id,
              client_id: body.client_id,
              linked_party_id: matchingParty?.id || null,
              is_primary_client: true,
              retainer_fee: body.retainer_fee || null,
            })
            .select('id')
            .single()

          // 일치하는 당사자가 있으면 is_primary 설정
          if (matchingParty) {
            await adminClient
              .from('case_parties')
              .update({
                is_primary: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', matchingParty.id)
          }
        }
      }
    }

    // 4. opponent_name 변경 시 case_parties 동기화
    if (body.opponent_name !== undefined) {
      const opponentName = (body.opponent_name || '').trim()

      if (opponentName) {
        // 4a. 상대방측 당사자 찾기
        const { data: opponentParty } = await adminClient
          .from('case_parties')
          .select('id, party_name')
          .eq('case_id', id)
          .eq('is_primary', false)
          .order('party_order', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (opponentParty) {
          // 기존 상대방 이름 업데이트 (prefix 보존)
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
          // 상대방 당사자가 없으면 새로 생성
          const { data: linkedParty } = await adminClient
            .from('case_clients')
            .select('linked_party_id, case_parties!linked_party_id(party_type)')
            .eq('case_id', id)
            .eq('is_primary_client', true)
            .maybeSingle()

          const clientRole = (linkedParty?.case_parties as { party_type?: string } | null)?.party_type || 'plaintiff'
          const opponentRole = clientRole === 'plaintiff' ? 'defendant' : 'plaintiff'

          await adminClient
            .from('case_parties')
            .insert({
              tenant_id: existingCase.tenant_id,
              case_id: id,
              party_name: opponentName,
              party_type: opponentRole,
              is_primary: false,
              party_order: 2,
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
})

/**
 * GET /api/admin/cases/[id]
 * Get a single case by ID with deadlines and hearings (테넌트 격리 적용)
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

    // 사건 기본 정보 조회 (primary_client_id FK 사용)
    let caseQuery = adminClient
      .from('legal_cases')
      .select(`
        *,
        client:clients!primary_client_id (
          id,
          name,
          phone
        ),
        assigned_member:tenant_members!assigned_to (
          id,
          display_name,
          role
        ),
        case_assignees (
          id,
          member_id,
          is_primary,
          member:tenant_members (
            id,
            display_name,
            role,
            title
          )
        )
      `)
      .eq('id', id)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await caseQuery.single()

    if (error) {
      console.error('Error fetching case:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Case not found in your tenant' },
          { status: 404 }
        )
      }
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

    // 기일 충돌 감지를 위해 테넌트 내 모든 사건의 기일 조회 (향후 30일)
    // court_hearings는 tenant_id 컬럼이 없음 - case_id FK를 통해 legal_cases join 필요
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    // 먼저 테넌트의 모든 case_id를 조회
    let tenantCasesQuery = adminClient
      .from('legal_cases')
      .select('id')

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      tenantCasesQuery = tenantCasesQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: tenantCases } = await tenantCasesQuery
    const tenantCaseIds = tenantCases?.map(c => c.id) || []

    let allHearings: typeof data[] = []
    if (tenantCaseIds.length > 0) {
      const { data: hearingsData } = await adminClient
        .from('court_hearings')
        .select('*')
        .in('case_id', tenantCaseIds)
        .gte('hearing_date', today.toISOString())
        .lte('hearing_date', thirtyDaysLater.toISOString())
        .eq('status', 'SCHEDULED')
        .order('hearing_date', { ascending: true })

      allHearings = hearingsData || []
    }

    // Transform case_assignees to a more usable format
    const assignees = (data.case_assignees as Array<{
      id: string
      member_id: string
      is_primary: boolean
      member: { id: string; display_name: string; role: string; title?: string } | null
    }> | undefined)?.map(a => ({
      id: a.id,
      memberId: a.member_id,
      isPrimary: a.is_primary,
      displayName: a.member?.display_name,
      role: a.member?.role,
      title: a.member?.title
    })) || []

    // Remove case_assignees from data to avoid duplication
    const { case_assignees: _, ...caseData } = data

    return NextResponse.json({
      success: true,
      data: caseData,
      assignees,
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
})

/**
 * DELETE /api/admin/cases/[id]
 * Delete a legal case and all related data (테넌트 격리 적용)
 */
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. 사건 존재 여부 확인 (테넌트 필터 포함)
    let checkQuery = adminClient
      .from('legal_cases')
      .select('id, case_name, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      checkQuery = checkQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingCase, error: fetchError } = await checkQuery.single()

    if (fetchError || !existingCase) {
      return NextResponse.json(
        { error: 'Case not found in your tenant' },
        { status: 404 }
      )
    }

    // 2. 관련 데이터 삭제 (순서 중요 - FK 제약조건)
    // 2a. case_assignees 삭제 (담당변호사/담당직원)
    await adminClient.from('case_assignees').delete().eq('case_id', id)

    // 2b. case_clients 삭제 (의뢰인 연결)
    await adminClient.from('case_clients').delete().eq('case_id', id)

    // 2c. case_parties 삭제 (당사자)
    await adminClient.from('case_parties').delete().eq('case_id', id)

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

    // 3. 사건 삭제 (테넌트 필터 포함)
    let deleteQuery = adminClient
      .from('legal_cases')
      .delete()
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error: deleteError } = await deleteQuery

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
})
