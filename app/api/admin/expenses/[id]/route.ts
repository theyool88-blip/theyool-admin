import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const supabase = createAdminClient()
    const id = params?.id

    if (!id) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('id', id)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query.single()

    if (error) {
      console.error('Error fetching expense:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch expense' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching expense:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    )
  }
})

export const PATCH = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const id = params?.id

    if (!id) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      )
    }

    // 먼저 해당 리소스가 현재 테넌트 소속인지 확인
    let checkQuery = supabase
      .from('expenses')
      .select('id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      checkQuery = checkQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingExpense, error: checkError } = await checkQuery.single()

    if (checkError || !existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found in your tenant' },
        { status: 404 }
      )
    }

    // 업데이트 실행
    let updateQuery = supabase
      .from('expenses')
      .update(body)
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await updateQuery.select().single()

    if (error) {
      console.error('Error updating expense:', error)
      return NextResponse.json(
        { error: 'Failed to update expense' },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating expense:', error)
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    )
  }
})

export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }
) => {
  try {
    const supabase = createAdminClient()
    const id = params?.id

    if (!id) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      )
    }

    // 먼저 해당 리소스가 현재 테넌트 소속인지 확인
    let checkQuery = supabase
      .from('expenses')
      .select('id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      checkQuery = checkQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: existingExpense, error: checkError } = await checkQuery.single()

    if (checkError || !existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found in your tenant' },
        { status: 404 }
      )
    }

    // 삭제 실행
    let deleteQuery = supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('Error deleting expense:', error)
      return NextResponse.json(
        { error: 'Failed to delete expense' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    )
  }
})
