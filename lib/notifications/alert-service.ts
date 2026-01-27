/**
 * 알림 서비스
 * Slack, 이메일 등으로 알림 발송
 */

export interface AlertPayload {
  type: 'consultation' | 'booking' | 'anomaly' | 'daily_report';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  details?: Record<string, unknown>;
  tenantId: string;
  tenantName: string;
  timestamp: string;
}

export interface AlertSettings {
  slackWebhookUrl?: string;
  slackEnabled: boolean;
  emailEnabled: boolean;
  emailRecipients: string[];
  alertOnNewConsultation: boolean;
  alertOnNewBooking: boolean;
  alertOnAnomaly: boolean;
  dailyReportEnabled: boolean;
  dailyReportTime: string; // HH:MM
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  slackEnabled: false,
  emailEnabled: false,
  emailRecipients: [],
  alertOnNewConsultation: true,
  alertOnNewBooking: true,
  alertOnAnomaly: true,
  dailyReportEnabled: false,
  dailyReportTime: '09:00',
};

/**
 * Slack으로 알림 발송
 */
export async function sendSlackAlert(
  webhookUrl: string,
  payload: AlertPayload
): Promise<boolean> {
  try {
    const color = payload.severity === 'error'
      ? '#dc2626'
      : payload.severity === 'warning'
        ? '#f59e0b'
        : '#10b981';

    const typeEmoji = {
      consultation: ':speech_balloon:',
      booking: ':calendar:',
      anomaly: ':warning:',
      daily_report: ':chart_with_upwards_trend:',
    };

    // 상세 정보 텍스트 생성
    let detailsText = '';
    if (payload.details && Object.keys(payload.details).length > 0) {
      detailsText = Object.entries(payload.details)
        .slice(0, 10)
        .map(([key, value]) => `*${key}:* ${String(value)}`)
        .join('\n');
    }

    const slackMessage = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${typeEmoji[payload.type]} ${payload.title}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: payload.message + (detailsText ? `\n\n${detailsText}` : ''),
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*${payload.tenantName}* | ${new Date(payload.timestamp).toLocaleString('ko-KR')}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    return response.ok;
  } catch (error) {
    console.error('Slack alert error:', error);
    return false;
  }
}

/**
 * 이메일로 알림 발송 (Resend 사용 가정)
 */
export async function sendEmailAlert(
  recipients: string[],
  payload: AlertPayload
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const typeLabel = {
      consultation: '새 상담 신청',
      booking: '새 예약',
      anomaly: '이상 감지',
      daily_report: '일일 리포트',
    };

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${payload.severity === 'error' ? '#fef2f2' : payload.severity === 'warning' ? '#fffbeb' : '#f0fdf4'}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 8px 0; color: #1f2937;">${payload.title}</h2>
          <p style="margin: 0; color: #4b5563;">${payload.message}</p>
        </div>

        ${payload.details ? `
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 14px;">상세 정보</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${Object.entries(payload.details).map(([key, value]) => `
                <tr>
                  <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">${key}</td>
                  <td style="padding: 4px 0; color: #1f2937; font-size: 13px; text-align: right;">${String(value)}</td>
                </tr>
              `).join('')}
            </table>
          </div>
        ` : ''}

        <div style="color: #9ca3af; font-size: 12px; text-align: center;">
          ${payload.tenantName} | ${new Date(payload.timestamp).toLocaleString('ko-KR')}
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'luseed@notifications.theyool.kr',
        to: recipients,
        subject: `[${typeLabel[payload.type]}] ${payload.title}`,
        html: htmlContent,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Email alert error:', error);
    return false;
  }
}

/**
 * 알림 발송 (설정에 따라 Slack/이메일로)
 */
export async function sendAlert(
  settings: AlertSettings,
  payload: AlertPayload
): Promise<{ slack: boolean; email: boolean }> {
  const results = { slack: false, email: false };

  // Slack 알림
  if (settings.slackEnabled && settings.slackWebhookUrl) {
    results.slack = await sendSlackAlert(settings.slackWebhookUrl, payload);
  }

  // 이메일 알림
  if (settings.emailEnabled && settings.emailRecipients.length > 0) {
    results.email = await sendEmailAlert(settings.emailRecipients, payload);
  }

  return results;
}

/**
 * 새 상담 알림 발송
 */
export async function notifyNewConsultation(
  settings: AlertSettings,
  tenantId: string,
  tenantName: string,
  consultation: {
    name: string;
    phone: string;
    category?: string;
    message?: string;
  }
): Promise<void> {
  if (!settings.alertOnNewConsultation) return;

  await sendAlert(settings, {
    type: 'consultation',
    severity: 'info',
    title: '새로운 상담 신청',
    message: `${consultation.name}님이 상담을 신청했습니다.`,
    details: {
      '이름': consultation.name,
      '연락처': consultation.phone,
      '분류': consultation.category || '-',
      '내용': consultation.message?.slice(0, 100) || '-',
    },
    tenantId,
    tenantName,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 새 예약 알림 발송
 */
export async function notifyNewBooking(
  settings: AlertSettings,
  tenantId: string,
  tenantName: string,
  booking: {
    name: string;
    phone: string;
    type: string;
    preferredDate: string;
    preferredTime: string;
  }
): Promise<void> {
  if (!settings.alertOnNewBooking) return;

  const typeLabels: Record<string, string> = {
    visit: '방문 상담',
    video: '화상 상담',
    phone: '전화 상담',
  };

  await sendAlert(settings, {
    type: 'booking',
    severity: 'info',
    title: '새로운 예약',
    message: `${booking.name}님이 ${typeLabels[booking.type] || booking.type} 예약을 신청했습니다.`,
    details: {
      '이름': booking.name,
      '연락처': booking.phone,
      '상담 유형': typeLabels[booking.type] || booking.type,
      '희망 일시': `${booking.preferredDate} ${booking.preferredTime}`,
    },
    tenantId,
    tenantName,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 이상 탐지 알림 발송
 */
export async function notifyAnomaly(
  settings: AlertSettings,
  tenantId: string,
  tenantName: string,
  anomaly: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  if (!settings.alertOnAnomaly) return;

  const severityMap: Record<string, 'info' | 'warning' | 'error'> = {
    low: 'info',
    medium: 'warning',
    high: 'error',
  };

  await sendAlert(settings, {
    type: 'anomaly',
    severity: severityMap[anomaly.severity],
    title: '이상 패턴 감지',
    message: anomaly.message,
    details: anomaly.details,
    tenantId,
    tenantName,
    timestamp: new Date().toISOString(),
  });
}
