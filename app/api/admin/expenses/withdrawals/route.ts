import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    const partner = searchParams.get('partner')
    const month = searchParams.get('month')

    const normalizeMonth = (value?: string | null) => {
      if (!value) return ''
      const cleaned = value.replace(/\./g, '-').replace(/\s+/g, '')
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned.slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(cleaned)) return cleaned
      return cleaned.slice(0, 7)
    }

    const normalizedMonth = normalizeMonth(month)
    let monthStart: string | null = null
    let monthEnd: string | null = null
    if (normalizedMonth) {
      monthStart = `${normalizedMonth}-01`
      const endDate = new Date(`${normalizedMonth}-01T00:00:00Z`)
      endDate.setMonth(endDate.getMonth() + 1)
      monthEnd = endDate.toISOString().slice(0, 10)
    }

    let query = supabase
      .from('partner_withdrawals')
      .select('*')
      .order('withdrawal_date', { ascending: false })

    if (partner) {
      query = query.eq('partner_name', partner)
    }

    if (normalizedMonth) {
      if (monthStart && monthEnd) {
        query = query.or(
          `month_key.eq.${normalizedMonth},and(withdrawal_date.gte.${monthStart},withdrawal_date.lt.${monthEnd})`
        )
      } else {
        query = query.eq('month_key', normalizedMonth)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching withdrawals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch withdrawals' },
        { status: 500 }
      )
    }

    return NextResponse.json({ withdrawals: data || [] })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('partner_withdrawals')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating withdrawal:', error)
      return NextResponse.json(
        { error: 'Failed to create withdrawal' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating withdrawal:', error)
    return NextResponse.json(
      { error: 'Failed to create withdrawal' },
      { status: 500 }
    )
  }
}
