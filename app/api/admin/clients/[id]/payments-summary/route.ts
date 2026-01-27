import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/lib/api/with-tenant'
import { createAdminClient } from '@/lib/supabase/admin'

export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  const id = params?.id
  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const clientName = searchParams.get('name') || ''

  const supabase = createAdminClient()

  // 1) 이 의뢰인의 사건 목록 (테넌트 격리)
  let casesQuery = supabase
    .from('legal_cases')
    .select('id')
    .eq('client_id', id)

  if (!tenant.isSuperAdmin && tenant.tenantId) {
    casesQuery = casesQuery.eq('tenant_id', tenant.tenantId)
  }

  const { data: cases, error: casesError } = await casesQuery

  if (casesError) {
    console.error('Failed to fetch cases for payments summary:', casesError)
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 })
  }

  const caseIds = (cases || []).map(c => c.id)

  // 2) payments 조회: 사건 기반 + 이름 기반 fallback (테넌트 격리)
  let total = 0
  let count = 0
  const seen = new Set<string>()

  if (caseIds.length > 0) {
    let byCaseQuery = supabase
      .from('payments')
      .select('id, amount')
      .in('case_id', caseIds)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      byCaseQuery = byCaseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: byCase, error: byCaseError } = await byCaseQuery

    if (byCaseError) {
      console.error('Failed to fetch payments by case:', byCaseError)
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    (byCase || []).forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        total += p.amount
        count += 1
      }
    })
  }

  if (clientName) {
    const like = `%${clientName}%`
    let byNameQuery = supabase
      .from('payments')
      .select('id, amount')
      .or(`case_name.ilike.${like},depositor_name.ilike.${like}`)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      byNameQuery = byNameQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: byName, error: byNameError } = await byNameQuery

    if (byNameError) {
      console.error('Failed to fetch payments by name:', byNameError)
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    (byName || []).forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        total += p.amount
        count += 1
      }
    })
  }

  return NextResponse.json({
    total,
    count,
  })
})
