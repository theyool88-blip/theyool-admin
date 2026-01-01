/**
 * 의뢰인 커뮤니케이션 메시지 템플릿
 *
 * 채널별 (이메일, SMS, 카카오톡) 메시지 템플릿
 */

import type { UpdateType, MessageChannel } from './types';

// =====================================================
// AI 시스템 프롬프트
// =====================================================

export const SYSTEM_PROMPT = `당신은 법무법인의 의뢰인 커뮤니케이션 전문가입니다.
의뢰인에게 보내는 메시지를 작성합니다.

## 작성 원칙
1. **명확성**: 법률 용어를 쉽게 풀어서 설명
2. **신뢰성**: 전문적이면서도 친근한 톤
3. **실용성**: 의뢰인이 해야 할 일을 명확히 안내
4. **간결성**: 핵심 내용을 먼저, 부가 설명은 나중에

## 채널별 특성
- **이메일**: 상세한 내용 포함 가능, 공식적 톤
- **SMS**: 160자 이내, 핵심만 간단히
- **카카오톡**: 친근한 톤, 이모지 적절히 사용, 300자 이내

## 출력 형식 (JSON)
{
  "subject": "메일 제목 (이메일인 경우)",
  "body": "본문 내용"
}`;

// =====================================================
// 메시지 템플릿
// =====================================================

interface ChannelTemplates {
  email?: { subject: string; body: string };
  sms?: { body: string };
  kakao?: { body: string };
}

export const MESSAGE_TEMPLATES: Record<UpdateType, ChannelTemplates> = {
  // ----- 기일 안내 -----
  hearing_reminder: {
    email: {
      subject: '[{{caseName}}] {{hearingTypeName}} 안내 ({{hearingDate}})',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 {{hearingTypeName}} 일정을 안내드립니다.

■ 기일 정보
- 일시: {{hearingDate}} {{hearingTime}}
- 장소: {{courtName}} {{courtRoom}}
- 유형: {{hearingTypeName}}

■ 준비사항
- 신분증 지참
- 사건 관련 서류 지참
- 기일 30분 전 도착 권장

추가 문의사항이 있으시면 언제든 연락 주시기 바랍니다.

감사합니다.
{{lawFirmName}} 드림`,
    },
    sms: {
      body: `[{{lawFirmName}}] {{hearingDate}} {{hearingTime}} {{courtName}}에서 {{hearingTypeName}}이 있습니다. 30분 전 도착 부탁드립니다.`,
    },
    kakao: {
      body: `📅 기일 안내

{{caseName}}
📍 {{courtName}} {{courtRoom}}
🕐 {{hearingDate}} {{hearingTime}}

✅ 준비물: 신분증, 관련서류
⏰ 30분 전 도착 권장

문의사항 있으시면 연락주세요!`,
    },
  },

  // ----- 기한 안내 -----
  deadline_reminder: {
    email: {
      subject: '[{{caseName}}] {{deadlineTypeName}} 안내 (D-{{daysRemaining}})',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 {{deadlineTypeName}} 관련 안내드립니다.

■ 기한 정보
- 기한: {{deadlineDate}} (D-{{daysRemaining}})
- 유형: {{deadlineTypeName}}

해당 기한에 맞춰 진행하고 있으며, 추가로 필요한 사항이 있으시면 연락 주시기 바랍니다.

감사합니다.
{{lawFirmName}} 드림`,
    },
    sms: {
      body: `[{{lawFirmName}}] {{caseName}} {{deadlineTypeName}} D-{{daysRemaining}}입니다. 확인 부탁드립니다.`,
    },
    kakao: {
      body: `⏰ 기한 안내

{{caseName}}
📋 {{deadlineTypeName}}
📆 {{deadlineDate}} (D-{{daysRemaining}})

진행상황은 저희가 관리하고 있습니다.
문의사항 있으시면 연락주세요!`,
    },
  },

  // ----- 서면 제출 완료 -----
  submission_complete: {
    email: {
      subject: '[{{caseName}}] {{briefType}} 제출 완료',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 {{briefType}}을(를) {{submittedDate}}에 법원에 제출하였습니다.

■ 제출 내용 요약
{{summary}}

향후 일정이 확정되면 다시 안내드리겠습니다.

감사합니다.
{{lawFirmName}} 드림`,
    },
    kakao: {
      body: `✅ 서면 제출 완료

{{caseName}}
📄 {{briefType}}
📆 {{submittedDate}} 제출

{{summary}}

다음 일정이 확정되면 안내드리겠습니다!`,
    },
  },

  // ----- 판결/결정 안내 -----
  judgment_notice: {
    email: {
      subject: '[{{caseName}}] 판결/결정 안내',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 판결/결정 결과를 안내드립니다.

{{summary}}

향후 진행 방향에 대해 상담이 필요하시면 연락 주시기 바랍니다.

감사합니다.
{{lawFirmName}} 드림`,
    },
    kakao: {
      body: `⚖️ 판결/결정 안내

{{caseName}}

{{summary}}

상세한 내용은 연락 주시면 안내드리겠습니다.`,
    },
  },

  // ----- 정기 진행상황 -----
  progress_report: {
    email: {
      subject: '[{{caseName}}] 월간 진행상황 리포트',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 진행상황을 안내드립니다.

■ 현재 상태
- 진행단계: {{caseStatus}}

■ 최근 활동
{{recentActivities}}

■ 향후 일정
{{upcomingEvents}}

궁금하신 점이 있으시면 언제든 연락 주세요.

감사합니다.
{{lawFirmName}} 드림`,
    },
    kakao: {
      body: `📊 진행상황 안내

{{caseName}}
📌 상태: {{caseStatus}}

■ 향후 일정
{{upcomingEvents}}

문의사항 있으시면 연락주세요!`,
    },
  },

  // ----- 결제 안내 -----
  payment_reminder: {
    email: {
      subject: '[{{caseName}}] 착수금/보수금 안내',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건의 비용 관련 안내드립니다.

■ 비용 내역
- 총 금액: {{totalAmount}}원
- 납부 금액: {{paidAmount}}원
- 잔여 금액: {{pendingAmount}}원

편하실 때 납부 부탁드립니다.

감사합니다.
{{lawFirmName}} 드림`,
    },
    sms: {
      body: `[{{lawFirmName}}] {{caseName}} 잔여 비용 {{pendingAmount}}원 납부 안내드립니다.`,
    },
    kakao: {
      body: `💳 비용 안내

{{caseName}}
💰 잔여 금액: {{pendingAmount}}원

편하실 때 납부 부탁드립니다.
문의사항 있으시면 연락주세요!`,
    },
  },

  // ----- 자료 요청 -----
  document_request: {
    email: {
      subject: '[{{caseName}}] 추가 자료 요청',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{caseName}} 사건 진행을 위해 아래 자료가 필요합니다.

{{summary}}

자료 준비에 어려움이 있으시면 연락 주세요.

감사합니다.
{{lawFirmName}} 드림`,
    },
    kakao: {
      body: `📁 자료 요청

{{caseName}}

{{summary}}

준비에 어려움 있으시면 연락주세요!`,
    },
  },

  // ----- 사용자 정의 -----
  custom: {
    email: {
      subject: '[{{caseName}}] 안내',
      body: `{{clientName}} 의뢰인님께,

안녕하세요, {{lawFirmName}}입니다.

{{summary}}

감사합니다.
{{lawFirmName}} 드림`,
    },
    kakao: {
      body: `📌 안내

{{caseName}}

{{summary}}

문의사항 있으시면 연락주세요!`,
    },
  },
};

// =====================================================
// 템플릿 유틸리티
// =====================================================

/**
 * 특정 유형/채널의 템플릿 조회
 */
export function getTemplate(
  type: UpdateType,
  channel: MessageChannel
): { subject?: string; body: string } | null {
  const templates = MESSAGE_TEMPLATES[type];
  if (!templates) return null;

  if (channel === 'email') {
    return templates.email || null;
  } else if (channel === 'sms') {
    return templates.sms ? { body: templates.sms.body } : null;
  } else if (channel === 'kakao') {
    return templates.kakao ? { body: templates.kakao.body } : null;
  }

  return null;
}

/**
 * 사용 가능한 모든 템플릿 유형 목록
 */
export function getAvailableTypes(): UpdateType[] {
  return Object.keys(MESSAGE_TEMPLATES) as UpdateType[];
}

/**
 * 특정 유형에서 지원하는 채널 목록
 */
export function getSupportedChannels(type: UpdateType): MessageChannel[] {
  const templates = MESSAGE_TEMPLATES[type];
  if (!templates) return [];

  const channels: MessageChannel[] = [];
  if (templates.email) channels.push('email');
  if (templates.sms) channels.push('sms');
  if (templates.kakao) channels.push('kakao');

  return channels;
}
