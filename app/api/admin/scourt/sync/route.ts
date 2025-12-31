/**
 * 대법원 사건 동기화 API
 *
 * POST /api/admin/scourt/sync
 * - 저장된 사건 상세 조회 → 스냅샷 저장 → 변경 감지
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getScourtSessionManager, ProfileConfig } from '@/lib/scourt/session-manager';
import { getUnifiedScraper } from '@/lib/scourt/unified-scraper';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { legalCaseId, caseNumber, forceRefresh = false } = body;

    if (!legalCaseId || !caseNumber) {
      return NextResponse.json(
        { error: '필수 파라미터 누락: legalCaseId, caseNumber' },
        { status: 400 }
      );
    }

    // 1. 사건 정보 조회
    const { data: legalCase, error: caseError } = await supabase
      .from('legal_cases')
      .select('*, scourt_last_sync, scourt_last_snapshot_id')
      .eq('id', legalCaseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json(
        { error: '사건을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 최근 동기화 확인 (5분 이내면 스킵, forceRefresh가 아닌 경우)
    if (!forceRefresh && legalCase.scourt_last_sync) {
      const lastSync = new Date(legalCase.scourt_last_sync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / 1000 / 60;

      if (diffMinutes < 5) {
        return NextResponse.json({
          success: true,
          message: '최근 동기화됨',
          lastSync: legalCase.scourt_last_sync,
          skipped: true,
        });
      }
    }

    // 3. 프로필에서 저장된 사건 확인
    const { data: profileCase } = await supabase
      .from('scourt_profile_cases')
      .select('*, profile:scourt_profiles(*)')
      .eq('case_number', caseNumber)
      .limit(1)
      .single();

    if (!profileCase || !profileCase.profile) {
      return NextResponse.json(
        { error: '저장된 사건을 찾을 수 없습니다. 먼저 사건 검색이 필요합니다.' },
        { status: 404 }
      );
    }

    // 4. 세션 매니저로 상세 조회
    const sessionManager = getScourtSessionManager();
    const profile: ProfileConfig = {
      id: profileCase.profile.id,
      lawyerId: profileCase.profile.lawyer_id,
      profileName: profileCase.profile.profile_name,
      userDataDir: path.join(process.cwd(), 'data', 'scourt-profiles', profileCase.profile.profile_name),
      caseCount: profileCase.profile.case_count,
      maxCases: profileCase.profile.max_cases,
      status: profileCase.profile.status,
    };

    // 5. 저장된 사건 클릭하여 상세 조회 (페이지 반환 요청)
    const detailResult = await sessionManager.getCaseDetail(profile, caseNumber, true);

    if (!detailResult.success || !detailResult.page) {
      return NextResponse.json(
        { error: detailResult.error || '상세 조회 실패' },
        { status: 500 }
      );
    }

    // 6. 통합 스크래퍼로 데이터 추출 및 동기화
    const scraper = getUnifiedScraper();
    const scrapedData = await scraper.scrapeDetailPage(detailResult.page);

    const syncResult = await scraper.syncCase(
      legalCaseId,
      profile.id,
      scrapedData
    );

    if (!syncResult.success) {
      return NextResponse.json(
        { error: syncResult.error || '동기화 실패' },
        { status: 500 }
      );
    }

    // 7. 응답
    return NextResponse.json({
      success: true,
      caseNumber: scrapedData.caseNumber,
      caseName: scrapedData.caseName,
      caseType: scrapedData.caseType,
      isFirstSync: syncResult.isFirstSync,
      updates: syncResult.updates.map((u) => ({
        type: u.updateType,
        summary: u.updateSummary,
        importance: u.importance,
      })),
      updateCount: syncResult.updates.length,
      snapshotId: syncResult.snapshot?.id,
      nextHearing: scrapedData.hearings.find((h) => !h.result),
    });

  } catch (error) {
    console.error('동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '동기화 실패' },
      { status: 500 }
    );
  }
}

/**
 * 배치 동기화 (여러 사건)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseIds } = body;

    if (!caseIds || !Array.isArray(caseIds) || caseIds.length === 0) {
      return NextResponse.json(
        { error: 'caseIds 배열이 필요합니다' },
        { status: 400 }
      );
    }

    // 사건 목록 조회
    const { data: cases, error } = await supabase
      .from('legal_cases')
      .select('id, case_number')
      .in('id', caseIds);

    if (error || !cases) {
      return NextResponse.json(
        { error: '사건 조회 실패' },
        { status: 500 }
      );
    }

    // 순차 동기화 (너무 빠르면 차단될 수 있음)
    const results = [];
    for (const c of cases) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/scourt/sync`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              legalCaseId: c.id,
              caseNumber: c.case_number,
            }),
          }
        );
        const result = await response.json();
        results.push({ caseId: c.id, ...result });

        // 요청 간격 (2초)
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        results.push({
          caseId: c.id,
          success: false,
          error: err instanceof Error ? err.message : '동기화 실패',
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalCount: cases.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('배치 동기화 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '배치 동기화 실패' },
      { status: 500 }
    );
  }
}
