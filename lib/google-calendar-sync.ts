import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getCalendarEvents,
  refreshAccessToken,
  getTenantIntegration,
  getTenantAccessToken,
} from '@/lib/google-calendar';
import type { GoogleCalendarSettings } from '@/types/integration';

// 기일 유형 매핑
const HEARING_TYPE_MAP: Record<string, string> = {
  // 변론기일 (HEARING_MAIN)
  '변론': 'HEARING_MAIN',
  '변론준비': 'HEARING_MAIN',
  '증인신문': 'HEARING_MAIN',
  '당사자신문': 'HEARING_MAIN',
  '감정': 'HEARING_MAIN',
  '검증': 'HEARING_MAIN',
  // 조정기일 (HEARING_MEDIATION)
  '조정': 'HEARING_MEDIATION',
  '조정조치': 'HEARING_MEDIATION',
  '화해권고': 'HEARING_MEDIATION',
  '조정회부': 'HEARING_MEDIATION',
  // 심문기일 (HEARING_INTERIM)
  '심문': 'HEARING_INTERIM',
  '가처분': 'HEARING_INTERIM',
  '가압류': 'HEARING_INTERIM',
  '보전처분': 'HEARING_INTERIM',
  // 조사기일 (HEARING_INVESTIGATION)
  '조사': 'HEARING_INVESTIGATION',
  '면접조사': 'HEARING_INVESTIGATION',
  '사실조회': 'HEARING_INVESTIGATION',
  '현장조사': 'HEARING_INVESTIGATION',
  // 상담·교육 기일 (HEARING_PARENTING)
  '상담': 'HEARING_PARENTING',
  '교육': 'HEARING_PARENTING',
  '양육상담': 'HEARING_PARENTING',
  '부모교육': 'HEARING_PARENTING',
  '면접교섭': 'HEARING_PARENTING',
  // 선고기일 (HEARING_JUDGMENT)
  '판결선고': 'HEARING_JUDGMENT',
  '선고': 'HEARING_JUDGMENT',
  '결정선고': 'HEARING_JUDGMENT',
};

// 이벤트 제목에서 기일 유형 추출
function parseHearingType(summary: string): { type: string; detail: string } {
  const match = summary.match(/^\[([^\]]+)\]/);
  if (!match) {
    return { type: 'HEARING_MAIN', detail: '변론기일' };
  }

  const typeText = match[1];

  for (const [keyword, hearingType] of Object.entries(HEARING_TYPE_MAP)) {
    if (typeText.includes(keyword)) {
      return { type: hearingType, detail: typeText };
    }
  }

  return { type: 'HEARING_MAIN', detail: typeText };
}

// 이벤트 제목에서 사건번호 추출 (공백 제거)
function parseCaseNumber(summary: string): string | null {
  const match = summary.match(/\]\s*(\d{4}\s*[가-힣]+\s*\d+)/);
  if (!match) return null;
  return match[1].replace(/\s+/g, '');
}

// 장소에서 법원 + 법정 정보 추출
function parseLocation(location: string | null | undefined): {
  courtName: string | null;
  courtroom: string | null;
} {
  if (!location) {
    return { courtName: null, courtroom: null };
  }

  const match = location.match(/^(.+?)\s*(제?\d+호?\s*(법정|조정실|심문실)?.*)$/);
  if (match) {
    return {
      courtName: match[1].trim(),
      courtroom: match[2].trim(),
    };
  }

  return { courtName: location, courtroom: null };
}

// court_case_number로 사건 찾기 (테넌트 필터 포함)
async function findCaseByNumber(
  supabase: ReturnType<typeof createAdminClient> extends Promise<infer T> ? T : never,
  caseNumber: string,
  tenantId?: string
): Promise<string | null> {
  // 정확히 일치하는 경우
  let query = supabase
    .from('legal_cases')
    .select('id')
    .eq('court_case_number', caseNumber)
    .limit(1);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: exactMatch } = await query;

  if (exactMatch && exactMatch.length > 0) {
    return exactMatch[0].id;
  }

  // LIKE 검색
  let likeQuery = supabase
    .from('legal_cases')
    .select('id, court_case_number')
    .ilike('court_case_number', `%${caseNumber}%`);

  if (tenantId) {
    likeQuery = likeQuery.eq('tenant_id', tenantId);
  }

  const { data: likeMatch } = await likeQuery;

  if (likeMatch && likeMatch.length === 1) {
    return likeMatch[0].id;
  }

  return null;
}

// =====================================================
// 테넌트 기반 함수들
// =====================================================

/**
 * 테넌트별 캘린더 이벤트 동기화
 */
export async function syncTenantCalendarEvents(tenantId: string) {
  const supabase = await createAdminClient();

  // 1. 테넌트 연동 정보 가져오기
  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    throw new Error('Google Calendar not connected');
  }

  // 2. 캘린더 ID 확인
  const settings = integration.settings as GoogleCalendarSettings;
  const calendarId = settings?.calendarId;
  if (!calendarId) {
    throw new Error('Calendar ID not configured');
  }

  // 3. 액세스 토큰 가져오기 (필요시 자동 갱신)
  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');
  if (!accessToken) {
    throw new Error('Failed to get access token');
  }

  // 4. 캘린더 이벤트 가져오기 (1년 전 ~ 6개월 후)
  const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const events = await getCalendarEvents(accessToken, calendarId, {
    timeMin,
    timeMax,
    maxResults: 500,
  });

  // 5. 각 이벤트 처리
  let matched = 0;
  let pending = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      const googleEventId = event.id;
      const summary = event.summary || '';
      const description = event.description || '';
      const location = event.location || '';

      const { type: hearingType, detail: hearingDetail } = parseHearingType(summary);
      const caseNumber = parseCaseNumber(summary);
      const { courtName, courtroom } = parseLocation(location);

      const startDateTime = event.start?.dateTime || event.start?.date;
      if (!startDateTime) {
        skipped++;
        continue;
      }

      const hearingDateTime = startDateTime.includes('T')
        ? startDateTime
        : `${startDateTime}T00:00:00`;

      // 사건번호로 legal_cases에서 case_id 찾기 (테넌트 필터 적용)
      let caseId: string | null = null;
      if (caseNumber) {
        caseId = await findCaseByNumber(supabase, caseNumber, tenantId);
      }

      // 기존 court_hearings에서 확인
      const { data: existingHearing } = await supabase
        .from('court_hearings')
        .select('id')
        .eq('google_event_id', googleEventId)
        .single();

      // 기존 pending에서 확인
      const { data: existingPending } = await supabase
        .from('pending_calendar_events')
        .select('id, match_attempts')
        .eq('google_event_id', googleEventId)
        .eq('tenant_id', tenantId)
        .single();

      if (caseId) {
        // 사건 찾음 -> court_hearings에 저장/업데이트
        const hearingData = {
          google_event_id: googleEventId,
          case_id: caseId,
          case_number: caseNumber,
          hearing_type: hearingType,
          hearing_date: hearingDateTime,
          location: courtroom ? `${courtName} ${courtroom}` : courtName,
          status: 'SCHEDULED',
          notes: `[${hearingDetail}] ${summary}`,
          updated_at: new Date().toISOString(),
        };

        if (existingHearing) {
          await supabase
            .from('court_hearings')
            .update(hearingData)
            .eq('id', existingHearing.id);
          updated++;
        } else {
          await supabase
            .from('court_hearings')
            .insert({
              ...hearingData,
              created_at: new Date().toISOString(),
            });
          matched++;
        }

        // pending에 있었다면 삭제
        if (existingPending) {
          await supabase
            .from('pending_calendar_events')
            .delete()
            .eq('id', existingPending.id);
        }
      } else {
        // 사건 못 찾음 -> pending_calendar_events에 저장
        const pendingData = {
          google_event_id: googleEventId,
          tenant_id: tenantId,
          summary,
          description,
          location,
          start_datetime: hearingDateTime,
          parsed_case_number: caseNumber,
          parsed_hearing_type: hearingType,
          parsed_hearing_detail: hearingDetail,
          parsed_court_name: courtName,
          parsed_courtroom: courtroom,
          status: 'pending',
          match_attempted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existingPending) {
          await supabase
            .from('pending_calendar_events')
            .update({
              ...pendingData,
              match_attempts: existingPending.match_attempts + 1,
            })
            .eq('id', existingPending.id);
        } else {
          await supabase
            .from('pending_calendar_events')
            .insert({
              ...pendingData,
              match_attempts: 1,
              created_at: new Date().toISOString(),
            });
        }

        // 기존에 case_id 없이 court_hearings에 있었다면 삭제
        if (existingHearing) {
          await supabase
            .from('court_hearings')
            .delete()
            .eq('id', existingHearing.id);
        }

        pending++;
      }
    } catch (err) {
      console.error('[TenantSync] Error processing event:', event.id, err);
      skipped++;
    }
  }

  return {
    total: events.length,
    matched,
    updated,
    pending,
    skipped,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * 테넌트별 매칭 안 된 항목 재시도
 */
export async function retryTenantPendingEvents(tenantId: string) {
  const supabase = await createAdminClient();

  const { data: pendingEvents, error } = await supabase
    .from('pending_calendar_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  if (error || !pendingEvents) {
    return { error: 'Failed to fetch pending events' };
  }

  let matched = 0;
  let stillPending = 0;

  for (const event of pendingEvents) {
    const caseNumber = event.parsed_case_number;
    if (!caseNumber) {
      stillPending++;
      continue;
    }

    const caseId = await findCaseByNumber(supabase, caseNumber, tenantId);

    if (caseId) {
      await supabase
        .from('court_hearings')
        .insert({
          google_event_id: event.google_event_id,
          case_id: caseId,
          case_number: caseNumber,
          hearing_type: event.parsed_hearing_type,
          hearing_date: event.start_datetime,
          location: event.parsed_courtroom
            ? `${event.parsed_court_name} ${event.parsed_courtroom}`
            : event.parsed_court_name,
          status: 'SCHEDULED',
          notes: `[${event.parsed_hearing_detail}] ${event.summary}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('pending_calendar_events')
        .update({
          status: 'matched',
          matched_case_id: caseId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      matched++;
    } else {
      await supabase
        .from('pending_calendar_events')
        .update({
          match_attempted_at: new Date().toISOString(),
          match_attempts: event.match_attempts + 1,
        })
        .eq('id', event.id);

      stillPending++;
    }
  }

  return {
    total: pendingEvents.length,
    matched,
    stillPending,
    retriedAt: new Date().toISOString(),
  };
}

/**
 * 테넌트별 웹훅 등록
 */
export async function registerTenantCalendarWatch(tenantId: string) {
  const supabase = await createAdminClient();

  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    throw new Error('Google Calendar not connected');
  }

  const settings = integration.settings as GoogleCalendarSettings;
  const calendarId = settings?.calendarId;
  if (!calendarId) {
    throw new Error('Calendar ID not configured');
  }

  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');
  if (!accessToken) {
    throw new Error('Failed to get access token');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`;
  const channelId = `tenant-${tenantId.slice(0, 8)}-${Date.now()}`;

  const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: String(expiration),
    },
  });

  // 웹훅 정보를 tenant_integrations에 저장
  await supabase
    .from('tenant_integrations')
    .update({
      webhook_channel_id: response.data.id,
      webhook_resource_id: response.data.resourceId,
      webhook_expiry: new Date(Number(response.data.expiration)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_calendar');

  return response.data;
}

/**
 * 테넌트별 웹훅 해제
 */
export async function stopTenantCalendarWatch(tenantId: string) {
  const supabase = await createAdminClient();

  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration) {
    return { message: 'No integration found' };
  }

  if (!integration.webhook_channel_id || !integration.webhook_resource_id) {
    return { message: 'No active watch' };
  }

  const accessToken = await getTenantAccessToken(tenantId, 'google_calendar');
  if (!accessToken) {
    throw new Error('Failed to get access token');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.channels.stop({
    requestBody: {
      id: integration.webhook_channel_id,
      resourceId: integration.webhook_resource_id,
    },
  });

  // 웹훅 정보 삭제
  await supabase
    .from('tenant_integrations')
    .update({
      webhook_channel_id: null,
      webhook_resource_id: null,
      webhook_expiry: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_calendar');

  return { message: 'Watch stopped' };
}

/**
 * 테넌트별 매칭 안 된 이벤트 목록 조회
 */
export async function getTenantPendingEvents(tenantId: string) {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('pending_calendar_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('start_datetime', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

// =====================================================
// 하위 호환성을 위한 기존 함수들 (deprecated)
// 새 코드에서는 Tenant 버전 사용 권장
// =====================================================

// 하드코딩된 캘린더 ID (deprecated, 마이그레이션 후 제거 예정)
const LEGACY_CALENDAR_ID = 'c9c4c72938d6a219203535e47a8c4bbf70aa8b87f88ff16889e33e224cf8bcd1@group.calendar.google.com';

/** @deprecated Use tenant_integrations instead */
async function getStoredTokens() {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'google_calendar_tokens')
    .single();

  if (error || !data) {
    return null;
  }

  return JSON.parse(data.value);
}

/** @deprecated Use tenant_integrations instead */
async function updateTokens(tokens: { access_token: string; expiry_date?: number }) {
  const supabase = await createAdminClient();
  const existingTokens = await getStoredTokens();

  await supabase
    .from('app_settings')
    .update({
      value: JSON.stringify({
        ...existingTokens,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'google_calendar_tokens');
}

/**
 * @deprecated Use syncTenantCalendarEvents(tenantId) instead
 */
export async function syncCalendarEvents() {
  const supabase = await createAdminClient();

  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  let accessToken = tokens.access_token;

  if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
    if (!tokens.refresh_token) {
      throw new Error('Token expired, please reconnect');
    }
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    accessToken = newTokens.access_token!;
    await updateTokens({
      access_token: newTokens.access_token!,
      expiry_date: newTokens.expiry_date || undefined,
    });
  }

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const events = await getCalendarEvents(accessToken, LEGACY_CALENDAR_ID, {
    timeMin,
    timeMax,
    maxResults: 250,
  });

  let matched = 0;
  let pending = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      const googleEventId = event.id;
      const summary = event.summary || '';
      const description = event.description || '';
      const location = event.location || '';

      const { type: hearingType, detail: hearingDetail } = parseHearingType(summary);
      const caseNumber = parseCaseNumber(summary);
      const { courtName, courtroom } = parseLocation(location);

      const startDateTime = event.start?.dateTime || event.start?.date;
      if (!startDateTime) {
        skipped++;
        continue;
      }

      const hearingDateTime = startDateTime.includes('T')
        ? startDateTime
        : `${startDateTime}T00:00:00`;

      let caseId: string | null = null;
      if (caseNumber) {
        caseId = await findCaseByNumber(supabase, caseNumber);
      }

      const { data: existingHearing } = await supabase
        .from('court_hearings')
        .select('id')
        .eq('google_event_id', googleEventId)
        .single();

      const { data: existingPending } = await supabase
        .from('pending_calendar_events')
        .select('id, match_attempts')
        .eq('google_event_id', googleEventId)
        .single();

      if (caseId) {
        const hearingData = {
          google_event_id: googleEventId,
          case_id: caseId,
          case_number: caseNumber,
          hearing_type: hearingType,
          hearing_date: hearingDateTime,
          location: courtroom ? `${courtName} ${courtroom}` : courtName,
          status: 'SCHEDULED',
          notes: `[${hearingDetail}] ${summary}`,
          updated_at: new Date().toISOString(),
        };

        if (existingHearing) {
          await supabase
            .from('court_hearings')
            .update(hearingData)
            .eq('id', existingHearing.id);
          updated++;
        } else {
          await supabase
            .from('court_hearings')
            .insert({
              ...hearingData,
              created_at: new Date().toISOString(),
            });
          matched++;
        }

        if (existingPending) {
          await supabase
            .from('pending_calendar_events')
            .delete()
            .eq('id', existingPending.id);
        }
      } else {
        const pendingData = {
          google_event_id: googleEventId,
          summary,
          description,
          location,
          start_datetime: hearingDateTime,
          parsed_case_number: caseNumber,
          parsed_hearing_type: hearingType,
          parsed_hearing_detail: hearingDetail,
          parsed_court_name: courtName,
          parsed_courtroom: courtroom,
          status: 'pending',
          match_attempted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (existingPending) {
          await supabase
            .from('pending_calendar_events')
            .update({
              ...pendingData,
              match_attempts: existingPending.match_attempts + 1,
            })
            .eq('id', existingPending.id);
        } else {
          await supabase
            .from('pending_calendar_events')
            .insert({
              ...pendingData,
              match_attempts: 1,
              created_at: new Date().toISOString(),
            });
        }

        if (existingHearing) {
          await supabase
            .from('court_hearings')
            .delete()
            .eq('id', existingHearing.id);
        }

        pending++;
      }
    } catch (err) {
      console.error('[Sync] Error processing event:', event.id, err);
      skipped++;
    }
  }

  return {
    total: events.length,
    matched,
    updated,
    pending,
    skipped,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * @deprecated Use retryTenantPendingEvents(tenantId) instead
 */
export async function retryPendingEvents() {
  const supabase = await createAdminClient();

  const { data: pendingEvents, error } = await supabase
    .from('pending_calendar_events')
    .select('*')
    .eq('status', 'pending');

  if (error || !pendingEvents) {
    return { error: 'Failed to fetch pending events' };
  }

  let matched = 0;
  let stillPending = 0;

  for (const event of pendingEvents) {
    const caseNumber = event.parsed_case_number;
    if (!caseNumber) {
      stillPending++;
      continue;
    }

    const caseId = await findCaseByNumber(supabase, caseNumber);

    if (caseId) {
      await supabase
        .from('court_hearings')
        .insert({
          google_event_id: event.google_event_id,
          case_id: caseId,
          case_number: caseNumber,
          hearing_type: event.parsed_hearing_type,
          hearing_date: event.start_datetime,
          location: event.parsed_courtroom
            ? `${event.parsed_court_name} ${event.parsed_courtroom}`
            : event.parsed_court_name,
          status: 'SCHEDULED',
          notes: `[${event.parsed_hearing_detail}] ${event.summary}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      await supabase
        .from('pending_calendar_events')
        .update({
          status: 'matched',
          matched_case_id: caseId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      matched++;
    } else {
      await supabase
        .from('pending_calendar_events')
        .update({
          match_attempted_at: new Date().toISOString(),
          match_attempts: event.match_attempts + 1,
        })
        .eq('id', event.id);

      stillPending++;
    }
  }

  return {
    total: pendingEvents.length,
    matched,
    stillPending,
    retriedAt: new Date().toISOString(),
  };
}

/**
 * @deprecated Use registerTenantCalendarWatch(tenantId) instead
 */
export async function registerCalendarWatch() {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  let accessToken = tokens.access_token;

  if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
    if (!tokens.refresh_token) {
      throw new Error('Token expired');
    }
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    accessToken = newTokens.access_token!;
    await updateTokens({
      access_token: newTokens.access_token!,
      expiry_date: newTokens.expiry_date || undefined,
    });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google-calendar`;
  const channelId = `theyool-calendar-${Date.now()}`;

  const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const response = await calendar.events.watch({
    calendarId: LEGACY_CALENDAR_ID,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: String(expiration),
    },
  });

  const supabase = await createAdminClient();
  await supabase
    .from('app_settings')
    .upsert({
      key: 'google_calendar_watch',
      value: JSON.stringify({
        channelId: response.data.id,
        resourceId: response.data.resourceId,
        expiration: response.data.expiration,
      }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  return response.data;
}

/**
 * @deprecated Use stopTenantCalendarWatch(tenantId) instead
 */
export async function stopCalendarWatch() {
  const supabase = await createAdminClient();

  const { data: watchData } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'google_calendar_watch')
    .single();

  if (!watchData) {
    return { message: 'No active watch' };
  }

  const watch = JSON.parse(watchData.value);

  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: tokens.access_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.channels.stop({
    requestBody: {
      id: watch.channelId,
      resourceId: watch.resourceId,
    },
  });

  await supabase
    .from('app_settings')
    .delete()
    .eq('key', 'google_calendar_watch');

  return { message: 'Watch stopped' };
}

/**
 * @deprecated Use getTenantPendingEvents(tenantId) instead
 */
export async function getPendingEvents() {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from('pending_calendar_events')
    .select('*')
    .eq('status', 'pending')
    .order('start_datetime', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}
