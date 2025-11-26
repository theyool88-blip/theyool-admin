import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const month = searchParams.get('month') // YYYY-MM format
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('expense_category', category)
    }

    if (location) {
      query = query.eq('office_location', location)
    }

    if (startDate) {
      query = query.gte('expense_date', startDate)
    }

    if (endDate) {
      query = query.lte('expense_date', endDate)
    }

    if (month) {
      query = query.eq('month_key', month)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching expenses:', error)
      return NextResponse.json(
        { error: 'Failed to fetch expenses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      expenses: data || [],
      count: count || 0
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('expenses')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating expense:', error)
      return NextResponse.json(
        { error: 'Failed to create expense' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating expense:', error)
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    )
  }
}
