import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/clients
 * Fetch all clients with optional filtering and pagination (테넌트 격리)
 * N+1 쿼리 최적화: 단일 쿼리로 case_parties 정보 조회 후 메모리에서 집계
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    // Search by name or phone
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      )
    }

    const clients = data || []

    // 클라이언트가 없으면 빈 배열 반환
    if (clients.length === 0) {
      return NextResponse.json({
        clients: [],
        count: 0
      })
    }

    const clientIds = clients.map(c => c.id)

    // 단일 쿼리로 모든 클라이언트의 case_parties 조회 (N+1 최적화)
    let casePartiesQuery = supabase
      .from('case_parties')
      .select('client_id, case_id')
      .in('client_id', clientIds)
      .not('case_id', 'is', null)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      casePartiesQuery = casePartiesQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: allCaseParties } = await casePartiesQuery

    // 클라이언트별 case_id 집계
    const clientCaseMap = new Map<string, Set<string>>()
    for (const cp of (allCaseParties || [])) {
      if (!cp.client_id || !cp.case_id) continue
      if (!clientCaseMap.has(cp.client_id)) {
        clientCaseMap.set(cp.client_id, new Set())
      }
      clientCaseMap.get(cp.client_id)!.add(cp.case_id)
    }

    // 모든 고유 case_id 수집
    const allCaseIds = new Set<string>()
    for (const caseSet of clientCaseMap.values()) {
      for (const caseId of caseSet) {
        allCaseIds.add(caseId)
      }
    }

    // 단일 쿼리로 모든 관련 케이스 조회 (최신순 정렬)
    const casesMap = new Map<string, { id: string; case_name: string; created_at: string }>()

    if (allCaseIds.size > 0) {
      let casesQuery = supabase
        .from('legal_cases')
        .select('id, case_name, created_at')
        .in('id', Array.from(allCaseIds))

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        casesQuery = casesQuery.eq('tenant_id', tenant.tenantId)
      }

      const { data: casesData } = await casesQuery

      for (const c of (casesData || [])) {
        casesMap.set(c.id, c)
      }
    }

    // 메모리에서 클라이언트별 정보 집계
    const clientsWithCases = clients.map(client => {
      const caseIds = clientCaseMap.get(client.id)
      const caseCount = caseIds?.size || 0

      let latestCase: { id: string; case_name: string } | null = null
      if (caseIds && caseIds.size > 0) {
        // 해당 클라이언트의 케이스들 중 가장 최근 것 찾기
        let latestCreatedAt = ''
        for (const caseId of caseIds) {
          const caseData = casesMap.get(caseId)
          if (caseData && caseData.created_at > latestCreatedAt) {
            latestCreatedAt = caseData.created_at
            latestCase = { id: caseData.id, case_name: caseData.case_name }
          }
        }
      }

      return {
        ...client,
        case_count: caseCount,
        latest_case: latestCase
      }
    })

    return NextResponse.json({
      clients: clientsWithCases,
      count: count || 0
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/clients
 * Create a new client (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const body = await request.json() as {
      name?: string
      phone?: string
      email?: string
      birth_date?: string
      resident_number?: string
      address?: string
      bank_account?: string
      client_type?: 'individual' | 'corporation'
      company_name?: string
      registration_number?: string
      notes?: string
    }

    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Create the client (테넌트 ID 포함)
    const { data: newClient, error } = await adminClient
      .from('clients')
      .insert([withTenantId({
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        birth_date: body.birth_date || null,
        resident_number: body.resident_number || null,
        address: body.address || null,
        bank_account: body.bank_account || null,
        client_type: body.client_type || 'individual',
        company_name: body.company_name || null,
        registration_number: body.registration_number || null,
        notes: body.notes || null
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      return NextResponse.json(
        { error: `Failed to create client: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newClient
    })
  } catch (error) {
    console.error('Error in POST /api/admin/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
