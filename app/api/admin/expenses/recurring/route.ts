import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('recurring_templates')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query

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
})

export const POST = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    // 테넌트 ID 자동 할당
    const dataWithTenant = withTenantId(body, tenant)

    const { data, error } = await supabase
      .from('recurring_templates')
      .insert([dataWithTenant])
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
})
