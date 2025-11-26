import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 메모 생성 (의뢰인 기준)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const body = await request.json()
    const { client_id, content } = body

    if (!client_id || !content) {
      return NextResponse.json(
        { error: 'client_id and content are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('receivable_memos')
      .insert({
        client_id,
        content,
        is_completed: false,
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
}

// 메모 업데이트 (체크 토글)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
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

    const { data, error } = await supabase
      .from('receivable_memos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/admin/receivables/memos] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[PATCH /api/admin/receivables/memos] Error:', error)
    return NextResponse.json({ error: '메모 업데이트 실패' }, { status: 500 })
  }
}

// 메모 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('receivable_memos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/admin/receivables/memos] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/admin/receivables/memos] Error:', error)
    return NextResponse.json({ error: '메모 삭제 실패' }, { status: 500 })
  }
}
