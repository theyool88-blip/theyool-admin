import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import type { TenantContext } from '@/types/tenant'

// Helper types for join results
interface MemberJoin {
  id: string
  display_name: string
  role: string
  title?: string
}

interface AssignmentRow {
  id: string
  staff_member_id: string
  lawyer_member_id: string
  created_at: string
  staff_member: MemberJoin | null
  lawyer_member: MemberJoin | null
}

interface LawyerOnlyRow {
  id: string
  staff_member_id: string
  lawyer_member_id: string
  created_at: string
  lawyer_member: MemberJoin | null
}

/**
 * GET /api/admin/staff-lawyer-assignments
 * Get all staff-lawyer assignments for the tenant
 * Query params: ?staff_member_id=xxx or ?lawyer_member_id=xxx
 */
export const GET = withTenant(async (
  request: NextRequest,
  { tenant }: { tenant: TenantContext }
) => {
  try {
    const url = new URL(request.url)
    const staffMemberId = url.searchParams.get('staff_member_id')
    const lawyerMemberId = url.searchParams.get('lawyer_member_id')

    const adminClient = createAdminClient()

    let query = adminClient
      .from('staff_lawyer_assignments')
      .select(`
        id,
        staff_member_id,
        lawyer_member_id,
        created_at,
        staff_member:tenant_members!staff_member_id (
          id,
          display_name,
          role,
          title
        ),
        lawyer_member:tenant_members!lawyer_member_id (
          id,
          display_name,
          role,
          title
        )
      `)
      .order('created_at', { ascending: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    if (staffMemberId) {
      query = query.eq('staff_member_id', staffMemberId)
    }

    if (lawyerMemberId) {
      query = query.eq('lawyer_member_id', lawyerMemberId)
    }

    const { data: assignments, error } = await query

    if (error) {
      console.error('Error fetching staff-lawyer assignments:', error)
      return NextResponse.json(
        { error: `Failed to fetch assignments: ${error.message}` },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const transformed = ((assignments as unknown) as AssignmentRow[] || []).map(a => ({
      id: a.id,
      staffMemberId: a.staff_member_id,
      lawyerMemberId: a.lawyer_member_id,
      createdAt: a.created_at,
      staffMember: a.staff_member ? {
        id: a.staff_member.id,
        displayName: a.staff_member.display_name,
        role: a.staff_member.role,
        title: a.staff_member.title
      } : null,
      lawyerMember: a.lawyer_member ? {
        id: a.lawyer_member.id,
        displayName: a.lawyer_member.display_name,
        role: a.lawyer_member.role,
        title: a.lawyer_member.title
      } : null
    }))

    return NextResponse.json({
      success: true,
      assignments: transformed
    })
  } catch (error) {
    console.error('Error in GET /api/admin/staff-lawyer-assignments:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * POST /api/admin/staff-lawyer-assignments
 * Create a new staff-lawyer assignment
 */
export const POST = withTenant(async (
  request: NextRequest,
  { tenant }: { tenant: TenantContext }
) => {
  try {
    const body = await request.json() as {
      staff_member_id: string
      lawyer_member_id: string
    }

    if (!body.staff_member_id || !body.lawyer_member_id) {
      return NextResponse.json(
        { error: 'staff_member_id and lawyer_member_id are required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify staff member exists and has staff role
    const { data: staffMember, error: staffError } = await adminClient
      .from('tenant_members')
      .select('id, role, tenant_id')
      .eq('id', body.staff_member_id)
      .single()

    if (staffError || !staffMember) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    if (staffMember.role !== 'staff') {
      return NextResponse.json(
        { error: 'The member must have the staff role' },
        { status: 400 }
      )
    }

    // Verify lawyer member exists and has lawyer/admin/owner role
    const { data: lawyerMember, error: lawyerError } = await adminClient
      .from('tenant_members')
      .select('id, role, tenant_id')
      .eq('id', body.lawyer_member_id)
      .single()

    if (lawyerError || !lawyerMember) {
      return NextResponse.json(
        { error: 'Lawyer member not found' },
        { status: 404 }
      )
    }

    if (!['owner', 'admin', 'lawyer'].includes(lawyerMember.role)) {
      return NextResponse.json(
        { error: 'The lawyer member must have owner, admin, or lawyer role' },
        { status: 400 }
      )
    }

    // Verify both are in the same tenant
    if (staffMember.tenant_id !== lawyerMember.tenant_id) {
      return NextResponse.json(
        { error: 'Staff and lawyer must be in the same tenant' },
        { status: 400 }
      )
    }

    // Check tenant access
    if (!tenant.isSuperAdmin && tenant.tenantId !== staffMember.tenant_id) {
      return NextResponse.json(
        { error: 'Not authorized to manage this tenant' },
        { status: 403 }
      )
    }

    // Create the assignment
    const { data: newAssignment, error: insertError } = await adminClient
      .from('staff_lawyer_assignments')
      .insert([withTenantId({
        staff_member_id: body.staff_member_id,
        lawyer_member_id: body.lawyer_member_id
      }, tenant)])
      .select(`
        id,
        staff_member_id,
        lawyer_member_id,
        created_at,
        staff_member:tenant_members!staff_member_id (
          id,
          display_name,
          role,
          title
        ),
        lawyer_member:tenant_members!lawyer_member_id (
          id,
          display_name,
          role,
          title
        )
      `)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This assignment already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating assignment:', insertError)
      return NextResponse.json(
        { error: `Failed to create assignment: ${insertError.message}` },
        { status: 500 }
      )
    }

    const assignmentData = (newAssignment as unknown) as AssignmentRow

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignmentData.id,
        staffMemberId: assignmentData.staff_member_id,
        lawyerMemberId: assignmentData.lawyer_member_id,
        createdAt: assignmentData.created_at,
        staffMember: assignmentData.staff_member ? {
          id: assignmentData.staff_member.id,
          displayName: assignmentData.staff_member.display_name,
          role: assignmentData.staff_member.role,
          title: assignmentData.staff_member.title
        } : null,
        lawyerMember: assignmentData.lawyer_member ? {
          id: assignmentData.lawyer_member.id,
          displayName: assignmentData.lawyer_member.display_name,
          role: assignmentData.lawyer_member.role,
          title: assignmentData.lawyer_member.title
        } : null
      }
    })
  } catch (error) {
    console.error('Error in POST /api/admin/staff-lawyer-assignments:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/staff-lawyer-assignments
 * Delete a staff-lawyer assignment
 * Query params: ?id=xxx or ?staff_member_id=xxx&lawyer_member_id=xxx
 */
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant }: { tenant: TenantContext }
) => {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const staffMemberId = url.searchParams.get('staff_member_id')
    const lawyerMemberId = url.searchParams.get('lawyer_member_id')

    if (!id && !(staffMemberId && lawyerMemberId)) {
      return NextResponse.json(
        { error: 'Either id or both staff_member_id and lawyer_member_id are required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    let deleteQuery = adminClient
      .from('staff_lawyer_assignments')
      .delete()

    if (id) {
      deleteQuery = deleteQuery.eq('id', id)
    } else {
      deleteQuery = deleteQuery
        .eq('staff_member_id', staffMemberId!)
        .eq('lawyer_member_id', lawyerMemberId!)
    }

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting assignment:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete assignment: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Assignment deleted'
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/staff-lawyer-assignments:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * PUT /api/admin/staff-lawyer-assignments
 * Replace all lawyer assignments for a staff member
 */
export const PUT = withTenant(async (
  request: NextRequest,
  { tenant }: { tenant: TenantContext }
) => {
  try {
    const body = await request.json() as {
      staff_member_id: string
      lawyer_member_ids: string[]
    }

    if (!body.staff_member_id) {
      return NextResponse.json(
        { error: 'staff_member_id is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.lawyer_member_ids)) {
      return NextResponse.json(
        { error: 'lawyer_member_ids must be an array' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify staff member exists and has staff role
    const { data: staffMember, error: staffError } = await adminClient
      .from('tenant_members')
      .select('id, role, tenant_id')
      .eq('id', body.staff_member_id)
      .single()

    if (staffError || !staffMember) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      )
    }

    if (staffMember.role !== 'staff') {
      return NextResponse.json(
        { error: 'The member must have the staff role' },
        { status: 400 }
      )
    }

    // Check tenant access
    if (!tenant.isSuperAdmin && tenant.tenantId !== staffMember.tenant_id) {
      return NextResponse.json(
        { error: 'Not authorized to manage this tenant' },
        { status: 403 }
      )
    }

    // Delete existing assignments for this staff member
    await adminClient
      .from('staff_lawyer_assignments')
      .delete()
      .eq('staff_member_id', body.staff_member_id)

    // Insert new assignments
    if (body.lawyer_member_ids.length > 0) {
      const insertPayload = body.lawyer_member_ids.map(lawyerId => withTenantId({
        staff_member_id: body.staff_member_id,
        lawyer_member_id: lawyerId
      }, tenant))

      const { error: insertError } = await adminClient
        .from('staff_lawyer_assignments')
        .insert(insertPayload)

      if (insertError) {
        console.error('Error replacing assignments:', insertError)
        return NextResponse.json(
          { error: `Failed to replace assignments: ${insertError.message}` },
          { status: 500 }
        )
      }
    }

    // Fetch updated assignments
    const { data: updatedAssignments } = await adminClient
      .from('staff_lawyer_assignments')
      .select(`
        id,
        staff_member_id,
        lawyer_member_id,
        created_at,
        lawyer_member:tenant_members!lawyer_member_id (
          id,
          display_name,
          role,
          title
        )
      `)
      .eq('staff_member_id', body.staff_member_id)

    return NextResponse.json({
      success: true,
      assignments: ((updatedAssignments as unknown) as LawyerOnlyRow[] || []).map(a => ({
        id: a.id,
        staffMemberId: a.staff_member_id,
        lawyerMemberId: a.lawyer_member_id,
        createdAt: a.created_at,
        lawyerMember: a.lawyer_member ? {
          id: a.lawyer_member.id,
          displayName: a.lawyer_member.display_name,
          role: a.lawyer_member.role,
          title: a.lawyer_member.title
        } : null
      }))
    })
  } catch (error) {
    console.error('Error in PUT /api/admin/staff-lawyer-assignments:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
