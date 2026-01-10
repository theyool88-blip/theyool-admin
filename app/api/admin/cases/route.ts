import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import { SCOURT_RELATION_MAP, determineRelationDirection } from '@/lib/scourt/case-relations'
import { buildManualPartySeeds } from '@/lib/case/party-seeds'

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
      contract_number?: string // 관리번호
      client_id?: string
      new_client?: {
        name?: string
        phone?: string
        email?: string
        birth_date?: string
        address?: string
        bank_account?: string // 의뢰인 계좌번호
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
    let sourceCase: {
      client_role?: 'plaintiff' | 'defendant' | null
      opponent_name?: string | null
      case_level?: string | null
      court_case_number?: string | null
      main_case_id?: string | null
    } | null = null
    let sourcePartyOverrides: Array<{
      party_name: string
      party_type: string
      party_type_label: string | null
      party_order: number | null
      is_our_client: boolean
      fee_allocation_amount: number | null
      success_fee_terms: string | null
      notes: string | null
    }> = []

    if (body.source_case_id) {
      let sourceCaseQuery = adminClient
        .from('legal_cases')
        .select('client_role, opponent_name, case_level, court_case_number, main_case_id')
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

      sourceCase = sourceCaseData

      const { data: sourcePartiesData, error: sourcePartiesError } = await adminClient
        .from('case_parties')
        .select('party_name, party_type, party_type_label, party_order, is_our_client, fee_allocation_amount, success_fee_terms, notes')
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
    }

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
          address: body.new_client.address || null,
          bank_account: body.new_client.bank_account || null
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

    const resolvedClientRole = body.client_role ?? sourceCase?.client_role ?? null
    const resolvedOpponentName = body.opponent_name ?? sourceCase?.opponent_name ?? null

    // Create the case (테넌트 ID 포함)
    const { data: newCase, error } = await adminClient
      .from('legal_cases')
      .insert([withTenantId({
        case_name: body.case_name,
        client_id: clientId,
        case_type: body.case_type || '기타',
        contract_number: body.contract_number || null,
        assigned_to: body.assigned_to || null,
        status: body.status || '진행중',
        contract_date: body.contract_date || new Date().toISOString().split('T')[0],
        retainer_fee: body.retainer_fee || null,
        success_fee_agreement: body.success_fee_agreement || null,
        notes: body.notes || null,
        court_case_number: body.court_case_number || null,
        court_name: body.court_name || null,
        judge_name: body.judge_name || null,
        client_role: resolvedClientRole,
        opponent_name: resolvedOpponentName
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

    if (sourcePartyOverrides.length > 0) {
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
          is_our_client: party.is_our_client,
          client_id: party.is_our_client ? clientId : null,
          fee_allocation_amount: party.fee_allocation_amount || null,
          success_fee_terms: party.success_fee_terms || null,
          notes: party.notes || null,
          scourt_synced: false,
          manual_override: true
        }, tenant))
        return acc
      }, [] as Array<Record<string, unknown>>)

      if (partyInsertPayload.length > 0) {
        const { error: partyInsertError } = await adminClient
          .from('case_parties')
          .insert(partyInsertPayload)

        if (partyInsertError) {
          console.error('Error copying case parties:', partyInsertError)
        }
      }
    } else {
      // source_case_id가 없는 경우: 신규 사건 등록 시 case_parties 자동 생성
      // 사건번호 또는 client_role이 있을 때만 생성 (정확한 지위 추론 가능)
      const shouldCreateParties = body.court_case_number || body.client_role

      // 의뢰인 이름 결정: 새 의뢰인이면 new_client.name, 기존 의뢰인이면 DB에서 조회
      let clientNameForParty: string | null = null
      if (body.new_client?.name) {
        clientNameForParty = body.new_client.name
      } else if (clientId) {
        // 기존 의뢰인 이름 조회
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
          caseNumber: body.court_case_number,
          clientId: clientId,
        })

        if (partySeeds.length > 0) {
          const seedPayload = partySeeds.map((seed, idx) => withTenantId({
            case_id: newCase.id,
            party_name: seed.party_name,
            party_type: seed.party_type,
            party_type_label: seed.party_type_label,
            is_our_client: seed.is_our_client,
            client_id: seed.client_id || null,
            party_order: idx + 1,
            manual_override: false,
            scourt_synced: false,
          }, tenant))

          const { error: seedError } = await adminClient
            .from('case_parties')
            .insert(seedPayload)

          if (seedError) {
            console.error('Error seeding case parties:', seedError)
          }
        }
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
