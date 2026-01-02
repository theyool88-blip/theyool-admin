/**
 * [DEPRECATED] Google Calendar Push Notification Webhook
 *
 * 기존: Google Calendar 변경 시 → court_hearings 동기화 (읽기)
 * 신규: 더 이상 Google Calendar에서 읽기 않음
 *
 * 현재 구조: SCOURT → court_hearings → Google Calendar (쓰기 전용)
 */

import { NextRequest, NextResponse } from 'next/server';

// Google Calendar Push Notification Webhook (비활성화)
export async function POST(request: NextRequest) {
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');

  console.log('[Google Calendar Webhook] [DEPRECATED] Received:', {
    channelId,
    resourceState,
    message: 'This webhook is deprecated. Calendar sync is now write-only.',
  });

  // 더 이상 처리하지 않음 (에러 없이 200 반환하여 Google 재시도 방지)
  return NextResponse.json({
    status: 'deprecated',
    message: 'Google Calendar 읽기 기능이 비활성화됨',
  });
}

// Webhook 상태 확인
export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'Google Calendar Webhook is deprecated',
    info: 'SCOURT → court_hearings → Google Calendar (쓰기 전용) 구조로 변경됨',
  });
}
