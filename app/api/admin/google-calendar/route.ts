import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCalendarList, getCalendarEvents, refreshAccessToken } from '@/lib/google-calendar';

// 저장된 토큰 가져오기
async function getStoredTokens() {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'google_calendar_tokens')
    .single();

  if (error || !data) {
    return null;
  }

  return JSON.parse(data.value);
}

// 토큰 업데이트
async function updateTokens(tokens: { access_token: string; expiry_date?: number }) {
  const supabase = await createAdminClient();
  const existingTokens = await getStoredTokens();

  await supabase
    .from('app_settings')
    .update({
      value: JSON.stringify({
        ...existingTokens,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'google_calendar_tokens');
}

// GET: 캘린더 목록 또는 이벤트 가져오기
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'calendars';
    const calendarId = searchParams.get('calendarId');

    const tokens = await getStoredTokens();

    if (!tokens) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', needsAuth: true },
        { status: 401 }
      );
    }

    let accessToken = tokens.access_token;

    // 토큰 만료 확인 및 갱신
    if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
      if (!tokens.refresh_token) {
        return NextResponse.json(
          { error: 'Token expired, please reconnect', needsAuth: true },
          { status: 401 }
        );
      }

      const newTokens = await refreshAccessToken(tokens.refresh_token);
      accessToken = newTokens.access_token!;
      await updateTokens({
        access_token: newTokens.access_token!,
        expiry_date: newTokens.expiry_date || undefined,
      });
    }

    if (action === 'calendars') {
      // 캘린더 목록 가져오기
      const calendars = await getCalendarList(accessToken);
      return NextResponse.json({ calendars });
    }

    if (action === 'events') {
      if (!calendarId) {
        return NextResponse.json(
          { error: 'calendarId is required' },
          { status: 400 }
        );
      }

      const timeMin = searchParams.get('timeMin') || undefined;
      const timeMax = searchParams.get('timeMax') || undefined;

      const events = await getCalendarEvents(accessToken, calendarId, {
        timeMin,
        timeMax,
      });

      return NextResponse.json({ events });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Google Calendar API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Google Calendar' },
      { status: 500 }
    );
  }
}
