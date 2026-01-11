/**
 * 통합 알림 발송 서비스
 * SMS/알림톡 발송, 템플릿 변수 치환, 로깅 통합
 */

import { createClient } from '@/lib/supabase/server';
import { sendSMS, calculateSMSLength } from './sms';
import { sendAlimtalk } from './kakao-alimtalk';
import type {
  NotificationChannel,
  NotificationTemplate,
  SendResult,
  RecipientType,
  RelatedType,
} from '@/types/notification';

/**
 * 템플릿 변수 치환
 * {{변수명}} 형식의 변수를 실제 값으로 치환
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * 템플릿 변수 추출
 * 템플릿에서 {{변수명}} 형식의 모든 변수 추출
 */
export function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * 발송 요청 파라미터
 */
interface SendNotificationParams {
  // 채널 및 템플릿
  channel: NotificationChannel;
  template?: NotificationTemplate;
  customContent?: string;

  // 수신자 정보
  recipientPhone: string;
  recipientName?: string;
  recipientType: RecipientType;
  recipientId?: string;

  // 변수 (템플릿 사용시)
  variables?: Record<string, string>;

  // 연관 정보
  relatedType?: RelatedType;
  relatedId?: string;

  // 사무소 정보 (발신번호 결정용)
  office?: string;  // '평택', '천안'
}

/**
 * 통합 알림 발송
 */
export async function sendNotification({
  channel,
  template,
  customContent,
  recipientPhone,
  recipientName,
  recipientType,
  recipientId,
  variables = {},
  relatedType,
  relatedId,
  office,
}: SendNotificationParams): Promise<SendResult> {
  // 메시지 내용 결정
  let content: string;
  let messageType = template?.message_type || 'SMS';
  let title = template?.title;

  if (template) {
    content = renderTemplate(template.content, variables);
    if (title) {
      title = renderTemplate(title, variables);
    }
  } else if (customContent) {
    content = customContent;
    const lengthInfo = calculateSMSLength(content);
    messageType = lengthInfo.type;
  } else {
    return {
      success: false,
      error: '템플릿 또는 메시지 내용이 필요합니다.',
    };
  }

  // 발송 실행
  let result: SendResult;

  if (channel === 'sms') {
    result = await sendSMS({
      to: recipientPhone,
      message: content,
      messageType,
      subject: title,
      office,  // 사무소별 발신번호
    });
  } else if (channel === 'kakao_alimtalk') {
    // 알림톡은 카카오 승인 템플릿 ID가 필요
    // 현재는 SMS 대체 발송으로 처리
    result = await sendAlimtalk({
      to: recipientPhone,
      templateId: template?.id || 'default',
      variables,
      fallbackSMS: true,
      fallbackMessage: content,
    });
  } else {
    return {
      success: false,
      error: `지원하지 않는 채널: ${channel}`,
    };
  }

  // 발송 이력 저장
  try {
    const supabase = await createClient();
    await supabase.from('notification_logs').insert({
      template_id: template?.id || null,
      recipient_type: recipientType,
      recipient_id: recipientId,
      recipient_phone: recipientPhone,
      recipient_name: recipientName,
      channel,
      message_type: messageType,
      content,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error,
      provider_message_id: result.message_id,
      cost: result.cost,
      related_type: relatedType,
      related_id: relatedId,
      sent_at: result.success ? new Date().toISOString() : null,
    });
  } catch (logError) {
    console.error('발송 이력 저장 실패:', logError);
    // 로깅 실패는 발송 결과에 영향 없음
  }

  return result;
}

/**
 * 대량 발송
 */
export async function sendBulkNotifications(
  notifications: Array<{
    channel: NotificationChannel;
    template?: NotificationTemplate;
    customContent?: string;
    recipientPhone: string;
    recipientName?: string;
    recipientType: RecipientType;
    recipientId?: string;
    variables?: Record<string, string>;
    relatedType?: RelatedType;
    relatedId?: string;
  }>
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: SendResult[];
}> {
  const results: SendResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const notification of notifications) {
    const result = await sendNotification(notification);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    total: notifications.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}

/**
 * 템플릿 ID로 발송 (편의 함수)
 */
export async function sendByTemplateId(
  templateId: string,
  recipientPhone: string,
  recipientName: string,
  variables: Record<string, string>,
  options?: {
    recipientType?: RecipientType;
    recipientId?: string;
    relatedType?: RelatedType;
    relatedId?: string;
    office?: string;
  }
): Promise<SendResult> {
  const supabase = await createClient();

  // 템플릿 조회
  const { data: template, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .single();

  if (error || !template) {
    return {
      success: false,
      error: '템플릿을 찾을 수 없습니다.',
    };
  }

  return sendNotification({
    channel: template.channel,
    template,
    recipientPhone,
    recipientName,
    recipientType: options?.recipientType || 'client',
    recipientId: options?.recipientId,
    variables,
    relatedType: options?.relatedType,
    relatedId: options?.relatedId,
    office: options?.office,
  });
}

/**
 * 카테고리별 기본 템플릿으로 발송
 */
export async function sendByCategory(
  category: 'hearing_reminder' | 'consultation_reminder' | 'deadline_reminder',
  recipientPhone: string,
  recipientName: string,
  variables: Record<string, string>,
  options?: {
    recipientType?: RecipientType;
    recipientId?: string;
    relatedType?: RelatedType;
    relatedId?: string;
    office?: string;  // 사무소 (평택/천안)
  }
): Promise<SendResult> {
  const supabase = await createClient();

  // 해당 카테고리의 활성화된 템플릿 조회
  const { data: template, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !template) {
    return {
      success: false,
      error: `${category} 템플릿을 찾을 수 없습니다.`,
    };
  }

  return sendNotification({
    channel: template.channel,
    template,
    recipientPhone,
    recipientName,
    recipientType: options?.recipientType || 'client',
    recipientId: options?.recipientId,
    variables,
    relatedType: options?.relatedType,
    relatedId: options?.relatedId,
    office: options?.office,
  });
}
