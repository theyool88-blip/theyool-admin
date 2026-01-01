/**
 * 작업 추천 시스템
 *
 * 전체 테넌트 또는 특정 사건에 대한 다음 작업을 추천합니다.
 * PriorityScorer와 연동하여 긴급한 작업부터 표시합니다.
 */

import { getPriorityScorer } from './priority-scorer';
import type {
  RecommendedAction,
  ActionType,
  TaskRecommendationRequest,
  CasePriority,
} from './types';

export class TaskRecommender {
  private priorityScorer = getPriorityScorer();

  /**
   * 전체 작업 추천 목록
   * 모든 사건의 추천 작업을 통합하여 우선순위 순으로 반환
   */
  async getRecommendations(
    options: TaskRecommendationRequest = {}
  ): Promise<RecommendedAction[]> {
    const { tenantId, limit = 10, types } = options;

    // 1. 우선순위 높은 사건 목록 조회
    const priorities = await this.priorityScorer.getPriorityList({
      tenantId,
      limit: 30, // 더 많은 사건에서 추천 추출
    });

    // 2. 모든 추천 작업 수집
    let allActions: RecommendedAction[] = [];

    for (const priority of priorities) {
      // 사건 정보 추가
      const actionsWithCase = priority.recommendedActions.map((action) => ({
        ...action,
        caseId: priority.caseId,
        caseNumber: priority.caseNumber,
      }));
      allActions.push(...actionsWithCase);
    }

    // 3. 타입 필터링
    if (types && types.length > 0) {
      allActions = allActions.filter((a) => types.includes(a.type));
    }

    // 4. 중복 제거 (같은 사건의 같은 타입 작업)
    const uniqueActions = this.deduplicateActions(allActions);

    // 5. 우선순위 정렬
    const sorted = this.sortByPriority(uniqueActions);

    // 6. 개수 제한
    return sorted.slice(0, limit);
  }

  /**
   * 특정 사건의 작업 추천
   */
  async getRecommendationsForCase(
    caseId: string,
    options: { limit?: number; types?: ActionType[] } = {}
  ): Promise<RecommendedAction[]> {
    const { limit = 5, types } = options;

    // 1. 사건 우선순위 계산
    const priority = await this.priorityScorer.calculateForCase(caseId);

    // 2. 추천 작업 추출
    let actions = priority.recommendedActions;

    // 3. 타입 필터링
    if (types && types.length > 0) {
      actions = actions.filter((a) => types.includes(a.type));
    }

    // 4. 개수 제한
    return actions.slice(0, limit);
  }

  /**
   * 오늘의 작업 목록
   * 오늘 또는 내일 기한인 작업만 반환
   */
  async getTodayTasks(tenantId?: string): Promise<RecommendedAction[]> {
    const allActions = await this.getRecommendations({
      tenantId,
      limit: 50,
    });

    // urgent 또는 high 우선순위만 필터
    return allActions.filter(
      (a) => a.priority === 'urgent' || a.priority === 'high'
    );
  }

  /**
   * 타입별 작업 통계
   */
  async getTaskStats(tenantId?: string): Promise<Record<ActionType, number>> {
    const allActions = await this.getRecommendations({
      tenantId,
      limit: 100,
    });

    const stats: Record<ActionType, number> = {
      draft_brief: 0,
      review_document: 0,
      gather_evidence: 0,
      client_communication: 0,
      prepare_hearing: 0,
      file_submission: 0,
      deadline_completion: 0,
      payment_followup: 0,
    };

    for (const action of allActions) {
      if (action.type in stats) {
        stats[action.type]++;
      }
    }

    return stats;
  }

  /**
   * 대시보드용 요약 데이터
   */
  async getDashboardSummary(tenantId?: string): Promise<DashboardSummary> {
    // 1. 우선순위 목록
    const priorities = await this.priorityScorer.getPriorityList({
      tenantId,
      limit: 20,
    });

    // 2. 등급별 집계
    const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
    for (const p of priorities) {
      gradeCounts[p.grade]++;
    }

    // 3. 오늘의 작업
    const todayTasks = await this.getTodayTasks(tenantId);

    // 4. 리스크 플래그 집계
    const allRiskFlags = priorities.flatMap((p) => p.riskFlags);
    const criticalFlags = allRiskFlags.filter((f) => f.severity === 'critical');
    const highFlags = allRiskFlags.filter((f) => f.severity === 'high');

    // 5. 다가오는 기한/기일
    const upcomingDeadlines = priorities
      .filter((p) => p.nextDeadline && p.nextDeadline.daysRemaining <= 7)
      .map((p) => ({
        caseNumber: p.caseNumber,
        caseName: p.caseName,
        ...p.nextDeadline!,
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    const upcomingHearings = priorities
      .filter((p) => p.nextHearing && p.nextHearing.daysRemaining <= 7)
      .map((p) => ({
        caseNumber: p.caseNumber,
        caseName: p.caseName,
        ...p.nextHearing!,
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    return {
      totalCases: priorities.length,
      gradeCounts,
      todayTaskCount: todayTasks.length,
      criticalFlagCount: criticalFlags.length,
      highFlagCount: highFlags.length,
      topPriorities: priorities.slice(0, 5),
      todayTasks: todayTasks.slice(0, 5),
      upcomingDeadlines,
      upcomingHearings,
    };
  }

  // =====================================================
  // 유틸리티 함수
  // =====================================================

  /**
   * 중복 제거
   */
  private deduplicateActions(actions: RecommendedAction[]): RecommendedAction[] {
    const seen = new Set<string>();
    const result: RecommendedAction[] = [];

    for (const action of actions) {
      const key = `${action.caseId}-${action.type}-${action.relatedDeadlineId || action.relatedHearingId || 'general'}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(action);
      }
    }

    return result;
  }

  /**
   * 우선순위 정렬
   */
  private sortByPriority(actions: RecommendedAction[]): RecommendedAction[] {
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...actions].sort((a, b) => {
      // 1. 우선순위 순
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 2. 기한 순 (기한이 있는 경우)
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;

      return 0;
    });
  }
}

// =====================================================
// 대시보드 요약 타입
// =====================================================

export interface DashboardSummary {
  totalCases: number;
  gradeCounts: Record<'A' | 'B' | 'C' | 'D', number>;
  todayTaskCount: number;
  criticalFlagCount: number;
  highFlagCount: number;
  topPriorities: CasePriority[];
  todayTasks: RecommendedAction[];
  upcomingDeadlines: Array<{
    caseNumber: string;
    caseName: string;
    id: string;
    date: string;
    type: string;
    typeName: string;
    daysRemaining: number;
  }>;
  upcomingHearings: Array<{
    caseNumber: string;
    caseName: string;
    id: string;
    date: string;
    type: string;
    typeName: string;
    daysRemaining: number;
    location?: string;
  }>;
}

// 싱글톤 인스턴스
let taskRecommenderInstance: TaskRecommender | null = null;

export function getTaskRecommender(): TaskRecommender {
  if (!taskRecommenderInstance) {
    taskRecommenderInstance = new TaskRecommender();
  }
  return taskRecommenderInstance;
}
