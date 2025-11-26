/**
 * 알림 템플릿 관리 API
 * GET: 템플릿 목록 조회
 * POST: 새 템플릿 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { CreateTemplateRequest, TemplateCategory, NotificationChannel } from '@/types/notification';

/**
 * GET /api/admin/notifications/templates
 * 템플릿 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as TemplateCategory | null;
    const channel = searchParams.get('channel') as NotificationChannel | null;
    const activeOnly = searchParams.get('active_only') !== 'false';

    const supabase = await createClient();

    let query = supabase
      .from('notification_templates')
      .select('*')
      .order('category')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (channel) {
      query = query.eq('channel', channel);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('템플릿 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('GET /api/admin/notifications/templates error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications/templates
 * 새 템플릿 생성
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateTemplateRequest = await request.json();

    // 필수 필드 검증
    if (!body.name || !body.channel || !body.category || !body.content) {
      return NextResponse.json(
        { error: '필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notification_templates')
      .insert({
        name: body.name,
        channel: body.channel,
        category: body.category,
        title: body.title,
        content: body.content,
        variables: body.variables || [],
        message_type: body.message_type || 'SMS',
        is_active: body.is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('템플릿 생성 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '템플릿이 생성되었습니다.',
    });
  } catch (error) {
    console.error('POST /api/admin/notifications/templates error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
