/**
 * WMONID 갱신 크론 API
 *
 * 매일 만료 임박 WMONID를 확인하고 자동 갱신
 *
 * @endpoint GET /api/cron/wmonid-renewal?secret=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWmonidManager } from '@/lib/scourt/wmonid-manager';
import { getCaseMigrator } from '@/lib/scourt/case-migrator';
import { getScourtSyncSettings } from '@/lib/scourt/sync-settings';
import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// 크론 시크릿
function getCronSecret() {
  return process.env.CRON_SECRET || 'scourt-batch-sync-secret';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. 시크릿 검증
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== getCronSecret()) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[WMONID Renewal] 시작...');

    const settings = await getScourtSyncSettings();
    if (!settings.wmonid.autoRotateEnabled) {
      return NextResponse.json({
        success: true,
        message: 'WMONID auto-rotate disabled',
        renewedCount: 0,
        migratedCases: 0,
        durationMs: Date.now() - startTime,
      });
    }

    const wmonidManager = getWmonidManager();
    const _migrator = getCaseMigrator();

    // 2. 만료 임박 WMONID 조회
    const expiringWmonids = await wmonidManager.getExpiringWmonids(settings.wmonid.renewalBeforeDays);

    if (expiringWmonids.length === 0) {
      console.log('[WMONID Renewal] 갱신 대상 없음');
      return NextResponse.json({
        success: true,
        message: '갱신 대상 WMONID 없음',
        renewedCount: 0,
        migratedCases: 0,
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`[WMONID Renewal] 갱신 대상: ${expiringWmonids.length}개`);

    let renewedCount = 0;
    let migratedCases = 0;
    let failedWmonids = 0;
    const results: Array<{
      wmonidId: string;
      userId: string;
      success: boolean;
      migratedCount?: number;
      error?: string;
    }> = [];

    // 3. 각 WMONID 갱신
    for (const wmonidData of expiringWmonids) {
      try {
        console.log(`\n[WMONID Renewal] 갱신 중: ${wmonidData.id}`);

        // WMONID 갱신 (사건 마이그레이션 포함)
        const newWmonid = await wmonidManager.renewWmonid(wmonidData.id);

        if (newWmonid) {
          renewedCount++;

          // 마이그레이션 결과 확인
          const { data: migratedData } = await getSupabase()
            .from('scourt_profile_cases')
            .select('id')
            .eq('wmonid', newWmonid.wmonid);

          const migrated = migratedData?.length || 0;
          migratedCases += migrated;

          results.push({
            wmonidId: wmonidData.id,
            userId: wmonidData.user_id,
            success: true,
            migratedCount: migrated,
          });
        } else {
          failedWmonids++;
          results.push({
            wmonidId: wmonidData.id,
            userId: wmonidData.user_id,
            success: false,
            error: 'WMONID 발급 실패',
          });
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[WMONID Renewal] 에러: ${errorMsg}`);

        failedWmonids++;
        results.push({
          wmonidId: wmonidData.id,
          userId: wmonidData.user_id,
          success: false,
          error: errorMsg,
        });
      }
    }

    // 4. 로그 저장
    try {
      await getSupabase().from('scourt_sync_logs').insert({
        action: 'wmonid_renewal',
        status: failedWmonids === 0 ? 'success' : 'partial',
        cases_synced: migratedCases,
        cases_failed: failedWmonids,
        duration_ms: Date.now() - startTime,
        details: {
          expiringCount: expiringWmonids.length,
          renewedCount,
          failedWmonids,
          results: results.slice(0, 10),
        },
      });
    } catch (logError) {
      console.error('[WMONID Renewal] 로그 저장 실패:', logError);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[WMONID Renewal] 완료: ${renewedCount}개 갱신, ${migratedCases}건 마이그레이션, ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      message: 'WMONID 갱신 완료',
      expiringCount: expiringWmonids.length,
      renewedCount,
      failedWmonids,
      migratedCases,
      durationMs,
      results: results.slice(0, 10),
    });

  } catch (error) {
    console.error('[WMONID Renewal] 예외 발생:', error);
    return NextResponse.json(
      {
        error: 'WMONID 갱신 실패',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
