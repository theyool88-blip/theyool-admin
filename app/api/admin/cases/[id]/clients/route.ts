import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'
import type { TenantContext } from '@/types/tenant'

interface ClientJoin {
  id: string
  name: string
  phone?: string
  email?: string
}

interface LinkedPartyJoin {
  id: string
  party_name: string
  party_type: string
  scourt_party_index: number | null
}

interface CaseClientRow {
  id: string
  case_id: string
  client_id: string
  linked_party_id: string | null
  is_primary_client: boolean
  retainer_fee: number | null
  success_fee_terms: string | null
  notes: string | null
  created_at: string
  updated_at: string
  client: ClientJoin | null
  linked_party: LinkedPartyJoin | null
}

/**
 * GET /api/admin/cases/[id]/clients
 * Get all clients for a case
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
      .from('case_clients')
      .select(`
        id,
        case_id,
        client_id,
        linked_party_id,
        is_primary_client,
        retainer_fee,
        success_fee_terms,
        notes,
        created_at,
        updated_at,
        client:clients!client_id (
          id,
          name,
          phone,
          email
        ),
        linked_party:case_parties!linked_party_id (
          id,
          party_name,
          party_type,
          scourt_party_index
        )
      `)
      .eq('case_id', id)
      .order('is_primary_client', { ascending: false })
      .order('created_at', { ascending: true })

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data: caseClients, error } = await query

    if (error) {
      console.error('Error fetching case clients:', error)
      return NextResponse.json(
        { error: `Failed to fetch case clients: ${error.message}` },
        { status: 500 }
      )
    }

    // Transform to camelCase
    const transformed = ((caseClients as unknown) as CaseClientRow[] || []).map(cc => ({
      id: cc.id,
      caseId: cc.case_id,
      clientId: cc.client_id,
      linkedPartyId: cc.linked_party_id,
      isPrimaryClient: cc.is_primary_client,
      retainerFee: cc.retainer_fee,
      successFeeTerms: cc.success_fee_terms,
      notes: cc.notes,
      createdAt: cc.created_at,
      updatedAt: cc.updated_at,
      client: cc.client,
      linkedParty: cc.linked_party ? {
        id: cc.linked_party.id,
        partyName: cc.linked_party.party_name,
        partyType: cc.linked_party.party_type,
        scourtPartyIndex: cc.linked_party.scourt_party_index
      } : null
    }))

    return NextResponse.json({
      success: true,
      caseClients: transformed
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * POST /api/admin/cases/[id]/clients
 * Add a client to a case
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
      client_id: string
      linked_party_id?: string | null
      is_primary_client?: boolean
      retainer_fee?: number | null
      success_fee_terms?: string | null
      notes?: string | null
    }

    if (!body.client_id) {
      return NextResponse.json(
        { error: 'client_id is required' },
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

    // Check if client exists and is in the same tenant
    const { data: client, error: clientError } = await adminClient
      .from('clients')
      .select('id, tenant_id')
      .eq('id', body.client_id)
      .eq('tenant_id', legalCase.tenant_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found or not in the same tenant' },
        { status: 404 }
      )
    }

    // If is_primary_client is true, we need to update other clients
    if (body.is_primary_client) {
      await adminClient
        .from('case_clients')
        .update({ is_primary_client: false })
        .eq('case_id', id)
        .eq('is_primary_client', true)
    }

    // Insert the new case_client
    const { data: newCaseClient, error: insertError } = await adminClient
      .from('case_clients')
      .insert([withTenantId({
        case_id: id,
        client_id: body.client_id,
        linked_party_id: body.linked_party_id || null,
        is_primary_client: body.is_primary_client || false,
        retainer_fee: body.retainer_fee || null,
        success_fee_terms: body.success_fee_terms || null,
        notes: body.notes || null
      }, tenant)])
      .select(`
        id,
        case_id,
        client_id,
        linked_party_id,
        is_primary_client,
        retainer_fee,
        success_fee_terms,
        notes,
        created_at,
        updated_at,
        client:clients!client_id (
          id,
          name,
          phone,
          email
        ),
        linked_party:case_parties!linked_party_id (
          id,
          party_name,
          party_type,
          scourt_party_index
        )
      `)
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        // Unique constraint violation - client already linked
        return NextResponse.json(
          { error: 'This client is already linked to the case' },
          { status: 409 }
        )
      }
      console.error('Error adding case client:', insertError)
      return NextResponse.json(
        { error: `Failed to add case client: ${insertError.message}` },
        { status: 500 }
      )
    }

    const cc = (newCaseClient as unknown) as CaseClientRow

    return NextResponse.json({
      success: true,
      caseClient: {
        id: cc.id,
        caseId: cc.case_id,
        clientId: cc.client_id,
        linkedPartyId: cc.linked_party_id,
        isPrimaryClient: cc.is_primary_client,
        retainerFee: cc.retainer_fee,
        successFeeTerms: cc.success_fee_terms,
        notes: cc.notes,
        createdAt: cc.created_at,
        updatedAt: cc.updated_at,
        client: cc.client,
        linkedParty: cc.linked_party ? {
          id: cc.linked_party.id,
          partyName: cc.linked_party.party_name,
          partyType: cc.linked_party.party_type,
          scourtPartyIndex: cc.linked_party.scourt_party_index
        } : null
      }
    })
  } catch (error) {
    console.error('Error in POST /api/admin/cases/[id]/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * PATCH /api/admin/cases/[id]/clients
 * Update a case client
 * Query params: ?case_client_id=xxx
 */
export const PATCH = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: TenantContext; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const url = new URL(request.url)
    const caseClientId = url.searchParams.get('case_client_id')

    if (!caseClientId) {
      return NextResponse.json(
        { error: 'case_client_id query param is required' },
        { status: 400 }
      )
    }

    const body = await request.json() as {
      linked_party_id?: string | null
      is_primary_client?: boolean
      retainer_fee?: number | null
      success_fee_terms?: string | null
      notes?: string | null
    }

    const adminClient = createAdminClient()

    // If is_primary_client is true, update other clients first
    if (body.is_primary_client === true) {
      let resetQuery = adminClient
        .from('case_clients')
        .update({ is_primary_client: false })
        .eq('case_id', id)
        .eq('is_primary_client', true)
        .neq('id', caseClientId)

      if (!tenant.isSuperAdmin && tenant.tenantId) {
        resetQuery = resetQuery.eq('tenant_id', tenant.tenantId)
      }

      await resetQuery
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if ('linked_party_id' in body) updatePayload.linked_party_id = body.linked_party_id
    if ('is_primary_client' in body) updatePayload.is_primary_client = body.is_primary_client
    if ('retainer_fee' in body) updatePayload.retainer_fee = body.retainer_fee
    if ('success_fee_terms' in body) updatePayload.success_fee_terms = body.success_fee_terms
    if ('notes' in body) updatePayload.notes = body.notes

    let updateQuery = adminClient
      .from('case_clients')
      .update(updatePayload)
      .eq('id', caseClientId)
      .eq('case_id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: updatedCaseClient, error: updateError } = await updateQuery
      .select(`
        id,
        case_id,
        client_id,
        linked_party_id,
        is_primary_client,
        retainer_fee,
        success_fee_terms,
        notes,
        created_at,
        updated_at,
        client:clients!client_id (
          id,
          name,
          phone,
          email
        ),
        linked_party:case_parties!linked_party_id (
          id,
          party_name,
          party_type,
          scourt_party_index
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating case client:', updateError)
      return NextResponse.json(
        { error: `Failed to update case client: ${updateError.message}` },
        { status: 500 }
      )
    }

    const cc = (updatedCaseClient as unknown) as CaseClientRow

    return NextResponse.json({
      success: true,
      caseClient: {
        id: cc.id,
        caseId: cc.case_id,
        clientId: cc.client_id,
        linkedPartyId: cc.linked_party_id,
        isPrimaryClient: cc.is_primary_client,
        retainerFee: cc.retainer_fee,
        successFeeTerms: cc.success_fee_terms,
        notes: cc.notes,
        createdAt: cc.created_at,
        updatedAt: cc.updated_at,
        client: cc.client,
        linkedParty: cc.linked_party ? {
          id: cc.linked_party.id,
          partyName: cc.linked_party.party_name,
          partyType: cc.linked_party.party_type,
          scourtPartyIndex: cc.linked_party.scourt_party_index
        } : null
      }
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/cases/[id]/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/cases/[id]/clients
 * Remove a client from a case
 * Query params: ?case_client_id=xxx or ?client_id=xxx
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
    const caseClientId = url.searchParams.get('case_client_id')
    const clientId = url.searchParams.get('client_id')

    if (!caseClientId && !clientId) {
      return NextResponse.json(
        { error: 'Either case_client_id or client_id query param is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Build delete query
    let deleteQuery = adminClient
      .from('case_clients')
      .delete()
      .eq('case_id', id)

    if (caseClientId) {
      deleteQuery = deleteQuery.eq('id', caseClientId)
    } else if (clientId) {
      deleteQuery = deleteQuery.eq('client_id', clientId)
    }

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error removing case client:', deleteError)
      return NextResponse.json(
        { error: `Failed to remove case client: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Case client removed'
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/cases/[id]/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
