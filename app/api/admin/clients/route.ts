import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * GET /api/admin/clients
 * Fetch all clients with optional filtering and pagination
 */
export async function GET(request: NextRequest) {
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

    // Fetch case counts and latest case for each client
    const clientsWithCases = await Promise.all(
      (data || []).map(async (client) => {
        // Get case count
        const { count: caseCount } = await supabase
          .from('legal_cases')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id)

        // Get latest case
        const { data: latestCase } = await supabase
          .from('legal_cases')
          .select('id, case_name')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...client,
          case_count: caseCount || 0,
          latest_case: latestCase || null
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
}

/**
 * POST /api/admin/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      name?: string
      phone?: string
      email?: string
      birth_date?: string
      address?: string
      gender?: string | null
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

    // Create the client
    const { data: newClient, error } = await adminClient
      .from('clients')
      .insert([{
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        birth_date: body.birth_date || null,
        address: body.address || null,
        gender: body.gender || null,
        notes: body.notes || null
      }])
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
}
