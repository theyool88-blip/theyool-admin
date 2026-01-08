import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticated } from '@/lib/auth/auth'

/**
 * GET /api/admin/cases/[id]/notices
 * Get dismissed notices for a case
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
      .from('dismissed_case_notices')
      .select('notice_id, dismissed_at')
      .eq('case_id', caseId)

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, dismissedNotices: [] })
      }
      console.error('Error fetching dismissed notices:', error)
      return NextResponse.json(
        { error: `Failed to fetch dismissed notices: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      dismissedNotices: data?.map(d => d.notice_id) || []
    })
  } catch (error) {
    console.error('Error in GET /api/admin/cases/[id]/notices:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/cases/[id]/notices
 * Dismiss a notice
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
    const { noticeId } = body

    if (!noticeId) {
      return NextResponse.json(
        { error: 'noticeId is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // 알림 삭제 기록 저장
    const { error } = await adminClient
      .from('dismissed_case_notices')
      .upsert({
        case_id: caseId,
        notice_id: noticeId,
        dismissed_at: new Date().toISOString()
      }, {
        onConflict: 'case_id,notice_id'
      })

    if (error) {
      console.error('Error dismissing notice:', error)
      return NextResponse.json(
        { error: `Failed to dismiss notice: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/admin/cases/[id]/notices:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/cases/[id]/notices
 * Restore a dismissed notice
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
    const noticeId = searchParams.get('noticeId')

    if (!noticeId) {
      return NextResponse.json(
        { error: 'noticeId is required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('dismissed_case_notices')
      .delete()
      .eq('case_id', caseId)
      .eq('notice_id', noticeId)

    if (error) {
      console.error('Error restoring notice:', error)
      return NextResponse.json(
        { error: `Failed to restore notice: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/admin/cases/[id]/notices:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
