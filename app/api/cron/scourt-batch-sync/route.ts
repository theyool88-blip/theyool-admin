/**
 * SCOURT 배치 동기화 크론 API
 *
 * 매일 새벽에 모든 진행중 사건을 자동 동기화
 *
 * v2: 병렬 처리 지원 (4개 브라우저 동시 실행)
 * - 기존: 50건 × 3초 = 150초
 * - 개선: 50건 / 4 = 12~13라운드 × 3초 = 36~39초
 *
 * @endpoint GET /api/cron/scourt-batch-sync?secret=xxx&parallel=true
 */

import { NextRequest, NextResponse } from 'next/server';
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

// 크론 시크릿 (환경변수에서 설정)
function getCronSecret() {
  return process.env.CRON_SECRET || 'scourt-batch-sync-secret';
}

// 동기화 설정
const SYNC_CONFIG = {
  maxCasesPerRun: 50,         // 한 번에 최대 동기화 사건 수
  syncIntervalMs: 3000,       // 사건 간 동기화 간격 (순차 모드)
  minHoursSinceLastSync: 12,  // 마지막 동기화 이후 최소 시간
  parallelBrowsers: 4,        // 병렬 브라우저 수
  parallelChunkDelay: 2000,   // 청크 간 대기 시간
};

interface SyncResult {
  caseId: string;
  caseNumber: string;
  success: boolean;
  updateCount?: number;
  error?: string;
  durationMs?: number;
}

interface CaseToSync {
  id: string;
  court_case_number: string;
}

/**
 * 단일 사건 동기화 호출
 */
async function syncSingleCase(caseItem: CaseToSync): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    const syncResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/scourt/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legalCaseId: caseItem.id,
          caseNumber: caseItem.court_case_number,
          forceRefresh: false,
        }),
      }
    );

    const syncResult = await syncResponse.json();

    if (syncResult.success || syncResult.skipped) {
      return {
        caseId: caseItem.id,
        caseNumber: caseItem.court_case_number,
        success: true,
        updateCount: syncResult.updateCount || 0,
        durationMs: Date.now() - startTime,
      };
    }

    return {
      caseId: caseItem.id,
      caseNumber: caseItem.court_case_number,
      success: false,
      error: syncResult.error || '동기화 실패',
      durationMs: Date.now() - startTime,
    };

  } catch (error) {
    return {
      caseId: caseItem.id,
      caseNumber: caseItem.court_case_number,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 병렬 배치 동기화 (청크 기반)
 */
async function parallelBatchSync(
  cases: CaseToSync[],
  concurrency: number = SYNC_CONFIG.parallelBrowsers
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const chunks: CaseToSync[][] = [];

  // 청크로 분할
  for (let i = 0; i < cases.length; i += concurrency) {
    chunks.push(cases.slice(i, i + concurrency));
  }

  console.log(`[SCOURT Batch Sync] 병렬 처리: ${chunks.length}개 청크 (각 ${concurrency}건)`);

  // 청크별 병렬 처리
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`  청크 ${i + 1}/${chunks.length} 처리 중... (${chunk.length}건)`);

    // 청크 내 병렬 실행
    const chunkPromises = chunk.map((caseItem) => syncSingleCase(caseItem));
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // 청크 간 대기 (마지막 청크 제외)
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, SYNC_CONFIG.parallelChunkDelay));
    }
  }

  return results;
}

/**
 * 순차 배치 동기화 (기존 방식)
 */
async function sequentialBatchSync(cases: CaseToSync[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const caseItem = cases[i];
    console.log(`[SCOURT Batch Sync] ${i + 1}/${cases.length}: ${caseItem.court_case_number}`);

    const result = await syncSingleCase(caseItem);
    results.push(result);

    // 요청 간격 대기
    if (i < cases.length - 1) {
      await new Promise((r) => setTimeout(r, SYNC_CONFIG.syncIntervalMs));
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. 시크릿 검증
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const useParallel = searchParams.get('parallel') === 'true';

  if (secret !== getCronSecret()) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 2. 동기화 대상 사건 조회
    const minSyncTime = new Date();
    minSyncTime.setHours(minSyncTime.getHours() - SYNC_CONFIG.minHoursSinceLastSync);

    const { data: cases, error: casesError } = await getSupabase()
      .from('legal_cases')
      .select(`
        id,
        court_case_number,
        scourt_last_sync,
        scourt_profile_cases:scourt_profile_cases!inner(
          id,
          profile_id
        )
      `)
      .eq('status', '진행중')
      .or(`scourt_last_sync.is.null,scourt_last_sync.lt.${minSyncTime.toISOString()}`)
      .limit(SYNC_CONFIG.maxCasesPerRun);

    if (casesError) {
      console.error('[SCOURT Batch Sync] 사건 조회 실패:', casesError);
      return NextResponse.json(
        { error: '사건 조회 실패', details: casesError.message },
        { status: 500 }
      );
    }

    if (!cases || cases.length === 0) {
      return NextResponse.json({
        success: true,
        message: '동기화 대상 사건 없음',
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
      });
    }

    // 유효한 사건번호만 필터링
    const validCases: CaseToSync[] = cases
      .filter((c) => c.court_case_number)
      .map((c) => ({
        id: c.id,
        court_case_number: c.court_case_number,
      }));

    console.log(`[SCOURT Batch Sync] 시작: ${validCases.length}건 (${useParallel ? '병렬' : '순차'} 모드)`);

    // 3. 동기화 실행
    const results = useParallel
      ? await parallelBatchSync(validCases)
      : await sequentialBatchSync(validCases);

    // 4. 결과 집계
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const totalUpdates = results.reduce((sum, r) => sum + (r.updateCount || 0), 0);

    // 5. 동기화 로그 저장
    try {
      await getSupabase().from('scourt_sync_logs').insert({
        action: 'batch_sync',
        status: failedCount === 0 ? 'success' : 'partial',
        cases_synced: successCount,
        cases_failed: failedCount,
        duration_ms: Date.now() - startTime,
        details: {
          totalCases: validCases.length,
          mode: useParallel ? 'parallel' : 'sequential',
          totalUpdates,
          results: results.slice(0, 10), // 최대 10개만 저장
        },
      });
    } catch (logError) {
      console.error('[SCOURT Batch Sync] 로그 저장 실패:', logError);
    }

    const durationMs = Date.now() - startTime;
    const avgTimePerCase = durationMs / validCases.length;

    console.log(
      `[SCOURT Batch Sync] 완료: 성공 ${successCount}건, 실패 ${failedCount}건, ` +
      `소요시간 ${durationMs}ms (평균 ${avgTimePerCase.toFixed(0)}ms/건)`
    );

    return NextResponse.json({
      success: true,
      message: '배치 동기화 완료',
      mode: useParallel ? 'parallel' : 'sequential',
      totalCount: validCases.length,
      successCount,
      failedCount,
      totalUpdates,
      durationMs,
      avgTimePerCase: Math.round(avgTimePerCase),
      results: results.slice(0, 20), // 최대 20개만 응답
    });

  } catch (error) {
    console.error('[SCOURT Batch Sync] 예외 발생:', error);
    return NextResponse.json(
      {
        error: '배치 동기화 실패',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
