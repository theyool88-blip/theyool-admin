/**
 * 의뢰인 업데이트 메시지 생성기
 *
 * AI를 사용하여 의뢰인에게 보내는 메시지를 자동 생성합니다.
 * 기일 안내, 진행상황 보고, 결제 안내 등 다양한 유형을 지원합니다.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { isAIAvailable, getAIClient } from '@/lib/ai/simple-ai-client';
import {
  HEARING_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  type HearingType,
  type DeadlineType,
} from '@/types/court-hearing';
import type {
  ClientUpdate,
  UpdateType,
  MessageChannel,
  TemplateVariables,
  GenerateMessageRequest,
} from './types';
import { MESSAGE_TEMPLATES, SYSTEM_PROMPT } from './templates';

export class ClientUpdateGenerator {
  /**
   * 메시지 생성
   */
  async generate(request: GenerateMessageRequest): Promise<ClientUpdate> {
    const { caseId, type, channel = 'email', customContext } = request;

    // 1. 사건 및 의뢰인 정보 로드
    const caseData = await this.loadCaseData(caseId);
    const clientData = await this.loadClientData(caseData.clientId);

    // 2. 템플릿 변수 구성
    const variables = await this.buildVariables(caseId, type, customContext);

    // 3. 메시지 생성
    let subject = '';
    let body = '';

    if (isAIAvailable()) {
      // AI 사용 가능하면 AI로 생성
      const generated = await this.generateWithAI(type, channel, variables);
      subject = generated.subject;
      body = generated.body;
    } else {
      // AI 없으면 템플릿 기반 생성
      const generated = this.generateFromTemplate(type, channel, variables);
      subject = generated.subject;
      body = generated.body;
    }

    return {
      id: this.generateId(),
      caseId,
      clientId: caseData.clientId,
      clientName: clientData.name,
      caseNumber: caseData.caseNumber,
      type,
      subject,
      body,
      channel,
      status: 'draft',
      generatedAt: new Date().toISOString(),
      generatedBy: isAIAvailable() ? 'ai' : 'user',
    };
  }

  /**
   * 기일 안내 메시지 생성
   */
  async generateHearingReminder(
    caseId: string,
    hearingId: string,
    channel: MessageChannel = 'kakao'
  ): Promise<ClientUpdate> {
    // 기일 정보 로드
    const hearing = await this.loadHearing(hearingId);

    const customContext: Record<string, string> = {
      hearingDate: this.formatDate(hearing.hearing_date),
      hearingTime: this.formatTime(hearing.hearing_date),
      hearingType: hearing.hearing_type,
      hearingTypeName:
        HEARING_TYPE_LABELS[hearing.hearing_type as HearingType] ||
        hearing.hearing_type,
      courtName: hearing.location?.split(' ')[0] || '',
      courtRoom: hearing.location?.split(' ').slice(1).join(' ') || '',
      daysRemaining: String(this.daysUntil(hearing.hearing_date)),
    };

    return this.generate({
      caseId,
      type: 'hearing_reminder',
      channel,
      customContext,
    });
  }

  /**
   * 기한 안내 메시지 생성
   */
  async generateDeadlineReminder(
    caseId: string,
    deadlineId: string,
    channel: MessageChannel = 'kakao'
  ): Promise<ClientUpdate> {
    // 기한 정보 로드
    const deadline = await this.loadDeadline(deadlineId);

    const customContext: Record<string, string> = {
      deadlineDate: deadline.deadline_date,
      deadlineType: deadline.deadline_type,
      deadlineTypeName:
        DEADLINE_TYPE_LABELS[deadline.deadline_type as DeadlineType] ||
        deadline.deadline_type,
      daysRemaining: String(this.daysUntil(deadline.deadline_date)),
    };

    return this.generate({
      caseId,
      type: 'deadline_reminder',
      channel,
      customContext,
    });
  }

  /**
   * 결제 안내 메시지 생성
   */
  async generatePaymentReminder(
    caseId: string,
    channel: MessageChannel = 'kakao'
  ): Promise<ClientUpdate> {
    // 결제 정보 로드
    const paymentInfo = await this.loadPaymentInfo(caseId);

    const customContext = {
      totalAmount: String(paymentInfo.totalAmount),
      paidAmount: String(paymentInfo.paidAmount),
      pendingAmount: String(paymentInfo.pendingAmount),
    };

    return this.generate({
      caseId,
      type: 'payment_reminder',
      channel,
      customContext,
    });
  }

  /**
   * 진행상황 보고 메시지 생성
   */
  async generateProgressReport(
    caseId: string,
    channel: MessageChannel = 'email'
  ): Promise<ClientUpdate> {
    // 최근 활동 및 예정 일정 로드
    const activities = await this.loadRecentActivities(caseId);
    const upcomingEvents = await this.loadUpcomingEvents(caseId);

    const customContext = {
      recentActivities: JSON.stringify(activities.slice(0, 5)),
      upcomingEvents: JSON.stringify(upcomingEvents.slice(0, 5)),
    };

    return this.generate({
      caseId,
      type: 'progress_report',
      channel,
      customContext,
    });
  }

  // =====================================================
  // AI 메시지 생성
  // =====================================================

  private async generateWithAI(
    type: UpdateType,
    channel: MessageChannel,
    variables: TemplateVariables
  ): Promise<{ subject: string; body: string }> {
    const ai = getAIClient();

    const prompt = this.buildAIPrompt(type, channel, variables);

    const result = await ai.completeJSON<{ subject: string; body: string }>(
      prompt,
      SYSTEM_PROMPT
    );

    return result;
  }

  private buildAIPrompt(
    type: UpdateType,
    channel: MessageChannel,
    variables: TemplateVariables
  ): string {
    const typeDescriptions: Record<UpdateType, string> = {
      hearing_reminder: '법원 기일 안내',
      deadline_reminder: '기한 안내',
      submission_complete: '서면 제출 완료 안내',
      judgment_notice: '판결/결정 안내',
      progress_report: '정기 진행상황 보고',
      payment_reminder: '결제 안내',
      document_request: '자료 요청',
      custom: '일반 안내',
    };

    const channelGuidelines: Record<MessageChannel, string> = {
      email: '공식적이고 상세한 톤. 제목(subject)과 본문(body) 모두 필요.',
      sms: '간결하게 160자 이내. 핵심 정보만.',
      kakao:
        '친근하면서도 전문적인 톤. 이모지 적절히 사용. 300자 이내 권장.',
    };

    return `
## 요청
${typeDescriptions[type]} 메시지를 작성해주세요.

## 채널
${channel} - ${channelGuidelines[channel]}

## 정보
${JSON.stringify(variables, null, 2)}

## 출력 형식
JSON으로 출력: { "subject": "제목 (이메일만)", "body": "본문" }

## 주의사항
- 법률 용어는 쉽게 풀어서
- 의뢰인이 해야 할 일이 있다면 명확히 안내
- 연락처나 위치 정보가 있다면 포함
- 불필요한 미사여구 제외
`;
  }

  // =====================================================
  // 템플릿 기반 생성 (AI 없을 때)
  // =====================================================

  private generateFromTemplate(
    type: UpdateType,
    channel: MessageChannel,
    variables: TemplateVariables
  ): { subject: string; body: string } {
    const templates = MESSAGE_TEMPLATES[type];
    if (!templates) {
      // 기본 템플릿
      return {
        subject: `[${variables.caseName || '사건'}] 안내드립니다`,
        body: `${variables.clientName || '의뢰인'}님께, 사건 진행 관련 안내드립니다.`,
      };
    }

    // 채널별 템플릿 가져오기
    let templateSubject = '';
    let templateBody = '';

    if (channel === 'email' && templates.email) {
      templateSubject = templates.email.subject;
      templateBody = templates.email.body;
    } else if (channel === 'sms' && templates.sms) {
      templateBody = templates.sms.body;
    } else if (channel === 'kakao' && templates.kakao) {
      templateBody = templates.kakao.body;
    } else {
      // 기본 템플릿
      return {
        subject: `[${variables.caseName || '사건'}] 안내드립니다`,
        body: `${variables.clientName || '의뢰인'}님께, 사건 진행 관련 안내드립니다.`,
      };
    }

    // 변수 치환
    let subject = templateSubject;
    let body = templateBody;

    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const placeholder = `{{${key}}}`;
        const strValue = Array.isArray(value)
          ? value.join(', ')
          : String(value);
        subject = subject.replace(new RegExp(placeholder, 'g'), strValue);
        body = body.replace(new RegExp(placeholder, 'g'), strValue);
      }
    }

    return { subject, body };
  }

  // =====================================================
  // 데이터 로드 함수
  // =====================================================

  private async loadCaseData(caseId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('legal_cases')
      .select('id, case_name, court_case_number, client_id, status, case_type')
      .eq('id', caseId)
      .single();

    if (error || !data) {
      throw new Error(`사건을 찾을 수 없습니다: ${caseId}`);
    }

    return {
      id: data.id,
      caseName: data.case_name,
      caseNumber: data.court_case_number || data.id,
      clientId: data.client_id,
      status: data.status,
      caseType: data.case_type,
    };
  }

  private async loadClientData(clientId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, phone, email')
      .eq('id', clientId)
      .single();

    if (error || !data) {
      throw new Error(`의뢰인을 찾을 수 없습니다: ${clientId}`);
    }

    return data;
  }

  private async loadHearing(hearingId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('court_hearings')
      .select('*')
      .eq('id', hearingId)
      .single();

    if (error || !data) {
      throw new Error(`기일을 찾을 수 없습니다: ${hearingId}`);
    }

    return data;
  }

  private async loadDeadline(deadlineId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('case_deadlines')
      .select('*')
      .eq('id', deadlineId)
      .single();

    if (error || !data) {
      throw new Error(`기한을 찾을 수 없습니다: ${deadlineId}`);
    }

    return data;
  }

  private async loadPaymentInfo(caseId: string) {
    const supabase = createAdminClient();
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('case_id', caseId);

    const totalAmount =
      payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const paidAmount =
      payments
        ?.filter((p) => p.status === 'completed' || p.status === '입금완료')
        .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return {
      totalAmount,
      paidAmount,
      pendingAmount: totalAmount - paidAmount,
    };
  }

  private async loadRecentActivities(caseId: string) {
    // 기일, 데드라인 완료 내역 등 조회
    const supabase = createAdminClient();
    const caseData = await this.loadCaseData(caseId);

    const { data: hearings } = await supabase
      .from('court_hearings')
      .select('hearing_type, hearing_date, status')
      .eq('case_number', caseData.caseNumber)
      .eq('status', 'COMPLETED')
      .order('hearing_date', { ascending: false })
      .limit(5);

    return (hearings || []).map((h) => ({
      date: h.hearing_date,
      description: `${HEARING_TYPE_LABELS[h.hearing_type as HearingType] || h.hearing_type} 완료`,
    }));
  }

  private async loadUpcomingEvents(caseId: string) {
    const supabase = createAdminClient();
    const caseData = await this.loadCaseData(caseId);

    // 예정된 기일
    const { data: hearings } = await supabase
      .from('court_hearings')
      .select('hearing_type, hearing_date, location')
      .eq('case_number', caseData.caseNumber)
      .eq('status', 'SCHEDULED')
      .gte('hearing_date', new Date().toISOString())
      .order('hearing_date', { ascending: true })
      .limit(3);

    // 예정된 기한
    const { data: deadlines } = await supabase
      .from('case_deadlines')
      .select('deadline_type, deadline_date')
      .eq('case_number', caseData.caseNumber)
      .eq('status', 'PENDING')
      .gte('deadline_date', new Date().toISOString().split('T')[0])
      .order('deadline_date', { ascending: true })
      .limit(3);

    const events: Array<{ date: string; description: string }> = [];

    for (const h of hearings || []) {
      events.push({
        date: h.hearing_date,
        description: `${HEARING_TYPE_LABELS[h.hearing_type as HearingType] || h.hearing_type} (${h.location || '장소 미정'})`,
      });
    }

    for (const d of deadlines || []) {
      events.push({
        date: d.deadline_date,
        description:
          DEADLINE_TYPE_LABELS[d.deadline_type as DeadlineType] ||
          d.deadline_type,
      });
    }

    // 날짜순 정렬
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return events;
  }

  // =====================================================
  // 변수 구성
  // =====================================================

  private async buildVariables(
    caseId: string,
    type: UpdateType,
    customContext?: Record<string, string>
  ): Promise<TemplateVariables> {
    const caseData = await this.loadCaseData(caseId);
    const clientData = await this.loadClientData(caseData.clientId);

    const variables: TemplateVariables = {
      clientName: clientData.name,
      clientPhone: clientData.phone,
      caseNumber: caseData.caseNumber,
      caseName: caseData.caseName,
      caseType: caseData.caseType,
      caseStatus: caseData.status,
      lawFirmName: '법무법인 더율',
    };

    // 커스텀 컨텍스트 병합
    if (customContext) {
      Object.assign(variables, customContext);
    }

    return variables;
  }

  // =====================================================
  // 유틸리티 함수
  // =====================================================

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${yy}.${mm}.${dd}(${weekday})`;
  }

  private formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? '오전' : '오후';
    const hour12 = hours % 12 || 12;
    return `${period} ${hour12}시${minutes > 0 ? ` ${minutes}분` : ''}`;
  }

  private daysUntil(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}

// 싱글톤 인스턴스
let generatorInstance: ClientUpdateGenerator | null = null;

export function getClientUpdateGenerator(): ClientUpdateGenerator {
  if (!generatorInstance) {
    generatorInstance = new ClientUpdateGenerator();
  }
  return generatorInstance;
}
