import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authCheck = await isAuthenticated()
  if (!authCheck) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

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
    const { data: clientMatches } = await supabase
      .from('clients')
      .select('id')
      .or([
        `name.ilike.%${q}%`,
        `phone.ilike.%${q}%`
      ].join(','))

    clientIds = (clientMatches || []).map(c => c.id)
  }
  if (clientId) {
    clientIds = Array.from(new Set([...clientIds, clientId]))
  }

  const { data, error, count } = await supabase
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

  if (error) {
    console.error('Case search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], count: count || 0 })
}
