import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * PATCH /api/admin/cases/[id]
 * Update a legal case
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('legal_cases')
      .update({
        contract_number: body.contract_number || null,
        case_name: body.case_name,
        client_id: body.client_id,
        status: body.status,
        office: body.office || null,
        contract_date: body.contract_date || null,
        retainer_fee: body.retainer_fee,
        total_received: body.total_received,
        success_fee_agreement: body.success_fee_agreement || null,
        calculated_success_fee: body.calculated_success_fee,
        court_case_number: body.court_case_number || null,
        court_name: body.court_name || null,
        case_type: body.case_type || null,
        application_type: body.application_type || null,
        judge_name: body.judge_name || null,
        notes: body.notes || null,
        onedrive_folder_url: body.onedrive_folder_url || null
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating case:', error)
      return NextResponse.json(
        { error: `Failed to update case: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/cases/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/cases/[id]
 * Get a single case by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('legal_cases')
      .select(`
        *,
        client:clients (
          id,
          name,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching case:', error)
      return NextResponse.json(
        { error: `Failed to fetch case: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
