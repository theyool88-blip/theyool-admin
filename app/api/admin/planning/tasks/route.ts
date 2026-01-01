/**
 * Task Recommendations API
 *
 * GET /api/admin/planning/tasks - 추천 작업 목록
 * GET /api/admin/planning/tasks?today=true - 오늘의 작업
 * GET /api/admin/planning/tasks?caseId=xxx - 특정 사건 작업
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { getTaskRecommender } from '@/lib/planning/task-recommender';
import type { ActionType } from '@/lib/planning/types';

export const GET = withTenant(async (request: NextRequest, { tenant }) => {
  try {
    const { searchParams } = new URL(request.url);
    const today = searchParams.get('today') === 'true';
    const caseId = searchParams.get('caseId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const typesParam = searchParams.get('types');

    const tenantId = tenant.isSuperAdmin ? undefined : tenant.tenantId;
    const recommender = getTaskRecommender();

    // 작업 유형 필터
    const types: ActionType[] | undefined = typesParam
      ? (typesParam.split(',') as ActionType[])
      : undefined;

    // 오늘의 작업 요청
    if (today) {
      const tasks = await recommender.getTodayTasks(tenantId);
      return NextResponse.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    }

    // 특정 사건 작업 요청
    if (caseId) {
      const tasks = await recommender.getRecommendationsForCase(caseId, {
        limit,
        types,
      });
      return NextResponse.json({
        success: true,
        data: tasks,
        count: tasks.length,
      });
    }

    // 전체 작업 목록 요청
    const tasks = await recommender.getRecommendations({
      tenantId,
      limit,
      types,
    });

    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('[Tasks API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
