/**
 * 알림 수동 발송 API
 * POST: 개별/대량 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createClient } from '@/lib/supabase/server';
import { sendNotification, sendBulkNotifications } from '@/lib/notifications/sender';
import type { NotificationChannel, RecipientType, RelatedType } from '@/types/notification';

interface SendRequest {
  template_id?: string;
  custom_content?: string;
  channel: NotificationChannel;
  recipients: Array<{
    type: RecipientType;
    id?: string;
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }>;
  related_type?: RelatedType;
  related_id?: string;
}

/**
 * POST /api/admin/notifications/send
 * 알림 발송
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SendRequest = await request.json();

    // 필수 필드 검증
    if (!body.channel) {
      return NextResponse.json(
        { error: '발송 채널을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (!body.recipients || body.recipients.length === 0) {
      return NextResponse.json(
        { error: '수신자를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!body.template_id && !body.custom_content) {
      return NextResponse.json(
        { error: '템플릿 또는 메시지 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 템플릿 조회 (템플릿 사용시)
    let template = null;
    if (body.template_id) {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', body.template_id)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: '템플릿을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      template = data;
    }

    // 단일 발송
    if (body.recipients.length === 1) {
      const recipient = body.recipients[0];
      const result = await sendNotification({
        channel: body.channel,
        template,
        customContent: body.custom_content,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        recipientType: recipient.type,
        recipientId: recipient.id,
        variables: recipient.variables,
        relatedType: body.related_type,
        relatedId: body.related_id,
      });

      return NextResponse.json({
        success: result.success,
        message: result.success ? '발송 완료' : result.error,
        data: result,
      });
    }

    // 대량 발송
    const notifications = body.recipients.map((recipient) => ({
      channel: body.channel,
      template,
      customContent: body.custom_content,
      recipientPhone: recipient.phone,
      recipientName: recipient.name,
      recipientType: recipient.type,
      recipientId: recipient.id,
      variables: recipient.variables,
      relatedType: body.related_type,
      relatedId: body.related_id,
    }));

    const results = await sendBulkNotifications(notifications);

    return NextResponse.json({
      success: true,
      message: `${results.success}건 발송 완료, ${results.failed}건 실패`,
      data: results,
    });
  } catch (error) {
    console.error('POST /api/admin/notifications/send error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
