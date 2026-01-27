import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import type { TenantContext } from '@/types/tenant'

// Helper type for the member join result
interface MemberJoin {
  id: string
  display_name: string
  role: string
  title?: string
  email?: string
}

// AssigneeRole type
type AssigneeRole = 'lawyer' | 'staff'

interface AssigneeRow {
  id: string
  member_id: string
  assignee_role: AssigneeRole
  is_primary: boolean
  created_at: string
  member: MemberJoin | null
}

/**
 * GET /api/admin/cases/[id]/assignees
 * Get all assignees for a case
 */
export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: TenantContext; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    let query = adminClient
      .from('case_assignees')
      .select(`
        id,
        member_id,
        assignee_role,
        is_primary,
        created_at,
        member:tenant_members!member_id (
          id,
          display_name,
          role,
          title,
          email
        )
      `)
      .eq('case_id', id)
      .order('assignee_role')
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data: assignees, error } = await query

    if (error) {
      console.error('Error fetching case assignees:', error)
      return NextResponse.json(
        { error: `Failed to fetch assignees: ${error.message}` },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const transformed = ((assignees as unknown) as AssigneeRow[] || []).map(a => ({
      id: a.id,
      memberId: a.member_id,
      assigneeRole: a.assignee_role,
      isPrimary: a.is_primary,
      createdAt: a.created_at,
      member: a.member ? {
        id: a.member.id,
        displayName: a.member.display_name,
        role: a.member.role,
        title: a.member.title,
        email: a.member.email
      } : null
    }))

    return NextResponse.json({
      success: true,
      assignees: transformed
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/assignees:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * POST /api/admin/cases/[id]/assignees
 * Add an assignee to a case
 */
export const POST = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: TenantContext; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const body = await request.json() as {
      member_id: string
      assignee_role?: AssigneeRole
      is_primary?: boolean
    }

    if (!body.member_id) {
      return NextResponse.json(
        { error: 'member_id is required' },
        { status: 400 }
      )
    }

    // Default to 'lawyer' if not specified
    const assigneeRole = body.assignee_role || 'lawyer'

    // Staff cannot be primary
    const isPrimary = assigneeRole === 'staff' ? false : (body.is_primary || false)

    const adminClient = createAdminClient()

    // Check if case exists and belongs to tenant
    let caseQuery = adminClient
      .from('legal_cases')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: legalCase, error: caseError } = await caseQuery.single()

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Check if member exists and is in the same tenant
    const { data: member, error: memberError } = await adminClient
      .from('tenant_members')
      .select('id, tenant_id, role')
      .eq('id', body.member_id)
      .eq('tenant_id', legalCase.tenant_id)
      .single()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Member not found or not in the same tenant' },
        { status: 404 }
      )
    }

    // If is_primary is true, we need to update other lawyer assignees
    if (isPrimary) {
      await adminClient
        .from('case_assignees')
        .update({ is_primary: false })
        .eq('case_id', id)
        .eq('assignee_role', 'lawyer')
        .eq('is_primary', true)
    }

    // Insert the new assignee
    const { data: newAssignee, error: insertError } = await adminClient
      .from('case_assignees')
      .insert([withTenantId({
        case_id: id,
        member_id: body.member_id,
        assignee_role: assigneeRole,
        is_primary: isPrimary
      }, tenant)])
      .select(`
        id,
        member_id,
        assignee_role,
        is_primary,
        created_at,
        member:tenant_members!member_id (
          id,
          display_name,
          role,
          title
        )
      `)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation - assignee already exists
        return NextResponse.json(
          { error: 'This member is already assigned to the case' },
          { status: 409 }
        )
      }
      console.error('Error adding assignee:', insertError)
      return NextResponse.json(
        { error: `Failed to add assignee: ${insertError.message}` },
        { status: 500 }
      )
    }

    const assigneeData = (newAssignee as unknown) as AssigneeRow

    return NextResponse.json({
      success: true,
      assignee: {
        id: assigneeData.id,
        memberId: assigneeData.member_id,
        assigneeRole: assigneeData.assignee_role,
        isPrimary: assigneeData.is_primary,
        createdAt: assigneeData.created_at,
        member: assigneeData.member ? {
          id: assigneeData.member.id,
          displayName: assigneeData.member.display_name,
          role: assigneeData.member.role,
          title: assigneeData.member.title
        } : null
      }
    })
  } catch (error) {
    console.error('Error in POST /api/admin/cases/[id]/assignees:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * PUT /api/admin/cases/[id]/assignees
 * Replace all assignees for a case
 */
export const PUT = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: TenantContext; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const body = await request.json() as {
      assignees: Array<{
        member_id: string
        assignee_role?: AssigneeRole
        is_primary?: boolean
      }>
    }

    if (!body.assignees || !Array.isArray(body.assignees)) {
      return NextResponse.json(
        { error: 'assignees array is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check if case exists and belongs to tenant
    let caseQuery = adminClient
      .from('legal_cases')
      .select('id, tenant_id')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      caseQuery = caseQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: legalCase, error: caseError } = await caseQuery.single()

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Delete existing assignees
    await adminClient
      .from('case_assignees')
      .delete()
      .eq('case_id', id)

    // Insert new assignees
    if (body.assignees.length > 0) {
      // Separate lawyers and staff
      const lawyers = body.assignees.filter(a => !a.assignee_role || a.assignee_role === 'lawyer')
      const staff = body.assignees.filter(a => a.assignee_role === 'staff')

      // Ensure exactly one primary among lawyers
      const hasPrimaryLawyer = lawyers.some(a => a.is_primary)

      const assigneePayload = body.assignees.map((assignee, idx) => {
        const assigneeRole = assignee.assignee_role || 'lawyer'
        // Staff cannot be primary
        const isPrimary = assigneeRole === 'staff'
          ? false
          : (assignee.is_primary || (!hasPrimaryLawyer && assigneeRole === 'lawyer' && idx === lawyers.findIndex(l => l.member_id === assignee.member_id) && idx === 0))

        return withTenantId({
          case_id: id,
          member_id: assignee.member_id,
          assignee_role: assigneeRole,
          is_primary: isPrimary
        }, tenant)
      })

      const { error: insertError } = await adminClient
        .from('case_assignees')
        .insert(assigneePayload)

      if (insertError) {
        console.error('Error replacing assignees:', insertError)
        return NextResponse.json(
          { error: `Failed to replace assignees: ${insertError.message}` },
          { status: 500 }
        )
      }
    }

    // Fetch updated assignees
    const { data: updatedAssignees } = await adminClient
      .from('case_assignees')
      .select(`
        id,
        member_id,
        assignee_role,
        is_primary,
        created_at,
        member:tenant_members!member_id (
          id,
          display_name,
          role,
          title
        )
      `)
      .eq('case_id', id)
      .order('assignee_role')
      .order('is_primary', { ascending: false })

    return NextResponse.json({
      success: true,
      assignees: ((updatedAssignees as unknown) as AssigneeRow[] || []).map(a => ({
        id: a.id,
        memberId: a.member_id,
        assigneeRole: a.assignee_role,
        isPrimary: a.is_primary,
        createdAt: a.created_at,
        member: a.member ? {
          id: a.member.id,
          displayName: a.member.display_name,
          role: a.member.role,
          title: a.member.title
        } : null
      }))
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/cases/[id]/assignees:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/cases/[id]/assignees
 * Remove an assignee from a case
 * Query params: ?member_id=xxx or ?assignee_id=xxx
 */
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: TenantContext; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const url = new URL(request.url)
    const memberId = url.searchParams.get('member_id')
    const assigneeId = url.searchParams.get('assignee_id')

    if (!memberId && !assigneeId) {
      return NextResponse.json(
        { error: 'Either member_id or assignee_id query param is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Build delete query
    let deleteQuery = adminClient
      .from('case_assignees')
      .delete()
      .eq('case_id', id)

    if (memberId) {
      deleteQuery = deleteQuery.eq('member_id', memberId)
    } else if (assigneeId) {
      deleteQuery = deleteQuery.eq('id', assigneeId)
    }

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error removing assignee:', deleteError)
      return NextResponse.json(
        { error: `Failed to remove assignee: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Assignee removed'
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/cases/[id]/assignees:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
