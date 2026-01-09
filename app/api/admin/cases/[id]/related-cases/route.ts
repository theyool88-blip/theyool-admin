import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * GET /api/admin/cases/[id]/related-cases
 * Get dismissed related cases for a case
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

    const { id: caseId } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('dismissed_related_cases')
      .select('related_case_no, related_case_type, dismissed_at')
      .eq('case_id', caseId)

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, dismissedRelatedCases: [] })
      }
      console.error('Error fetching dismissed related cases:', error)
      return NextResponse.json(
        { error: `Failed to fetch dismissed related cases: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      dismissedRelatedCases: data || []
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/related-cases:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/cases/[id]/related-cases
 * Dismiss a related case (mark as "연동안함")
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params
    const body = await request.json()
    const { relatedCaseNo, relatedCaseType } = body

    if (!relatedCaseNo || !relatedCaseType) {
      return NextResponse.json(
        { error: 'relatedCaseNo and relatedCaseType are required' },
        { status: 400 }
      )
    }

    if (!['lower_court', 'related_case'].includes(relatedCaseType)) {
      return NextResponse.json(
        { error: 'relatedCaseType must be "lower_court" or "related_case"' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 연동안함 기록 저장
    const { error } = await adminClient
      .from('dismissed_related_cases')
      .upsert({
        case_id: caseId,
        related_case_no: relatedCaseNo,
        related_case_type: relatedCaseType,
        dismissed_at: new Date().toISOString()
      }, {
        onConflict: 'case_id,related_case_no,related_case_type'
      })

    if (error) {
      console.error('Error dismissing related case:', error)
      return NextResponse.json(
        { error: `Failed to dismiss related case: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/admin/cases/[id]/related-cases:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/cases/[id]/related-cases
 * Restore a dismissed related case
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: caseId } = await params
    const { searchParams } = new URL(request.url)
    const relatedCaseNo = searchParams.get('relatedCaseNo')
    const relatedCaseType = searchParams.get('relatedCaseType')

    if (!relatedCaseNo || !relatedCaseType) {
      return NextResponse.json(
        { error: 'relatedCaseNo and relatedCaseType are required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('dismissed_related_cases')
      .delete()
      .eq('case_id', caseId)
      .eq('related_case_no', relatedCaseNo)
      .eq('related_case_type', relatedCaseType)

    if (error) {
      console.error('Error restoring related case:', error)
      return NextResponse.json(
        { error: `Failed to restore related case: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/cases/[id]/related-cases:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
