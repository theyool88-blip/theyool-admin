import { NextRequest, NextResponse } from 'next/server';
import { syncCalendarEvents, registerCalendarWatch } from '@/lib/google-calendar-sync';
import { createAdminClient } from '@/lib/supabase/server';

// Cron Job: 매일 아침 8시 실행
// 1. 캘린더 동기화 (백업)
// 2. Push Watch 갱신 (7일마다 만료되므로)

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 인증 확인
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // 로컬 개발 환경에서는 통과
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const results: { sync?: unknown; watch?: unknown; error?: string } = {};

    // 1. 캘린더 동기화
    try {
      const syncResult = await syncCalendarEvents();
      results.sync = syncResult;
      console.log('[Cron] Calendar sync completed:', syncResult);
    } catch (syncError) {
      console.error('[Cron] Calendar sync failed:', syncError);
      results.sync = { error: String(syncError) };
    }

    // 2. Push Watch 갱신 확인
    try {
      const supabase = await createAdminClient();
      const { data: watchData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'google_calendar_watch')
        .single();

      if (watchData) {
        const watch = JSON.parse(watchData.value);
        const expiration = Number(watch.expiration);
        const daysUntilExpiry = (expiration - Date.now()) / (24 * 60 * 60 * 1000);

        // 만료 2일 전이면 갱신
        if (daysUntilExpiry < 2) {
          console.log('[Cron] Watch expiring soon, renewing...');
          const watchResult = await registerCalendarWatch();
          results.watch = { renewed: true, ...watchResult };
        } else {
          results.watch = { renewed: false, daysUntilExpiry: Math.round(daysUntilExpiry) };
        }
      } else {
        // Watch가 없으면 새로 등록
        console.log('[Cron] No active watch, registering...');
        const watchResult = await registerCalendarWatch();
        results.watch = { registered: true, ...watchResult };
      }
    } catch (watchError) {
      console.error('[Cron] Watch registration failed:', watchError);
      results.watch = { error: String(watchError) };
    }

    return NextResponse.json({
      status: 'completed',
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Cron] Calendar sync cron failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    );
  }
}
