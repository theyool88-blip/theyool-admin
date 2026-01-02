import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import type { IntegrationProvider, TenantIntegrationRecord, OAuthState } from '@/types/integration';

// =====================================================
// OAuth Scopes
// =====================================================
// calendar: 전체 액세스 (캘린더 목록 + 이벤트 읽기/쓰기)
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// 하위 호환성을 위해 기존 SCOPES 유지
const SCOPES = CALENDAR_SCOPES;

// =====================================================
// OAuth2 Client (공용)
// =====================================================
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`
);

// =====================================================
// 기존 함수들 (하위 호환성)
// =====================================================

/** @deprecated Use getTenantAuthUrl instead */
export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setCredentials(tokens: { access_token?: string | null; refresh_token?: string | null }) {
  oauth2Client.setCredentials(tokens);
}

export async function refreshAccessToken(refreshToken: string) {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getCalendarList(accessToken: string) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  options?: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
) {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId,
    timeMin: options?.timeMin || new Date().toISOString(),
    timeMax: options?.timeMax,
    maxResults: options?.maxResults || 100,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

export { oauth2Client };

// =====================================================
// 테넌트별 OAuth 함수들 (신규)
// =====================================================

/**
 * 테넌트별 OAuth 인증 URL 생성
 */
export async function getTenantAuthUrl(
  tenantId: string,
  provider: IntegrationProvider,
  userId: string
): Promise<string> {
  const supabase = await createAdminClient();

  // State 생성 (CSRF 방지)
  const stateData: OAuthState = {
    tenantId,
    provider,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  // State를 DB에 저장 (10분 만료)
  await supabase.from('oauth_states').insert({
    state,
    tenant_id: tenantId,
    provider,
    user_id: userId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  // Scopes 선택
  const scopes = provider === 'google_calendar' ? CALENDAR_SCOPES : DRIVE_SCOPES;

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
  });
}

/**
 * OAuth State 검증
 */
export async function validateOAuthState(state: string): Promise<{
  valid: boolean;
  tenantId?: string;
  provider?: IntegrationProvider;
  userId?: string;
  error?: string;
}> {
  const supabase = await createAdminClient();

  // State 조회
  const { data, error } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid or expired state' };
  }

  // 만료 확인
  if (new Date(data.expires_at) < new Date()) {
    // 만료된 state 삭제
    await supabase.from('oauth_states').delete().eq('state', state);
    return { valid: false, error: 'State expired' };
  }

  return {
    valid: true,
    tenantId: data.tenant_id,
    provider: data.provider as IntegrationProvider,
    userId: data.user_id,
  };
}

/**
 * OAuth State 삭제
 */
export async function deleteOAuthState(state: string): Promise<void> {
  const supabase = await createAdminClient();
  await supabase.from('oauth_states').delete().eq('state', state);
}

/**
 * 테넌트 연동 정보 조회
 */
export async function getTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider
): Promise<TenantIntegrationRecord | null> {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('tenant_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', provider)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TenantIntegrationRecord;
}

/**
 * 테넌트 연동 저장/업데이트
 */
export async function upsertTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider,
  data: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    connectedBy: string;
    settings?: Record<string, unknown>;
  }
): Promise<TenantIntegrationRecord | null> {
  const supabase = await createAdminClient();

  const { data: result, error } = await supabase
    .from('tenant_integrations')
    .upsert(
      {
        tenant_id: tenantId,
        provider,
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        token_expiry: data.tokenExpiry?.toISOString(),
        status: 'connected',
        connected_at: new Date().toISOString(),
        connected_by: data.connectedBy,
        settings: data.settings || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' }
    )
    .select()
    .single();

  if (error) {
    console.error('[upsertTenantIntegration] Error:', error);
    return null;
  }

  return result as TenantIntegrationRecord;
}

/**
 * 테넌트 연동 토큰 갱신
 */
export async function refreshTenantToken(
  tenantId: string,
  provider: IntegrationProvider
): Promise<{ accessToken: string; expiryDate?: number } | null> {
  const integration = await getTenantIntegration(tenantId, provider);

  if (!integration || !integration.refresh_token) {
    return null;
  }

  try {
    const credentials = await refreshAccessToken(integration.refresh_token);

    if (!credentials.access_token) {
      return null;
    }

    // 토큰 업데이트
    const supabase = await createAdminClient();
    await supabase
      .from('tenant_integrations')
      .update({
        access_token: credentials.access_token,
        token_expiry: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('provider', provider);

    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date || undefined,
    };
  } catch (error) {
    console.error('[refreshTenantToken] Error:', error);

    // 토큰 갱신 실패 시 상태를 expired로 변경
    const supabase = await createAdminClient();
    await supabase
      .from('tenant_integrations')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('provider', provider);

    return null;
  }
}

/**
 * 테넌트의 유효한 액세스 토큰 가져오기 (필요시 자동 갱신)
 */
export async function getTenantAccessToken(
  tenantId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const integration = await getTenantIntegration(tenantId, provider);

  if (!integration || integration.status !== 'connected') {
    return null;
  }

  // 토큰 만료 확인
  const now = Date.now();
  const expiry = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;

  if (expiry && now >= expiry) {
    // 토큰 갱신
    const refreshed = await refreshTenantToken(tenantId, provider);
    return refreshed?.accessToken || null;
  }

  return integration.access_token;
}

/**
 * 테넌트의 캘린더 목록 조회
 */
export async function getTenantCalendarList(tenantId: string) {
  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');

  if (!accessToken) {
    throw new Error('Google Calendar not connected or token expired');
  }

  return getCalendarList(accessToken);
}

/**
 * 테넌트 연동 설정 업데이트
 */
export async function updateTenantIntegrationSettings(
  tenantId: string,
  provider: IntegrationProvider,
  settings: Record<string, unknown>
): Promise<boolean> {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from('tenant_integrations')
    .update({
      settings,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', provider);

  if (error) {
    console.error('[updateTenantIntegrationSettings] Error:', error);
    return false;
  }

  return true;
}

/**
 * 테넌트 연동 해제
 */
export async function disconnectTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from('tenant_integrations')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      webhook_channel_id: null,
      webhook_resource_id: null,
      webhook_expiry: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', provider);

  if (error) {
    console.error('[disconnectTenantIntegration] Error:', error);
    return false;
  }

  return true;
}

/**
 * 테넌트의 모든 연동 목록 조회
 */
export async function getTenantIntegrations(tenantId: string): Promise<TenantIntegrationRecord[]> {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('tenant_integrations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('provider');

  if (error) {
    console.error('[getTenantIntegrations] Error:', error);
    return [];
  }

  return (data || []) as TenantIntegrationRecord[];
}

// =====================================================
// Google Calendar 쓰기 함수들 (신규)
// =====================================================

export interface CalendarEventData {
  summary: string;              // 이벤트 제목
  description?: string;         // 설명
  location?: string;            // 장소
  start: {
    dateTime: string;           // ISO 8601 형식
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  colorId?: string;             // 색상 ID (1-11)
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

/**
 * Google Calendar 이벤트 생성
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: CalendarEventData
): Promise<{ id: string; htmlLink: string } | null> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: eventData.summary,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: eventData.start.dateTime,
          timeZone: eventData.start.timeZone || 'Asia/Seoul',
        },
        end: {
          dateTime: eventData.end.dateTime,
          timeZone: eventData.end.timeZone || 'Asia/Seoul',
        },
        colorId: eventData.colorId,
        reminders: eventData.reminders || {
          useDefault: true,
        },
      },
    });

    console.log('[createCalendarEvent] Created:', response.data.id);
    return {
      id: response.data.id!,
      htmlLink: response.data.htmlLink!,
    };
  } catch (error) {
    console.error('[createCalendarEvent] Error:', error);
    return null;
  }
}

/**
 * Google Calendar 이벤트 수정
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  eventData: Partial<CalendarEventData>
): Promise<boolean> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const updateBody: Record<string, unknown> = {};

    if (eventData.summary) updateBody.summary = eventData.summary;
    if (eventData.description !== undefined) updateBody.description = eventData.description;
    if (eventData.location !== undefined) updateBody.location = eventData.location;
    if (eventData.start) {
      updateBody.start = {
        dateTime: eventData.start.dateTime,
        timeZone: eventData.start.timeZone || 'Asia/Seoul',
      };
    }
    if (eventData.end) {
      updateBody.end = {
        dateTime: eventData.end.dateTime,
        timeZone: eventData.end.timeZone || 'Asia/Seoul',
      };
    }
    if (eventData.colorId) updateBody.colorId = eventData.colorId;
    if (eventData.reminders) updateBody.reminders = eventData.reminders;

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updateBody,
    });

    console.log('[updateCalendarEvent] Updated:', eventId);
    return true;
  } catch (error) {
    console.error('[updateCalendarEvent] Error:', error);
    return false;
  }
}

/**
 * Google Calendar 이벤트 삭제
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });

    console.log('[deleteCalendarEvent] Deleted:', eventId);
    return true;
  } catch (error) {
    console.error('[deleteCalendarEvent] Error:', error);
    return false;
  }
}

/**
 * 테넌트의 캘린더에 이벤트 생성 (토큰 자동 관리)
 */
export async function createTenantCalendarEvent(
  tenantId: string,
  calendarId: string,
  eventData: CalendarEventData
): Promise<{ id: string; htmlLink: string } | null> {
  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');

  if (!accessToken) {
    console.error('[createTenantCalendarEvent] No valid access token');
    return null;
  }

  return createCalendarEvent(accessToken, calendarId, eventData);
}

/**
 * 테넌트의 캘린더 이벤트 수정 (토큰 자동 관리)
 */
export async function updateTenantCalendarEvent(
  tenantId: string,
  calendarId: string,
  eventId: string,
  eventData: Partial<CalendarEventData>
): Promise<boolean> {
  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');

  if (!accessToken) {
    console.error('[updateTenantCalendarEvent] No valid access token');
    return false;
  }

  return updateCalendarEvent(accessToken, calendarId, eventId, eventData);
}

/**
 * 테넌트의 캘린더 이벤트 삭제 (토큰 자동 관리)
 */
export async function deleteTenantCalendarEvent(
  tenantId: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');

  if (!accessToken) {
    console.error('[deleteTenantCalendarEvent] No valid access token');
    return false;
  }

  return deleteCalendarEvent(accessToken, calendarId, eventId);
}
