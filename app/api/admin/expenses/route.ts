import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import { canAccessModuleWithContext } from '@/lib/auth/permissions'

/**
 * GET /api/admin/expenses
 * Fetch expenses with filters (테넌트 격리 + 권한 체크)
 */
export const GET = withTenant(async (request, { tenant }) => {
  // 회계 모듈 권한 체크
  if (!canAccessModuleWithContext(tenant, 'expenses')) {
    return NextResponse.json(
      { error: '지출 관리 접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

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

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

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
})

/**
 * POST /api/admin/expenses
 * Create expense (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  // 회계 모듈 권한 체크
  if (!canAccessModuleWithContext(tenant, 'expenses')) {
    return NextResponse.json(
      { error: '지출 관리 접근 권한이 없습니다.' },
      { status: 403 }
    )
  }

  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from('expenses')
      .insert([withTenantId(body, tenant)])
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
})
