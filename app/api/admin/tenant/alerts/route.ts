/**
 * 테넌트 알림 설정 관리
 * GET /api/admin/tenant/alerts - 알림 설정 조회
 * PUT /api/admin/tenant/alerts - 알림 설정 저장
 * POST /api/admin/tenant/alerts/test - 테스트 알림 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/api/with-tenant';
import { createClient } from '@supabase/supabase-js';
import {
  AlertSettings,
  DEFAULT_ALERT_SETTINGS,
  sendSlackAlert,
  sendEmailAlert,
} from '@/lib/notifications/alert-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};

// GET - 알림 설정 조회
export const GET = withRole('admin')(async (request, { tenant }) => {
  const supabase = getServiceClient();

  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenant.tenantId)
    .eq('category', 'alerts')
    .single();

  const settings: AlertSettings = {
    ...DEFAULT_ALERT_SETTINGS,
    ...(settingsRow?.settings as Partial<AlertSettings> || {}),
  };

  // Webhook URL은 마스킹해서 반환
  if (settings.slackWebhookUrl) {
    const url = settings.slackWebhookUrl;
    settings.slackWebhookUrl = url.slice(0, 30) + '...' + url.slice(-10);
  }

  return NextResponse.json({
    success: true,
    data: settings,
  });
});

// PUT - 알림 설정 저장
export const PUT = withRole('admin')(async (request, { tenant }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const {
    slackWebhookUrl,
    slackEnabled,
    emailEnabled,
    emailRecipients,
    alertOnNewConsultation,
    alertOnNewBooking,
    alertOnAnomaly,
    dailyReportEnabled,
    dailyReportTime,
  } = body as Partial<AlertSettings>;

  const supabase = getServiceClient();

  // 기존 설정 조회
  const { data: existingRow } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenant.tenantId)
    .eq('category', 'alerts')
    .single();

  const existingSettings = (existingRow?.settings as Partial<AlertSettings>) || {};

  // 업데이트할 설정 병합
  const updatedSettings: Partial<AlertSettings> = { ...existingSettings };

  // Webhook URL이 마스킹된 값이 아닌 경우에만 업데이트
  if (slackWebhookUrl !== undefined && !slackWebhookUrl.includes('...')) {
    updatedSettings.slackWebhookUrl = slackWebhookUrl || undefined;
  }

  if (slackEnabled !== undefined) updatedSettings.slackEnabled = slackEnabled;
  if (emailEnabled !== undefined) updatedSettings.emailEnabled = emailEnabled;
  if (emailRecipients !== undefined) updatedSettings.emailRecipients = emailRecipients;
  if (alertOnNewConsultation !== undefined) updatedSettings.alertOnNewConsultation = alertOnNewConsultation;
  if (alertOnNewBooking !== undefined) updatedSettings.alertOnNewBooking = alertOnNewBooking;
  if (alertOnAnomaly !== undefined) updatedSettings.alertOnAnomaly = alertOnAnomaly;
  if (dailyReportEnabled !== undefined) updatedSettings.dailyReportEnabled = dailyReportEnabled;
  if (dailyReportTime !== undefined) updatedSettings.dailyReportTime = dailyReportTime;

  // Upsert
  const { error } = await supabase
    .from('tenant_settings')
    .upsert(
      {
        tenant_id: tenant.tenantId,
        category: 'alerts',
        settings: updatedSettings,
      },
      {
        onConflict: 'tenant_id,category',
      }
    );

  if (error) {
    console.error('Failed to save alert settings:', error);
    return NextResponse.json(
      { success: false, error: '알림 설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: '알림 설정이 저장되었습니다.',
  });
});

// POST - 테스트 알림 발송
export const POST = withRole('admin')(async (request, { tenant }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { type } = body as { type: 'slack' | 'email' };

  const supabase = getServiceClient();

  // 설정 조회
  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenant.tenantId)
    .eq('category', 'alerts')
    .single();

  const settings = (settingsRow?.settings as Partial<AlertSettings>) || {};

  const testPayload = {
    type: 'anomaly' as const,
    severity: 'info' as const,
    title: '테스트 알림',
    message: '알림 설정이 올바르게 구성되었습니다. 이 메시지가 보이면 알림이 정상 작동합니다.',
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    timestamp: new Date().toISOString(),
  };

  let success = false;
  let errorMessage = '';

  if (type === 'slack') {
    if (!settings.slackWebhookUrl) {
      return NextResponse.json(
        { success: false, error: 'Slack Webhook URL이 설정되지 않았습니다.' },
        { status: 400 }
      );
    }
    success = await sendSlackAlert(settings.slackWebhookUrl, testPayload);
    if (!success) {
      errorMessage = 'Slack 알림 발송에 실패했습니다. Webhook URL을 확인해주세요.';
    }
  } else if (type === 'email') {
    if (!settings.emailRecipients?.length) {
      return NextResponse.json(
        { success: false, error: '이메일 수신자가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }
    success = await sendEmailAlert(settings.emailRecipients, testPayload);
    if (!success) {
      errorMessage = '이메일 발송에 실패했습니다. 이메일 설정을 확인해주세요.';
    }
  }

  if (success) {
    return NextResponse.json({
      success: true,
      message: '테스트 알림이 발송되었습니다.',
    });
  } else {
    return NextResponse.json(
      { success: false, error: errorMessage || '알림 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
});
