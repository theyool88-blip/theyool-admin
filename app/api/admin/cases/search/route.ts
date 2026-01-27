import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = Number(searchParams.get('limit') || 20)
  const clientId = searchParams.get('client_id') || ''

  if (!q && !clientId) {
    return NextResponse.json({ data: [], count: 0 })
  }

  const supabase = createAdminClient()

  let clientIds: string[] = []
  if (q) {
    // 클라이언트 검색도 테넌트 필터 적용
    let clientQuery = supabase
      .from('clients')
      .select('id')
      .or([
        `name.ilike.%${q}%`,
        `phone.ilike.%${q}%`
      ].join(','))

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      clientQuery = clientQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: clientMatches } = await clientQuery

    clientIds = (clientMatches || []).map(c => c.id)
  }
  if (clientId) {
    clientIds = Array.from(new Set([...clientIds, clientId]))
  }

  // 사건 검색에 테넌트 필터 적용
  let caseQuery = supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, contract_number, office, client:clients(name)', { count: 'exact' })
    .or([
      q ? `case_name.ilike.%${q}%` : '',
      q ? `court_case_number.ilike.%${q}%` : '',
      q ? `contract_number.ilike.%${q}%` : '',
      clientIds.length ? `client_id.in.(${clientIds.join(',')})` : ''
    ].filter(Boolean).join(','))
    .order('created_at', { ascending: false })
    .limit(limit)

  // 테넌트 격리 필터
  if (!tenant.isSuperAdmin && tenant.tenantId) {
    caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
  }

  const { data, error, count } = await caseQuery

  if (error) {
    console.error('Case search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], count: count || 0 })
})
