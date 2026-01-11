/**
 * POST/PATCH/DELETE /api/admin/receivables/memos
 * 미수금 메모 관리 API (테넌트 격리 적용)
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withTenant } from '@/lib/api/with-tenant'
import { canAccessAccountingWithContext } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/receivables/memos
 * 메모 생성 (의뢰인 기준)
 */
export const POST = withTenant(async (request, { tenant }) => {
  try {
    // 회계 모듈 접근 권한 확인
    if (!canAccessAccountingWithContext(tenant)) {
      return NextResponse.json(
        { error: '회계 기능에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { client_id, content } = body

    if (!client_id || !content) {
      return NextResponse.json(
        { error: 'client_id and content are required' },
        { status: 400 }
      )
    }

    // 의뢰인이 해당 테넌트 소속인지 확인
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      const { data: clientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('tenant_id', tenant.tenantId)
        .single()

      if (!clientCheck) {
        return NextResponse.json(
          { error: '해당 의뢰인을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
    }

    const { data, error } = await supabase
      .from('receivable_memos')
      .insert({
        client_id,
        content,
        is_completed: false,
        tenant_id: tenant.tenantId,
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/admin/receivables/memos] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[POST /api/admin/receivables/memos] Error:', error)
    return NextResponse.json({ error: '메모 생성 실패' }, { status: 500 })
  }
})

/**
 * PATCH /api/admin/receivables/memos
 * 메모 업데이트 (체크 토글)
 */
export const PATCH = withTenant(async (request, { tenant }) => {
  try {
    // 회계 모듈 접근 권한 확인
    if (!canAccessAccountingWithContext(tenant)) {
      return NextResponse.json(
        { error: '회계 기능에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const body = await request.json()
    const { id, is_completed } = body

    if (!id || typeof is_completed !== 'boolean') {
      return NextResponse.json(
        { error: 'id and is_completed are required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      is_completed,
      updated_at: new Date().toISOString(),
    }

    if (is_completed) {
      updateData.completed_at = new Date().toISOString()
    } else {
      updateData.completed_at = null
    }

    let query = supabase
      .from('receivable_memos')
      .update(updateData)
      .eq('id', id)

    // 테넌트 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { data, error } = await query.select().single()

    if (error) {
      console.error('[PATCH /api/admin/receivables/memos] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[PATCH /api/admin/receivables/memos] Error:', error)
    return NextResponse.json({ error: '메모 업데이트 실패' }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/receivables/memos
 * 메모 삭제
 */
export const DELETE = withTenant(async (request, { tenant }) => {
  try {
    // 회계 모듈 접근 권한 확인
    if (!canAccessAccountingWithContext(tenant)) {
      return NextResponse.json(
        { error: '회계 기능에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    let query = supabase
      .from('receivable_memos')
      .delete()
      .eq('id', id)

    // 테넌트 필터
    if (!tenant.isSuperAdmin && tenant.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId)
    }

    const { error } = await query

    if (error) {
      console.error('[DELETE /api/admin/receivables/memos] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/receivables/memos] Error:', error)
    return NextResponse.json({ error: '메모 삭제 실패' }, { status: 500 })
  }
})
