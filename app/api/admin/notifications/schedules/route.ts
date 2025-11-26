/**
 * 자동 발송 설정 API
 * GET: 설정 조회
 * PUT: 설정 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { TemplateCategory, NotificationChannel } from '@/types/notification';

/**
 * GET /api/admin/notifications/schedules
 * 자동 발송 설정 조회
 */
export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notification_schedules')
      .select(`
        *,
        template:notification_templates(id, name, category, channel)
      `)
      .order('category');

    if (error) {
      console.error('설정 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/admin/notifications/schedules error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

interface UpdateScheduleRequest {
  category: TemplateCategory;
  template_id?: string;
  days_before?: number;
  time_of_day?: string;
  is_active?: boolean;
  channel?: NotificationChannel | 'both';
}

/**
 * PUT /api/admin/notifications/schedules
 * 자동 발송 설정 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateScheduleRequest = await request.json();

    if (!body.category) {
      return NextResponse.json(
        { error: '카테고리를 지정해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {};
    if (body.template_id !== undefined) updateData.template_id = body.template_id;
    if (body.days_before !== undefined) updateData.days_before = body.days_before;
    if (body.time_of_day !== undefined) updateData.time_of_day = body.time_of_day;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.channel !== undefined) updateData.channel = body.channel;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('notification_schedules')
      .update(updateData)
      .eq('category', body.category)
      .select(`
        *,
        template:notification_templates(id, name, category, channel)
      `)
      .single();

    if (error) {
      console.error('설정 수정 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: '설정이 저장되었습니다.',
    });
  } catch (error) {
    console.error('PUT /api/admin/notifications/schedules error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
