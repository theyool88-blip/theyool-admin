/**
 * SCOURT 업데이트 알림 서비스
 *
 * scourt_case_updates 기반으로 의뢰인/변호사에게 알림 발송
 */

import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '@/lib/notifications/sender';
import type { CaseUpdate, UpdateType } from './change-detector';

// ============================================================
// 타입 정의
// ============================================================

interface NotifyResult {
  success: boolean;
  notificationsSent: number;
  errors: string[];
}

interface CaseClientInfo {
  clientId: string;
  clientName: string;
  clientPhone: string;
  caseName: string;
  caseNumber: string;
  office?: string;
}

// ============================================================
// 업데이트 유형별 알림 설정
// ============================================================

/**
 * 알림을 보내야 하는 업데이트 유형과 설정
 */
const NOTIFICATION_CONFIG: Record<
  UpdateType,
  {
    shouldNotify: boolean;
    category: 'hearing_reminder' | 'deadline_reminder' | 'manual';
    urgent: boolean;
    messageTemplate: string;
  }
> = {
  hearing_new: {
    shouldNotify: true,
    category: 'hearing_reminder',
    urgent: true,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건에 새 기일이 지정되었습니다.\n\n{{update_summary}}\n\n문의: {{office_phone}}',
  },
  hearing_changed: {
    shouldNotify: true,
    category: 'hearing_reminder',
    urgent: true,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건 기일이 변경되었습니다.\n\n{{update_summary}}\n\n문의: {{office_phone}}',
  },
  hearing_canceled: {
    shouldNotify: true,
    category: 'hearing_reminder',
    urgent: true,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건 기일이 취소되었습니다.\n\n{{update_summary}}\n\n문의: {{office_phone}}',
  },
  hearing_result: {
    shouldNotify: true,
    category: 'hearing_reminder',
    urgent: false,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건 기일 결과 안내입니다.\n\n{{update_summary}}\n\n문의: {{office_phone}}',
  },
  result_announced: {
    shouldNotify: true,
    category: 'hearing_reminder',
    urgent: true,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건에 판결/결정이 선고되었습니다.\n\n{{update_summary}}\n\n담당 변호사가 곧 연락드리겠습니다.\n\n문의: {{office_phone}}',
  },
  appeal_filed: {
    shouldNotify: true,
    category: 'deadline_reminder',
    urgent: true,
    messageTemplate: '[더윤] {{client_name}}님, {{case_name}} 사건에 상소가 제기되었습니다.\n\n{{update_summary}}\n\n담당 변호사가 곧 연락드리겠습니다.\n\n문의: {{office_phone}}',
  },
  document_filed: {
    shouldNotify: false, // 서류 제출은 알림 안 함
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
  document_served: {
    shouldNotify: false, // 서류 송달은 알림 안 함
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
  served: {
    shouldNotify: false,
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
  status_changed: {
    shouldNotify: false,
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
  party_changed: {
    shouldNotify: false,
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
  related_case_new: {
    shouldNotify: false, // 담당자용 알림이므로 의뢰인에게는 발송 안함
    category: 'manual',
    urgent: false,
    messageTemplate: '[더윤] {{case_name}} 사건에 연관사건이 발견되었습니다.\n\n{{update_summary}}\n\n확인이 필요합니다.',
  },
  lower_court_new: {
    shouldNotify: false, // 담당자용 알림이므로 의뢰인에게는 발송 안함
    category: 'manual',
    urgent: false,
    messageTemplate: '[더윤] {{case_name}} 사건의 심급사건이 발견되었습니다.\n\n{{update_summary}}\n\n확인이 필요합니다.',
  },
  other: {
    shouldNotify: false,
    category: 'manual',
    urgent: false,
    messageTemplate: '',
  },
};

// 사무소별 전화번호
const OFFICE_PHONES: Record<string, string> = {
  '평택': '031-652-0102',
  '천안': '041-566-0102',
  default: '031-652-0102',
};

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 사건의 의뢰인 정보 조회
 */
async function getCaseClientInfo(
  legalCaseId: string
): Promise<CaseClientInfo | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('legal_cases')
    .select(`
      id,
      case_name,
      court_case_number,
      office,
      client:clients (
        id,
        name,
        phone
      )
    `)
    .eq('id', legalCaseId)
    .single();

  if (error || !data) {
    console.error('사건 정보 조회 실패:', error);
    return null;
  }

  // Supabase 조인 결과는 배열로 반환됨
  const clientArray = data.client as Array<{ id: string; name: string; phone: string }> | null;
  const client = clientArray && clientArray.length > 0 ? clientArray[0] : null;

  if (!client || !client.phone) {
    return null;
  }

  return {
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
    caseName: data.case_name || data.court_case_number || '사건',
    caseNumber: data.court_case_number || '',
    office: data.office,
  };
}

/**
 * 템플릿 변수 치환
 */
function renderMessage(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ============================================================
// 알림 발송 함수
// ============================================================

/**
 * SCOURT 업데이트에 대해 알림 발송
 *
 * @param legalCaseId 사건 ID
 * @param updates 감지된 업데이트 목록
 * @param options 옵션
 * @returns 발송 결과
 */
export async function notifyOnCaseUpdates(
  legalCaseId: string,
  updates: CaseUpdate[],
  options?: {
    forceNotify?: boolean; // 모든 업데이트에 대해 알림 강제 발송
    importanceFilter?: ('high' | 'normal' | 'low')[]; // 특정 중요도만 발송
  }
): Promise<NotifyResult> {
  const result: NotifyResult = {
    success: true,
    notificationsSent: 0,
    errors: [],
  };

  // 알림을 보내야 하는 업데이트 필터링
  const notifiableUpdates = updates.filter((update) => {
    const config = NOTIFICATION_CONFIG[update.updateType];

    // 알림 발송 대상인지 확인
    if (!options?.forceNotify && !config.shouldNotify) {
      return false;
    }

    // 중요도 필터 적용
    if (options?.importanceFilter && !options.importanceFilter.includes(update.importance)) {
      return false;
    }

    // 기본: high importance만 알림
    if (!options?.importanceFilter && update.importance !== 'high') {
      return false;
    }

    return true;
  });

  if (notifiableUpdates.length === 0) {
    return result;
  }

  // 의뢰인 정보 조회
  const clientInfo = await getCaseClientInfo(legalCaseId);
  if (!clientInfo) {
    result.errors.push('의뢰인 정보를 찾을 수 없습니다.');
    result.success = false;
    return result;
  }

  // 사무소 전화번호
  const officePhone = OFFICE_PHONES[clientInfo.office || 'default'] || OFFICE_PHONES.default;

  // 각 업데이트에 대해 알림 발송
  for (const update of notifiableUpdates) {
    const config = NOTIFICATION_CONFIG[update.updateType];

    try {
      // 메시지 생성
      const message = renderMessage(config.messageTemplate, {
        client_name: clientInfo.clientName,
        case_name: clientInfo.caseName,
        case_number: clientInfo.caseNumber,
        update_summary: update.updateSummary,
        office_phone: officePhone,
      });

      // 알림 발송
      const sendResult = await sendNotification({
        channel: 'sms',
        customContent: message,
        recipientPhone: clientInfo.clientPhone,
        recipientName: clientInfo.clientName,
        recipientType: 'client',
        recipientId: clientInfo.clientId,
        relatedType: 'case',
        relatedId: legalCaseId,
        office: clientInfo.office,
      });

      if (sendResult.success) {
        result.notificationsSent++;
        console.log(`[SCOURT] 알림 발송 완료: ${update.updateType} → ${clientInfo.clientPhone}`);
      } else {
        result.errors.push(`${update.updateType}: ${sendResult.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${update.updateType}: ${errorMsg}`);
    }
  }

  if (result.errors.length > 0) {
    result.success = result.notificationsSent > 0; // 일부라도 성공하면 true
  }

  return result;
}

/**
 * 단일 업데이트에 대해 알림 발송 (수동 발송용)
 */
export async function notifySingleUpdate(
  legalCaseId: string,
  updateType: UpdateType,
  updateSummary: string
): Promise<NotifyResult> {
  const update: CaseUpdate = {
    updateType,
    updateSummary,
    details: {},
    importance: 'high',
  };

  return notifyOnCaseUpdates(legalCaseId, [update], { forceNotify: true });
}
