/**
 * 알림 발송 이력 API
 * GET: 발송 이력 조회 (필터, 페이지네이션)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import type { NotificationStatus, NotificationChannel, RecipientType, RelatedType } from '@/types/notification';

/**
 * GET /api/admin/notifications/logs
 * 발송 이력 조회
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 필터 파라미터
    const status = searchParams.get('status') as NotificationStatus | null;
    const channel = searchParams.get('channel') as NotificationChannel | null;
    const recipientType = searchParams.get('recipient_type') as RecipientType | null;
    const relatedType = searchParams.get('related_type') as RelatedType | null;
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    // 페이지네이션
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // 쿼리 빌드
    let query = supabase
      .from('notification_logs')
      .select(`
        *,
        template:notification_templates(id, name, category)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (status) {
      query = query.eq('status', status);
    }

    if (channel) {
      query = query.eq('channel', channel);
    }

    if (recipientType) {
      query = query.eq('recipient_type', recipientType);
    }

    if (relatedType) {
      query = query.eq('related_type', relatedType);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59');
    }

    if (search) {
      query = query.or(`recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('발송 이력 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/notifications/logs error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
