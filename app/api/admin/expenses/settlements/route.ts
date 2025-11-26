import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('monthly_settlements')
      .select('*')
      .order('settlement_month', { ascending: false })

    if (error) {
      console.error('Error fetching settlements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settlements' },
        { status: 500 }
      )
    }

    return NextResponse.json({ settlements: data || [] })
  } catch (error) {
    console.error('Error fetching settlements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settlements' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('monthly_settlements')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating settlement:', error)
      return NextResponse.json(
        { error: 'Failed to create settlement' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating settlement:', error)
    return NextResponse.json(
      { error: 'Failed to create settlement' },
      { status: 500 }
    )
  }
}
