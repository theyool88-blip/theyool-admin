/**
 * Planning API
 *
 * GET /api/admin/planning - 우선순위 목록 조회
 * GET /api/admin/planning?dashboard=true - 대시보드 요약
 * GET /api/admin/planning?caseId=xxx - 특정 사건 우선순위
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { getPriorityScorer } from '@/lib/planning/priority-scorer';
import { getTaskRecommender } from '@/lib/planning/task-recommender';

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);
    const dashboard = searchParams.get('dashboard') === 'true';
    const caseId = searchParams.get('caseId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const minGrade = searchParams.get('minGrade') as 'A' | 'B' | 'C' | 'D' | null;

    const tenantId = tenant.isSuperAdmin ? undefined : tenant.tenantId;

    // 대시보드 요약 요청
    if (dashboard) {
      const recommender = getTaskRecommender();
      const summary = await recommender.getDashboardSummary(tenantId);

      return NextResponse.json({
        success: true,
        data: summary,
      });
    }

    // 특정 사건 우선순위 요청
    if (caseId) {
      const scorer = getPriorityScorer();
      const priority = await scorer.calculateForCase(caseId);

      return NextResponse.json({
        success: true,
        data: priority,
      });
    }

    // 전체 우선순위 목록 요청
    const scorer = getPriorityScorer();
    const priorities = await scorer.getPriorityList({
      tenantId,
      limit,
      minGrade: minGrade || undefined,
    });

    return NextResponse.json({
      success: true,
      data: priorities,
      count: priorities.length,
    });
  } catch (error) {
    console.error('[Planning API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
