import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await isAuthenticated()
  if (!authCheck) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const clientName = searchParams.get('name') || ''

  const supabase = createAdminClient()

  // 1) 이 의뢰인의 사건 목록
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id')
    .eq('client_id', id)

  if (casesError) {
    console.error('Failed to fetch cases for payments summary:', casesError)
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 })
  }

  const caseIds = (cases || []).map(c => c.id)

  // 2) payments 조회: 사건 기반 + 이름 기반 fallback
  let total = 0
  let count = 0
  const seen = new Set<string>()

  if (caseIds.length > 0) {
    const { data: byCase, error: byCaseError } = await supabase
      .from('payments')
      .select('id, amount')
      .in('case_id', caseIds)

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
    const { data: byName, error: byNameError } = await supabase
      .from('payments')
      .select('id, amount')
      .or(`case_name.ilike.${like},depositor_name.ilike.${like}`)

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
}
