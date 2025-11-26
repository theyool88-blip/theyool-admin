import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const { id } = await params

    const { data, error } = await supabase
      .from('monthly_settlements')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching settlement:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settlement' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching settlement:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settlement' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const { id } = await params

    const { data, error } = await supabase
      .from('monthly_settlements')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating settlement:', error)
      return NextResponse.json(
        { error: 'Failed to update settlement' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating settlement:', error)
    return NextResponse.json(
      { error: 'Failed to update settlement' },
      { status: 500 }
    )
  }
}
