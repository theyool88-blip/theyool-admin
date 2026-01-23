import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant, withTenantId } from '@/lib/api/with-tenant'

/**
 * GET /api/admin/clients
 * Fetch all clients with optional filtering and pagination (테넌트 격리)
 */
export const GET = withTenant(async (request, { tenant }) => {
  try {
    const supabase = createAdminClient()
    const searchParams = request.nextUrl.searchParams

    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '500')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 테넌트 격리 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    // Search by name or phone
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json(
        { error: 'Failed to fetch clients' },
        { status: 500 }
      )
    }

    // Fetch case counts and latest case for each client (via case_parties)
    const clientsWithCases = await Promise.all(
      (data || []).map(async (client) => {
        // Get case count via case_parties
        const { data: caseParties, count: caseCount } = await supabase
          .from('case_parties')
          .select('case_id', { count: 'exact' })
          .eq('client_id', client.id)

        // Get latest case via case_parties
        let latestCase = null
        if (caseParties && caseParties.length > 0) {
          const caseIds = caseParties.map(cp => cp.case_id).filter(Boolean)
          if (caseIds.length > 0) {
            const { data: latestCaseData } = await supabase
              .from('legal_cases')
              .select('id, case_name')
              .in('id', caseIds)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            latestCase = latestCaseData
          }
        }

        return {
          ...client,
          case_count: caseCount || 0,
          latest_case: latestCase
        }
      })
    )

    return NextResponse.json({
      clients: clientsWithCases,
      count: count || 0
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/clients
 * Create a new client (테넌트 자동 할당)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    const body = await request.json() as {
      name?: string
      phone?: string
      email?: string
      birth_date?: string
      resident_number?: string
      address?: string
      bank_account?: string
      client_type?: 'individual' | 'corporation'
      company_name?: string
      registration_number?: string
      notes?: string
    }

    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Create the client (테넌트 ID 포함)
    const { data: newClient, error } = await adminClient
      .from('clients')
      .insert([withTenantId({
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        birth_date: body.birth_date || null,
        resident_number: body.resident_number || null,
        address: body.address || null,
        bank_account: body.bank_account || null,
        client_type: body.client_type || 'individual',
        company_name: body.company_name || null,
        registration_number: body.registration_number || null,
        notes: body.notes || null
      }, tenant)])
      .select()
      .single()

    if (error) {
      console.error('Error creating client:', error)
      return NextResponse.json(
        { error: `Failed to create client: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newClient
    })
  } catch (error) {
    console.error('Error in POST /api/admin/clients:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
})
