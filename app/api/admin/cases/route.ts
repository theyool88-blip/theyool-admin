import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import { SCOURT_RELATION_MAP, determineRelationDirection } from '@/lib/scourt/case-relations'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'
// determineClientRoleStatus removed - client_role now stored in case_parties
import { getCourtFullName } from '@/lib/scourt/court-codes'
import { parseCaseNumber, stripCourtPrefix } from '@/lib/scourt/case-number-utils'

/**
 * GET /api/admin/cases
 * Fetch all legal cases with client and payment info (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const adminClient = createAdminClient()

    // 테넌트 격리된 사건 조회 (primary_client_* 캐시 필드 사용)
    let query = adminClient
      .from('legal_cases')
      .select(`
        id,
        contract_number,
        case_name,
        case_type,
        status,
        contract_date,
        court_case_number,
        tenant_id,
        assigned_to,
        primary_client_id,
        primary_client_name,
        assigned_member:tenant_members!assigned_to (
          id,
          display_name,
          role
        ),
        case_assignees (
          id,
          member_id,
          is_primary,
          assignee_role,
          member:tenant_members (
            id,
            display_name,
            role
          )
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

    const casesList = cases || []

    // 케이스가 없으면 빈 배열 반환
    if (casesList.length === 0) {
      return NextResponse.json({ cases: [] })
    }

    const caseIds = casesList.map(c => c.id)

    // 단일 쿼리로 모든 케이스의 payments 조회 (N+1 최적화)
    let paymentsQuery = adminClient
      .from('payments')
      .select('case_id, amount')
      .in('case_id', caseIds)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      paymentsQuery = paymentsQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: allPayments } = await paymentsQuery

    // 케이스별 결제 정보 집계
    const paymentMap = new Map<string, { total: number; count: number }>()
    for (const payment of (allPayments || [])) {
      if (!payment.case_id) continue
      const existing = paymentMap.get(payment.case_id) || { total: 0, count: 0 }
      existing.total += payment.amount || 0
      existing.count += 1
      paymentMap.set(payment.case_id, existing)
    }

    // 메모리에서 케이스별 정보 조합
    const casesWithPayments = casesList.map((legalCase: Record<string, unknown>) => {
      const paymentInfo = paymentMap.get(legalCase.id as string) || { total: 0, count: 0 }

      // Use cache fields for client info (no join needed)
      const clientData = legalCase.primary_client_id
        ? { id: legalCase.primary_client_id, name: legalCase.primary_client_name }
        : null

      // Extract case_assignees
      const caseAssignees = legalCase.case_assignees as Array<{
        id: string
        member_id: string
        is_primary: boolean
        assignee_role: string
        member: { id: string; display_name: string; role: string } | null
      }> | undefined

      // Remove case_assignees from response
      const { case_assignees: _, ...caseWithoutAssignees } = legalCase

      return {
        ...caseWithoutAssignees,
        client: clientData,
        // Include assignees list (담당변호사/담당직원 목록)
        assignees: caseAssignees?.map(a => ({
          id: a.id,
          memberId: a.member_id,
          isPrimary: a.is_primary,
          assigneeRole: a.assignee_role,
          displayName: a.member?.display_name,
          role: a.member?.role
        })) || [],
        payment_info: {
          total_amount: paymentInfo.total,
          payment_count: paymentInfo.count
        }
      }
    })

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
      contract_number?: string // 관리번호
      client_id?: string
      new_client?: {
        name?: string
        phone?: string
        email?: string
        birth_date?: string
        address?: string
        bank_account?: string // 의뢰인 계좌번호
        client_type?: 'individual' | 'corporation'
        resident_number?: string
        company_name?: string
        registration_number?: string
      }
      assigned_to?: string  // 주 담당변호사 (레거시 호환)
      assignees?: Array<{   // 담당변호사 목록 (다중 지정)
        member_id: string
        is_primary?: boolean
      }>
      status?: string
      contract_date?: string
      retainer_fee?: number
      success_fee_agreement?: string
      notes?: string
      court_case_number?: string
      court_name?: string
      judge_name?: string
      client_role?: 'plaintiff' | 'defendant'
      opponent_name?: string
      source_case_id?: string
      source_relation_type?: string
      source_relation_enc_cs_no?: string
    }

    // case_name과 case_type은 자동 생성되므로 필수 아님
    // 단, 최소한 case_name은 있어야 함 (프론트엔드에서 자동 생성)
    if (!body.case_name) {
      return NextResponse.json(
        { error: 'Missing required field: case_name' },
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
    let sourceClientRole: 'plaintiff' | 'defendant' | null = null  // case_clients + case_parties에서 조회
    let sourceOpponentName: string | null = null  // case_parties에서 조회
    let sourcePartyOverrides: Array<{
      party_name: string
      party_type: string
      party_type_label: string | null
      party_order: number | null
      is_primary: boolean
      notes: string | null
    }> = []

    if (body.source_case_id) {
      // legal_cases에서 기본 정보 조회 (client_role, client_role_status 제거됨)
      let sourceCaseQuery = adminClient
        .from('legal_cases')
        .select('case_level, court_case_number, main_case_id')
        .eq('id', body.source_case_id)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        sourceCaseQuery = sourceCaseQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data: sourceCaseData, error: sourceCaseError } = await sourceCaseQuery.single()

      if (sourceCaseError || !sourceCaseData) {
        return NextResponse.json(
          { error: '원본 사건을 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // case_clients에서 의뢰인 정보 조회
      const { data: sourceCaseClient } = await adminClient
        .from('case_clients')
        .select('client_id, retainer_fee, success_fee_terms, linked_party_id')
        .eq('case_id', body.source_case_id)
        .eq('is_primary_client', true)
        .maybeSingle()

      if (sourceCaseClient) {
        // linked_party_id로 의뢰인 당사자의 party_type 조회
        if (sourceCaseClient.linked_party_id) {
          const { data: clientParty } = await adminClient
            .from('case_parties')
            .select('party_type')
            .eq('id', sourceCaseClient.linked_party_id)
            .maybeSingle()

          if (clientParty?.party_type) {
            const partyType = clientParty.party_type.toLowerCase()
            if (partyType.includes('plaintiff') || partyType.includes('원고') || partyType.includes('신청인') || partyType.includes('채권자')) {
              sourceClientRole = 'plaintiff'
            } else if (partyType.includes('defendant') || partyType.includes('피고') || partyType.includes('피신청인') || partyType.includes('채무자')) {
              sourceClientRole = 'defendant'
            }
          }
        }
      }

      const { data: sourcePartiesData, error: sourcePartiesError } = await adminClient
        .from('case_parties')
        .select('party_name, party_type, party_type_label, party_order, is_primary, notes')
        .eq('case_id', body.source_case_id)
        .eq('manual_override', true)
        .order('party_order', { ascending: true })

      if (sourcePartiesError) {
        console.error('Error fetching source case parties:', sourcePartiesError)
        return NextResponse.json(
          { error: `Failed to fetch source case parties: ${sourcePartiesError.message}` },
          { status: 500 }
        )
      }

      sourcePartyOverrides = sourcePartiesData || []

      // sourcePartyOverrides에서 상대방 이름 추출 (is_primary=false인 당사자)
      const opponentPartyFromOverrides = sourcePartyOverrides.find(p => !p.is_primary)
      if (opponentPartyFromOverrides) {
        sourceOpponentName = opponentPartyFromOverrides.party_name
      } else {
        // manual_override가 아닌 당사자에서 상대방 조회
        const { data: opponentParty } = await adminClient
          .from('case_parties')
          .select('party_name')
          .eq('case_id', body.source_case_id)
          .eq('is_primary', false)
          .limit(1)
          .maybeSingle()

        if (opponentParty) {
          sourceOpponentName = opponentParty.party_name
        }
      }
    }

    let clientId = body.client_id

    // 새 의뢰인 생성 (테넌트 ID 포함)
    if (body.new_client) {
      if (!body.new_client.name) {
        return NextResponse.json(
          { error: 'Client name is required' },
          { status: 400 }
        )
      }

      const { data: newClient, error: clientError } = await adminClient
        .from('clients')
        .insert([withTenantId({
          name: body.new_client.name,
          phone: body.new_client.phone || null,  // 연락처 선택
          email: body.new_client.email || null,
          birth_date: body.new_client.birth_date || null,
          address: body.new_client.address || null,
          bank_account: body.new_client.bank_account || null,
          client_type: body.new_client.client_type || 'individual',
          resident_number: body.new_client.resident_number || null,
          company_name: body.new_client.company_name || null,
          registration_number: body.new_client.registration_number || null
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

    // client_role: 명시적으로 지정된 경우 사용, 아니면 sourceClientRole, 기본값 'plaintiff'
    const resolvedClientRole = body.client_role ?? sourceClientRole ?? 'plaintiff'
    const resolvedOpponentName = body.opponent_name ?? sourceOpponentName ?? null

    // 사건번호 정제 (법원명 접두사 제거)
    const cleanedCaseNumber = body.court_case_number
      ? stripCourtPrefix(body.court_case_number)
      : null
    const parsedCourtNumber = cleanedCaseNumber
      ? parseCaseNumber(cleanedCaseNumber)
      : null
    const resolvedCourtName = body.court_name
      ? getCourtFullName(
          body.court_name,
          parsedCourtNumber?.valid ? parsedCourtNumber.caseType : undefined
        )
      : null

    // 중복 사건 검사 (사건번호가 있으면 중복 체크)
    if (cleanedCaseNumber) {
      let query = adminClient
        .from('legal_cases')
        .select('id, case_name')
        .eq('tenant_id', tenant.tenantId)
        .eq('court_case_number', cleanedCaseNumber)

      // court_name이 있으면 eq, 없으면 is null로 비교
      if (resolvedCourtName) {
        query = query.eq('court_name', resolvedCourtName)
      } else {
        query = query.is('court_name', null)
      }

      const { data: existingCase } = await query.maybeSingle()

      if (existingCase) {
        return NextResponse.json({
          error: '이미 등록된 사건입니다',
          existingCase: { id: existingCase.id, name: existingCase.case_name }
        }, { status: 409 })
      }
    }

    // Determine primary assignee for backward compatibility
    // Priority: 1. assignees with is_primary=true, 2. first assignee, 3. assigned_to
    let primaryAssigneeId: string | null = null
    if (body.assignees && body.assignees.length > 0) {
      const primaryAssignee = body.assignees.find(a => a.is_primary) || body.assignees[0]
      primaryAssigneeId = primaryAssignee.member_id
    } else if (body.assigned_to) {
      primaryAssigneeId = body.assigned_to
    }

    // Create the case (테넌트 ID 포함)
    // NOTE: 새 스키마에서 client_id, retainer_fee, client_role, opponent_name 제거됨
    // 이들은 case_parties를 통해 관리됨
    const { data: newCase, error } = await adminClient
      .from('legal_cases')
      .insert([withTenantId({
        case_name: body.case_name,
        case_type: body.case_type || '기타',
        contract_number: body.contract_number || null,
        assigned_to: primaryAssigneeId,  // Primary assignee for backward compatibility
        status: body.status || 'active',
        contract_date: body.contract_date || new Date().toISOString().split('T')[0],
        notes: body.notes || null,
        court_case_number: cleanedCaseNumber,
        court_name: resolvedCourtName,
        judge_name: body.judge_name || null,
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Error creating case:', error)
      // PostgreSQL UNIQUE violation 에러 (code: 23505)
      if (error.code === '23505') {
        return NextResponse.json({
          error: '동일한 사건번호가 이미 등록되어 있습니다.',
          details: '같은 법원, 같은 사건번호의 사건이 이미 존재합니다.'
        }, { status: 409 })
      }
      return NextResponse.json(
        { error: `Failed to create case: ${error.message}` },
        { status: 500 }
      )
    }

    // Insert case_assignees (담당변호사 다중 지정)
    if (body.assignees && body.assignees.length > 0) {
      const assigneePayload = body.assignees.map((assignee, idx) => withTenantId({
        case_id: newCase.id,
        member_id: assignee.member_id,
        is_primary: assignee.is_primary || (idx === 0 && !body.assignees?.some(a => a.is_primary))
      }, tenant))

      const { error: assigneeError } = await adminClient
        .from('case_assignees')
        .insert(assigneePayload)

      if (assigneeError) {
        console.error('Error inserting case_assignees:', assigneeError)
        // Don't fail the whole request, just log the error
      }
    } else if (body.assigned_to) {
      // Legacy: single assigned_to - insert into case_assignees
      const { error: assigneeError } = await adminClient
        .from('case_assignees')
        .insert([withTenantId({
          case_id: newCase.id,
          member_id: body.assigned_to,
          is_primary: true
        }, tenant)])

      if (assigneeError) {
        console.error('Error inserting case_assignees (legacy):', assigneeError)
      }
    }

    // 당사자 및 의뢰인 연결 생성
    // 새 스키마: case_parties (당사자만), case_clients (의뢰인 연결)
    let clientPartyId: string | null = null

    if (sourcePartyOverrides.length > 0) {
      // 원본 사건에서 당사자 복사
      const seenKeys = new Set<string>()
      const partyInsertPayload = sourcePartyOverrides.reduce((acc, party, idx) => {
        const partyName = (party.party_name || '').trim()
        if (!partyName || !party.party_type) return acc
        const key = `${party.party_type}:${partyName}`
        if (seenKeys.has(key)) return acc
        seenKeys.add(key)

        acc.push(withTenantId({
          case_id: newCase.id,
          party_name: partyName,
          party_type: party.party_type,
          party_type_label: party.party_type_label || null,
          party_order: party.party_order ?? idx + 1,
          is_primary: party.is_primary,  // 원본 사건의 is_primary 유지
          representatives: [],  // JSONB
          notes: party.notes || null,
          scourt_synced: false,
          manual_override: true
        }, tenant))
        return acc
      }, [] as Array<Record<string, unknown>>)

      if (partyInsertPayload.length > 0) {
        const { data: insertedParties, error: partyInsertError } = await adminClient
          .from('case_parties')
          .insert(partyInsertPayload)
          .select('id, party_type, is_primary')

        if (partyInsertError) {
          console.error('Error copying case parties:', partyInsertError)
        } else if (insertedParties) {
          // 의뢰인 당사자 ID 찾기
          const primaryParty = insertedParties.find(p => p.is_primary)
          clientPartyId = primaryParty?.id || null
        }
      }
    } else {
      // 신규 사건: 당사자 자동 생성
      const shouldCreateParties = body.court_case_number || body.client_role

      // 의뢰인 이름 결정
      let clientNameForParty: string | null = null
      if (body.new_client?.name) {
        clientNameForParty = body.new_client.name
      } else if (clientId) {
        const { data: existingClient } = await adminClient
          .from('clients')
          .select('name')
          .eq('id', clientId)
          .single()
        clientNameForParty = existingClient?.name || null
      }

      if (shouldCreateParties && (clientNameForParty || resolvedOpponentName)) {
        const partySeeds = buildManualPartySeeds({
          clientName: clientNameForParty,
          opponentName: resolvedOpponentName,
          clientRole: resolvedClientRole,
          caseNumber: cleanedCaseNumber,
          clientId: clientId,
        })

        if (partySeeds.length > 0) {
          const seedPayload = partySeeds.map((seed, idx) => withTenantId({
            case_id: newCase.id,
            party_name: seed.party_name,
            party_type: seed.party_type,
            party_type_label: seed.party_type_label,
            is_primary: seed.is_primary,  // 대표 당사자 여부
            representatives: [],
            party_order: idx + 1,
            manual_override: false,
            scourt_synced: false,
          }, tenant))

          const { data: insertedParties, error: seedError } = await adminClient
            .from('case_parties')
            .insert(seedPayload)
            .select('id, party_type, is_primary')

          if (seedError) {
            console.error('Error seeding case parties:', seedError)
          } else if (insertedParties) {
            const primaryParty = insertedParties.find(p => p.is_primary)
            clientPartyId = primaryParty?.id || null
          }
        }
      }
    }

    // case_clients 생성 (의뢰인 연결)
    if (clientId) {
      const { error: caseClientError } = await adminClient
        .from('case_clients')
        .insert([withTenantId({
          case_id: newCase.id,
          client_id: clientId,
          linked_party_id: clientPartyId,
          is_primary_client: true,
          retainer_fee: body.retainer_fee || null,
          success_fee_terms: body.success_fee_agreement || null,
        }, tenant)])

      if (caseClientError) {
        console.error('Error creating case_client:', caseClientError)
      }
    }

    if (body.source_case_id) {
      const rawRelationType = (body.source_relation_type || '').trim()
      const relationType = rawRelationType || '관련사건'
      const relationTypeCode = SCOURT_RELATION_MAP[relationType] || 'related'
      const direction = determineRelationDirection(relationType)

      const { data: existingRelation, error: existingRelationError } = await adminClient
        .from('case_relations')
        .select('id')
        .or(`and(case_id.eq.${body.source_case_id},related_case_id.eq.${newCase.id}),and(case_id.eq.${newCase.id},related_case_id.eq.${body.source_case_id})`)
        .maybeSingle()

      if (existingRelationError) {
        console.error('Error checking case_relations:', existingRelationError)
      } else if (!existingRelation) {
        const { error: relationInsertError } = await adminClient
          .from('case_relations')
          .insert({
            case_id: body.source_case_id,
            related_case_id: newCase.id,
            relation_type: relationType,
            relation_type_code: relationTypeCode,
            direction,
            auto_detected: false,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
            scourt_enc_cs_no: body.source_relation_enc_cs_no || null,
          })

        if (relationInsertError) {
          console.error('Error creating case_relations:', relationInsertError)
        }
      }
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
