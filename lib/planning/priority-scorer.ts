/**
 * 사건 우선순위 점수 계산기
 *
 * 긴급도, 중요도, 리스크를 종합하여 사건별 우선순위 점수를 계산합니다.
 *
 * 점수 구성:
 * - 긴급도 (Urgency): 40% - 기한/기일 임박 여부
 * - 중요도 (Importance): 30% - 사건 규모, VIP 여부
 * - 리스크 (Risk): 30% - 잠재적 문제 요소
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  HEARING_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  type HearingType,
  type DeadlineType,
} from '@/types/court-hearing';
import type {
  CasePriority,
  ScoreDetail,
  RiskFlag,
  RecommendedAction,
  CaseData,
  PriorityListRequest,
} from './types';

// =====================================================
// 메인 클래스
// =====================================================

export class PriorityScorer {
  /**
   * 모든 사건의 우선순위 목록 조회
   */
  async getPriorityList(options: PriorityListRequest = {}): Promise<CasePriority[]> {
    const { tenantId, limit = 20, minGrade } = options;

    // 1. 사건 목록 조회
    const cases = await this.loadAllCases(tenantId);

    // 2. 각 사건별 우선순위 계산
    const priorities: CasePriority[] = [];

    for (const caseData of cases) {
      const priority = await this.calculate(caseData);
      priorities.push(priority);
    }

    // 3. 점수 순 정렬
    priorities.sort((a, b) => b.score - a.score);

    // 4. 최소 등급 필터
    let filtered = priorities;
    if (minGrade) {
      const gradeOrder = { A: 4, B: 3, C: 2, D: 1 };
      const minOrder = gradeOrder[minGrade];
      filtered = priorities.filter((p) => gradeOrder[p.grade] >= minOrder);
    }

    // 5. 개수 제한
    return filtered.slice(0, limit);
  }

  /**
   * 단일 사건 우선순위 계산
   */
  async calculateForCase(caseId: string): Promise<CasePriority> {
    const caseData = await this.loadCaseData(caseId);
    return this.calculate(caseData);
  }

  /**
   * 우선순위 계산 (내부)
   */
  private async calculate(caseData: CaseData): Promise<CasePriority> {
    // 1. 긴급도 계산
    const urgency = this.calculateUrgency(caseData);

    // 2. 중요도 계산
    const importance = this.calculateImportance(caseData);

    // 3. 리스크 계산
    const risk = this.calculateRisk(caseData);

    // 4. 종합 점수 계산 (가중 평균)
    const score =
      urgency.score * urgency.weight +
      importance.score * importance.weight +
      risk.score * risk.weight;

    // 5. 등급 결정
    const grade = this.determineGrade(score);

    // 6. 리스크 플래그 생성
    const riskFlags = this.generateRiskFlags(caseData, urgency, risk);

    // 7. 추천 작업 생성
    const recommendedActions = this.generateRecommendations(caseData, riskFlags);

    // 8. 다음 기한/기일 찾기
    const nextDeadline = this.getNextDeadline(caseData);
    const nextHearing = this.getNextHearing(caseData);

    return {
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      caseName: caseData.caseName,
      clientName: caseData.clientName,
      score: Math.round(score),
      grade,
      breakdown: { urgency, importance, risk },
      riskFlags,
      nextDeadline,
      nextHearing,
      recommendedActions,
    };
  }

  // =====================================================
  // 점수 계산 함수
  // =====================================================

  /**
   * 긴급도 계산 (40%)
   */
  private calculateUrgency(caseData: CaseData): ScoreDetail {
    const factors: string[] = [];
    let score = 0;

    // 가장 가까운 데드라인
    const nextDeadline = caseData.pendingDeadlines[0];
    if (nextDeadline) {
      const days = nextDeadline.daysUntil;

      if (days < 0) {
        score = 100;
        factors.push(`기한 초과 (${nextDeadline.deadlineTypeName})`);
      } else if (days === 0) {
        score = 100;
        factors.push(`오늘 기한 (${nextDeadline.deadlineTypeName})`);
      } else if (days <= 1) {
        score = 95;
        factors.push(`내일 기한 (${nextDeadline.deadlineTypeName})`);
      } else if (days <= 3) {
        score = 85;
        factors.push(`3일 내 기한 (D-${days}, ${nextDeadline.deadlineTypeName})`);
      } else if (days <= 7) {
        score = 70;
        factors.push(`1주일 내 기한 (D-${days})`);
      } else if (days <= 14) {
        score = 50;
        factors.push(`2주일 내 기한 (D-${days})`);
      } else if (days <= 30) {
        score = 30;
        factors.push(`1개월 내 기한 (D-${days})`);
      } else {
        score = 10;
        factors.push(`기한 여유 있음 (D-${days})`);
      }
    }

    // 가장 가까운 기일
    const nextHearing = caseData.upcomingHearings[0];
    if (nextHearing) {
      const days = nextHearing.daysUntil;
      let hearingScore = 0;

      if (days <= 1) {
        hearingScore = 90;
        factors.push(`오늘/내일 기일 (${nextHearing.hearingTypeName})`);
      } else if (days <= 3) {
        hearingScore = 75;
        factors.push(`3일 내 기일 (${nextHearing.hearingTypeName})`);
      } else if (days <= 7) {
        hearingScore = 55;
        factors.push(`1주일 내 기일`);
      } else if (days <= 14) {
        hearingScore = 35;
        factors.push(`2주일 내 기일`);
      }

      // 기한과 기일 중 높은 점수 사용
      score = Math.max(score, hearingScore);
    }

    // 여러 개의 긴급 데드라인이 있으면 추가 점수
    const urgentDeadlines = caseData.pendingDeadlines.filter((d) => d.daysUntil <= 7);
    if (urgentDeadlines.length >= 2) {
      score = Math.min(score + 10, 100);
      factors.push(`긴급 데드라인 ${urgentDeadlines.length}개`);
    }

    // 기한/기일이 없으면 낮은 점수
    if (!nextDeadline && !nextHearing) {
      score = 5;
      factors.push('예정된 기한/기일 없음');
    }

    return {
      score,
      weight: 0.4, // 40%
      factors,
    };
  }

  /**
   * 중요도 계산 (30%)
   */
  private calculateImportance(caseData: CaseData): ScoreDetail {
    const factors: string[] = [];
    let score = 50; // 기본 점수

    // 결제 금액 기준
    if (caseData.paymentInfo) {
      const total = caseData.paymentInfo.totalAmount;
      if (total >= 50_000_000) {
        // 5천만원 이상
        score += 30;
        factors.push(`고액 사건 (${this.formatAmount(total)})`);
      } else if (total >= 20_000_000) {
        // 2천만원 이상
        score += 20;
        factors.push(`중액 사건 (${this.formatAmount(total)})`);
      } else if (total >= 5_000_000) {
        // 5백만원 이상
        score += 10;
        factors.push(`일반 사건 (${this.formatAmount(total)})`);
      }
    }

    // 사건 유형에 따른 중요도
    if (caseData.caseType) {
      // 이혼 사건 분류
      if (caseData.caseType.includes('합의')) {
        score += 5;
        factors.push('합의이혼');
      } else if (caseData.caseType.includes('재판')) {
        score += 15;
        factors.push('재판이혼');
      }

      // 부대 사건
      if (caseData.caseType.includes('양육권') || caseData.caseType.includes('친권')) {
        score += 10;
        factors.push('양육권/친권 분쟁 포함');
      }
      if (caseData.caseType.includes('재산분할')) {
        score += 10;
        factors.push('재산분할 포함');
      }
    }

    // 진행 중인 사건은 중요도 높음
    if (caseData.status === '진행중' || caseData.status === 'active') {
      score += 5;
      factors.push('진행 중인 사건');
    }

    return {
      score: Math.min(score, 100),
      weight: 0.3, // 30%
      factors,
    };
  }

  /**
   * 리스크 계산 (30%)
   */
  private calculateRisk(caseData: CaseData): ScoreDetail {
    const factors: string[] = [];
    let score = 0;

    // 기한 초과 데드라인
    const overdueDeadlines = caseData.pendingDeadlines.filter((d) => d.daysUntil < 0);
    if (overdueDeadlines.length > 0) {
      score += 40;
      factors.push(`기한 초과 ${overdueDeadlines.length}건`);
    }

    // 미납 결제
    if (caseData.paymentInfo && caseData.paymentInfo.pendingAmount > 0) {
      const pendingRate =
        caseData.paymentInfo.pendingAmount / caseData.paymentInfo.totalAmount;
      if (pendingRate > 0.5) {
        score += 30;
        factors.push(
          `미납 금액 ${this.formatAmount(caseData.paymentInfo.pendingAmount)} (50% 이상)`
        );
      } else if (pendingRate > 0.2) {
        score += 15;
        factors.push(
          `미납 금액 ${this.formatAmount(caseData.paymentInfo.pendingAmount)}`
        );
      }
    }

    // 오래된 활동 (30일 이상 활동 없음)
    if (caseData.lastActivityDate) {
      const daysSinceActivity = this.daysBetween(
        new Date(caseData.lastActivityDate),
        new Date()
      );
      if (daysSinceActivity > 60) {
        score += 25;
        factors.push(`장기 미활동 (${daysSinceActivity}일)`);
      } else if (daysSinceActivity > 30) {
        score += 15;
        factors.push(`활동 지연 (${daysSinceActivity}일)`);
      }
    }

    // 기일 연기 이력 (추후 구현)
    // 상대방 서면 미대응 (추후 구현)

    return {
      score: Math.min(score, 100),
      weight: 0.3, // 30%
      factors,
    };
  }

  // =====================================================
  // 리스크 플래그 및 추천 작업
  // =====================================================

  /**
   * 리스크 플래그 생성
   */
  private generateRiskFlags(
    caseData: CaseData,
    _urgency: ScoreDetail,
    _risk: ScoreDetail
  ): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // 기한 관련 플래그
    const nextDeadline = caseData.pendingDeadlines[0];
    if (nextDeadline) {
      if (nextDeadline.daysUntil < 0) {
        flags.push({
          id: `deadline-overdue-${nextDeadline.id}`,
          type: 'deadline',
          severity: 'critical',
          title: '기한 초과',
          description: `${nextDeadline.deadlineTypeName}이(가) ${Math.abs(nextDeadline.daysUntil)}일 초과되었습니다`,
          suggestion: '즉시 확인 및 대응이 필요합니다',
        });
      } else if (nextDeadline.daysUntil <= 3) {
        flags.push({
          id: `deadline-imminent-${nextDeadline.id}`,
          type: 'deadline',
          severity: nextDeadline.daysUntil <= 1 ? 'critical' : 'high',
          title: '기한 임박',
          description: `${nextDeadline.deadlineTypeName}이(가) ${nextDeadline.daysUntil}일 후입니다`,
          suggestion: '즉시 준비 작업을 시작하세요',
        });
      }
    }

    // 기일 관련 플래그
    const nextHearing = caseData.upcomingHearings[0];
    if (nextHearing && nextHearing.daysUntil <= 3) {
      flags.push({
        id: `hearing-imminent-${nextHearing.id}`,
        type: 'hearing',
        severity: nextHearing.daysUntil <= 1 ? 'critical' : 'high',
        title: '기일 임박',
        description: `${nextHearing.hearingTypeName}이(가) ${nextHearing.daysUntil}일 후입니다`,
        suggestion: '기일 준비 상태를 확인하세요',
      });
    }

    // 결제 관련 플래그
    if (caseData.paymentInfo && caseData.paymentInfo.pendingAmount > 0) {
      const pendingRate =
        caseData.paymentInfo.pendingAmount / caseData.paymentInfo.totalAmount;
      if (pendingRate > 0.3) {
        flags.push({
          id: `payment-pending-${caseData.id}`,
          type: 'payment',
          severity: pendingRate > 0.5 ? 'high' : 'medium',
          title: '미납 금액 존재',
          description: `미납금 ${this.formatAmount(caseData.paymentInfo.pendingAmount)}`,
          suggestion: '의뢰인에게 결제 안내가 필요합니다',
        });
      }
    }

    return flags;
  }

  /**
   * 추천 작업 생성
   */
  private generateRecommendations(
    caseData: CaseData,
    riskFlags: RiskFlag[]
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // 기한 기반 추천
    for (const deadline of caseData.pendingDeadlines.slice(0, 3)) {
      if (deadline.daysUntil <= 7 && deadline.status === 'PENDING') {
        actions.push({
          id: `action-deadline-${deadline.id}`,
          type: 'deadline_completion',
          title: `${deadline.deadlineTypeName} 준비`,
          description: `D-${deadline.daysUntil} | ${deadline.deadlineDate}까지`,
          priority: this.getPriorityByDays(deadline.daysUntil),
          deadline: deadline.deadlineDate,
          relatedDeadlineId: deadline.id,
          caseId: caseData.id,
          caseNumber: caseData.caseNumber,
          aiAssist: {
            available: true,
            type: 'draft',
            description: '서면 작성 지원',
          },
          status: 'suggested',
        });
      }
    }

    // 기일 기반 추천
    for (const hearing of caseData.upcomingHearings.slice(0, 2)) {
      if (hearing.daysUntil <= 7 && hearing.status === 'SCHEDULED') {
        actions.push({
          id: `action-hearing-${hearing.id}`,
          type: 'prepare_hearing',
          title: `${hearing.hearingTypeName} 준비`,
          description: `D-${hearing.daysUntil} | ${hearing.location || '장소 미정'}`,
          priority: this.getPriorityByDays(hearing.daysUntil),
          deadline: hearing.hearingDate,
          relatedHearingId: hearing.id,
          caseId: caseData.id,
          caseNumber: caseData.caseNumber,
          aiAssist: {
            available: true,
            type: 'generate',
            description: '기일 준비 체크리스트 생성',
          },
          status: 'suggested',
        });
      }
    }

    // 리스크 플래그 기반 추천
    for (const flag of riskFlags) {
      if (flag.type === 'payment' && flag.severity !== 'low') {
        actions.push({
          id: `action-payment-${caseData.id}`,
          type: 'payment_followup',
          title: '미납금 안내',
          description: flag.description,
          priority: flag.severity === 'high' ? 'high' : 'medium',
          caseId: caseData.id,
          caseNumber: caseData.caseNumber,
          aiAssist: {
            available: true,
            type: 'communication',
            description: '결제 안내 메시지 생성',
          },
          status: 'suggested',
        });
      }
    }

    // 우선순위 정렬
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    actions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return actions.slice(0, 5);
  }

  // =====================================================
  // 데이터 로드 함수
  // =====================================================

  /**
   * 모든 사건 데이터 로드
   */
  private async loadAllCases(tenantId?: string): Promise<CaseData[]> {
    const supabase = createAdminClient();

    // 사건 목록 조회
    let casesQuery = supabase
      .from('legal_cases')
      .select(
        `
        id,
        case_name,
        case_type,
        court_case_number,
        status,
        client_id,
        contract_date,
        clients (
          name
        )
      `
      )
      .in('status', ['진행중', 'active', '진행', null])
      .order('created_at', { ascending: false });

    if (tenantId) {
      casesQuery = casesQuery.eq('tenant_id', tenantId);
    }

    const { data: cases, error: casesError } = await casesQuery;

    if (casesError) {
      console.error('Error loading cases:', casesError);
      return [];
    }

    // 각 사건별 데이터 구성
    const result: CaseData[] = [];

    for (const c of cases || []) {
      const caseNumber = c.court_case_number || c.id;

      // 기일 조회
      const { data: hearings } = await supabase
        .from('court_hearings')
        .select('*')
        .eq('case_number', caseNumber)
        .eq('status', 'SCHEDULED')
        .gte('hearing_date', new Date().toISOString())
        .order('hearing_date', { ascending: true })
        .limit(5);

      // 데드라인 조회
      const { data: deadlines } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('case_number', caseNumber)
        .eq('status', 'PENDING')
        .order('deadline_date', { ascending: true })
        .limit(5);

      // 결제 정보 조회
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, status')
        .eq('case_id', c.id);

      const totalAmount = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const paidAmount =
        payments
          ?.filter((p) => p.status === 'completed' || p.status === '입금완료')
          .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // 클라이언트 이름 추출
      const clientData = Array.isArray(c.clients) ? c.clients[0] : c.clients;

      result.push({
        id: c.id,
        caseNumber,
        caseName: c.case_name || caseNumber,
        caseType: c.case_type,
        status: c.status,
        clientId: c.client_id,
        clientName: clientData?.name,
        contractDate: c.contract_date,
        upcomingHearings: (hearings || []).map((h) => ({
          id: h.id,
          hearingType: h.hearing_type,
          hearingTypeName:
            HEARING_TYPE_LABELS[h.hearing_type as HearingType] || h.hearing_type,
          hearingDate: h.hearing_date,
          daysUntil: this.daysBetween(new Date(), new Date(h.hearing_date)),
          location: h.location,
          status: h.status,
        })),
        pendingDeadlines: (deadlines || []).map((d) => ({
          id: d.id,
          deadlineType: d.deadline_type,
          deadlineTypeName:
            DEADLINE_TYPE_LABELS[d.deadline_type as DeadlineType] || d.deadline_type,
          triggerDate: d.trigger_date,
          deadlineDate: d.deadline_date,
          daysUntil: this.daysBetween(new Date(), new Date(d.deadline_date)),
          status: d.status,
        })),
        paymentInfo: {
          totalAmount,
          paidAmount,
          pendingAmount: totalAmount - paidAmount,
        },
      });
    }

    return result;
  }

  /**
   * 단일 사건 데이터 로드
   */
  private async loadCaseData(caseId: string): Promise<CaseData> {
    const supabase = createAdminClient();

    // 사건 조회
    const { data: caseInfo } = await supabase
      .from('legal_cases')
      .select(
        `
        id,
        case_name,
        case_type,
        court_case_number,
        status,
        client_id,
        contract_date,
        clients (
          name
        )
      `
      )
      .eq('id', caseId)
      .single();

    if (!caseInfo) {
      throw new Error(`사건을 찾을 수 없습니다: ${caseId}`);
    }

    const caseNumber = caseInfo.court_case_number || caseInfo.id;

    // 기일 조회
    const { data: hearings } = await supabase
      .from('court_hearings')
      .select('*')
      .eq('case_number', caseNumber)
      .eq('status', 'SCHEDULED')
      .gte('hearing_date', new Date().toISOString())
      .order('hearing_date', { ascending: true })
      .limit(5);

    // 데드라인 조회
    const { data: deadlines } = await supabase
      .from('case_deadlines')
      .select('*')
      .eq('case_number', caseNumber)
      .eq('status', 'PENDING')
      .order('deadline_date', { ascending: true })
      .limit(5);

    // 결제 정보 조회
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('case_id', caseId);

    const totalAmount = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const paidAmount =
      payments
        ?.filter((p) => p.status === 'completed' || p.status === '입금완료')
        .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // 클라이언트 이름 추출
    const clientData = Array.isArray(caseInfo.clients)
      ? caseInfo.clients[0]
      : caseInfo.clients;

    return {
      id: caseInfo.id,
      caseNumber,
      caseName: caseInfo.case_name || caseNumber,
      caseType: caseInfo.case_type,
      status: caseInfo.status,
      clientId: caseInfo.client_id,
      clientName: clientData?.name,
      contractDate: caseInfo.contract_date,
      upcomingHearings: (hearings || []).map((h) => ({
        id: h.id,
        hearingType: h.hearing_type,
        hearingTypeName:
          HEARING_TYPE_LABELS[h.hearing_type as HearingType] || h.hearing_type,
        hearingDate: h.hearing_date,
        daysUntil: this.daysBetween(new Date(), new Date(h.hearing_date)),
        location: h.location,
        status: h.status,
      })),
      pendingDeadlines: (deadlines || []).map((d) => ({
        id: d.id,
        deadlineType: d.deadline_type,
        deadlineTypeName:
          DEADLINE_TYPE_LABELS[d.deadline_type as DeadlineType] || d.deadline_type,
        triggerDate: d.trigger_date,
        deadlineDate: d.deadline_date,
        daysUntil: this.daysBetween(new Date(), new Date(d.deadline_date)),
        status: d.status,
      })),
      paymentInfo: {
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
      },
    };
  }

  // =====================================================
  // 유틸리티 함수
  // =====================================================

  private getNextDeadline(caseData: CaseData) {
    const next = caseData.pendingDeadlines[0];
    if (!next) return undefined;

    return {
      id: next.id,
      date: next.deadlineDate,
      type: next.deadlineType,
      typeName: next.deadlineTypeName,
      daysRemaining: next.daysUntil,
    };
  }

  private getNextHearing(caseData: CaseData) {
    const next = caseData.upcomingHearings[0];
    if (!next) return undefined;

    return {
      id: next.id,
      date: next.hearingDate,
      type: next.hearingType,
      typeName: next.hearingTypeName,
      daysRemaining: next.daysUntil,
      location: next.location,
    };
  }

  private determineGrade(score: number): 'A' | 'B' | 'C' | 'D' {
    if (score >= 70) return 'A'; // 긴급
    if (score >= 50) return 'B'; // 높음
    if (score >= 30) return 'C'; // 보통
    return 'D'; // 낮음
  }

  private getPriorityByDays(
    days: number
  ): 'urgent' | 'high' | 'medium' | 'low' {
    if (days <= 1) return 'urgent';
    if (days <= 3) return 'high';
    if (days <= 7) return 'medium';
    return 'low';
  }

  private daysBetween(date1: Date, date2: Date): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private formatAmount(amount: number): string {
    if (amount >= 100_000_000) {
      return `${(amount / 100_000_000).toFixed(1)}억원`;
    }
    if (amount >= 10_000_000) {
      return `${(amount / 10_000_000).toFixed(0)}천만원`;
    }
    if (amount >= 10_000) {
      return `${(amount / 10_000).toFixed(0)}만원`;
    }
    return `${amount.toLocaleString()}원`;
  }
}

// 싱글톤 인스턴스
let priorityScorerInstance: PriorityScorer | null = null;

export function getPriorityScorer(): PriorityScorer {
  if (!priorityScorerInstance) {
    priorityScorerInstance = new PriorityScorer();
  }
  return priorityScorerInstance;
}
