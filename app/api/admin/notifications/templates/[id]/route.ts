/**
 * 개별 템플릿 관리 API
 * GET: 템플릿 상세 조회
 * PUT: 템플릿 수정
 * DELETE: 템플릿 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { UpdateTemplateRequest } from '@/types/notification';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/notifications/templates/[id]
 * 템플릿 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('템플릿 조회 오류:', error);
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/admin/notifications/templates/[id] error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/notifications/templates/[id]
 * 템플릿 수정
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body: Partial<UpdateTemplateRequest> = await request.json();

    const supabase = await createClient();

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.variables !== undefined) updateData.variables = body.variables;
    if (body.message_type !== undefined) updateData.message_type = body.message_type;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('notification_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('템플릿 수정 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '템플릿이 수정되었습니다.',
    });
  } catch (error) {
    console.error('PUT /api/admin/notifications/templates/[id] error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/templates/[id]
 * 템플릿 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // 사용 중인 스케줄이 있는지 확인
    const { data: schedules } = await supabase
      .from('notification_schedules')
      .select('id')
      .eq('template_id', id);

    if (schedules && schedules.length > 0) {
      return NextResponse.json(
        { error: '자동 발송 설정에서 사용 중인 템플릿은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('템플릿 삭제 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '템플릿이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('DELETE /api/admin/notifications/templates/[id] error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
