import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/clients/[id]
 * Fetch a single client by ID
 */
export const GET = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }
    const adminClient = createAdminClient()

    let query = adminClient
      .from('clients')
      .select('*')
      .eq('id', id)

    // 테넌트 격리
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query.single()

    if (error) {
      console.error('Error fetching client:', error)
      return NextResponse.json(
        { error: `Failed to fetch client: ${error.message}` },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in GET /api/admin/clients/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/admin/clients/[id]
 * Update a client and sync to case_parties if name changed
 */
export const PATCH = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }
    const body = await request.json() as {
      name?: string
      phone?: string
      email?: string
      birth_date?: string
      address?: string
      bank_account?: string
      resident_number?: string
      client_type?: 'individual' | 'corporation'
      company_name?: string
      registration_number?: string
      notes?: string
    }

    const adminClient = createAdminClient()

    // 1. 기존 client 정보 조회 (이름 변경 감지용)
    let existingQuery = adminClient
      .from('clients')
      .select('name')
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      existingQuery = existingQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: oldClient, error: fetchError } = await existingQuery.single()

    if (fetchError) {
      console.error('Error fetching existing client:', fetchError)
      return NextResponse.json(
        { error: `Client not found: ${fetchError.message}` },
        { status: fetchError.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // 2. clients 테이블 업데이트
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // 전달된 필드만 업데이트 (undefined는 무시)
    if (body.name !== undefined) updateData.name = body.name
    if (body.phone !== undefined) updateData.phone = body.phone || null
    if (body.email !== undefined) updateData.email = body.email || null
    if (body.birth_date !== undefined) updateData.birth_date = body.birth_date || null
    if (body.address !== undefined) updateData.address = body.address || null
    if (body.bank_account !== undefined) updateData.bank_account = body.bank_account || null
    if (body.resident_number !== undefined) updateData.resident_number = body.resident_number || null
    if (body.client_type !== undefined) updateData.client_type = body.client_type
    if (body.company_name !== undefined) updateData.company_name = body.company_name || null
    if (body.registration_number !== undefined) updateData.registration_number = body.registration_number || null
    if (body.notes !== undefined) updateData.notes = body.notes || null

    let updateQuery = adminClient
      .from('clients')
      .update(updateData)
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      updateQuery = updateQuery.eq('tenant_id', tenant.tenantId)
    }

    const { data: updatedClient, error: updateError } = await updateQuery.select().single()

    if (updateError) {
      console.error('Error updating client:', updateError)
      return NextResponse.json(
        { error: `Failed to update client: ${updateError.message}` },
        { status: 500 }
      )
    }

    // 3. 이름이 변경된 경우 case_parties 동기화
    let syncedCount = 0
    if (body.name && body.name !== oldClient.name) {
      // manual_override=false인 당사자만 업데이트
      // 번호 prefix가 있으면 보존하고 이름만 변경
      const { data: partiesToUpdate, error: partiesError } = await adminClient
        .from('case_parties')
        .select('id, party_name')
        .eq('client_id', id)
        .eq('manual_override', false)

      if (!partiesError && partiesToUpdate && partiesToUpdate.length > 0) {
        for (const party of partiesToUpdate) {
          // 번호 prefix 추출 (예: "1. 홍길동" → "1. ")
          const prefixMatch = party.party_name.match(/^(\d+\.\s*)/)
          const prefix = prefixMatch ? prefixMatch[1] : ''
          const newPartyName = prefix + body.name

          await adminClient
            .from('case_parties')
            .update({
              party_name: newPartyName,
              updated_at: new Date().toISOString()
            })
            .eq('id', party.id)
        }
        syncedCount = partiesToUpdate.length
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedClient,
      syncedParties: syncedCount
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/clients/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/clients/[id]
 * Delete a client (soft delete or hard delete based on usage)
 */
export const DELETE = withTenant(async (
  request: NextRequest,
  { tenant, params }: { tenant: { tenantId: string | null; isSuperAdmin: boolean }; params?: Record<string, string> }
) => {
  try {
    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }
    const adminClient = createAdminClient()

    // 사건에서 사용중인지 확인
    const { count } = await adminClient
      .from('legal_cases')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete client: ${count} case(s) are using this client` },
        { status: 400 }
      )
    }

    let deleteQuery = adminClient
      .from('clients')
      .delete()
      .eq('id', id)

    if (!tenant.isSuperAdmin && tenant.tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenant.tenantId)
    }

    const { error } = await deleteQuery

    if (error) {
      console.error('Error deleting client:', error)
      return NextResponse.json(
        { error: `Failed to delete client: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Error in DELETE /api/admin/clients/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
