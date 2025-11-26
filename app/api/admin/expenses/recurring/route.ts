import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('recurring_templates')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching recurring templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error) {
    console.error('Error fetching recurring templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('recurring_templates')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
