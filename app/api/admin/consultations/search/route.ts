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
  const limit = Number(searchParams.get('limit') || 10)

  if (!q) {
    return NextResponse.json({ data: [], count: 0 })
  }

  const supabase = createAdminClient()

  const { data, error, count } = await supabase
    .from('consultations')
    .select('id, name, phone, request_type, created_at', { count: 'exact' })
    .or(
      [
        `name.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `request_type.ilike.%${q}%`
      ].join(',')
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Consultation search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], count: count || 0 })
}
