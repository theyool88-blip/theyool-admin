import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncCalendarEvents } from '@/lib/google-calendar-sync';

// Google Calendar Push Notification Webhook
// Google이 캘린더 변경 시 이 엔드포인트로 POST 요청을 보냄

export async function POST(request: NextRequest) {
  try {
    // Google Push Notification 헤더 확인
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceState = request.headers.get('x-goog-resource-state');
    const resourceId = request.headers.get('x-goog-resource-id');

    console.log('[Google Calendar Webhook] Received:', {
      channelId,
      resourceState,
      resourceId,
    });

    // sync: 최초 등록 확인 (무시)
    if (resourceState === 'sync') {
      console.log('[Google Calendar Webhook] Initial sync confirmation');
      return NextResponse.json({ status: 'ok' });
    }

    // exists 또는 update: 실제 변경 발생
    if (resourceState === 'exists' || resourceState === 'update') {
      console.log('[Google Calendar Webhook] Calendar changed, syncing...');

      // 캘린더 동기화 실행
      const result = await syncCalendarEvents();

      console.log('[Google Calendar Webhook] Sync result:', result);

      return NextResponse.json({ status: 'synced', ...result });
    }

    return NextResponse.json({ status: 'ignored', resourceState });
  } catch (error) {
    console.error('[Google Calendar Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Google이 Webhook 검증할 때 사용
export async function GET() {
  return NextResponse.json({ status: 'Google Calendar Webhook is active' });
}
