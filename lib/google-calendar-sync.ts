import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getCalendarEvents, refreshAccessToken } from '@/lib/google-calendar';

// 케이스노트 캘린더 ID
const CASENOTE_CALENDAR_ID = 'c9c4c72938d6a219203535e47a8c4bbf70aa8b87f88ff16889e33e224cf8bcd1@group.calendar.google.com';

// 기일 유형 매핑
const HEARING_TYPE_MAP: Record<string, string> = {
  '변론': 'HEARING_MAIN',
  '변론준비': 'HEARING_MAIN',
  '증인신문': 'HEARING_MAIN',
  '조정': 'HEARING_MEDIATION',
  '심문': 'HEARING_INTERIM',
  '가처분': 'HEARING_INTERIM',
  '가압류': 'HEARING_INTERIM',
  '조사': 'HEARING_INVESTIGATION',
  '면접조사': 'HEARING_INVESTIGATION',
  '상담': 'HEARING_PARENTING',
  '교육': 'HEARING_PARENTING',
  '판결선고': 'HEARING_JUDGMENT',
  '선고': 'HEARING_JUDGMENT',
};

// 이벤트 제목에서 기일 유형 추출
// 예: "[변론] 2025르10433 [전자]이혼 및 재산분할" -> { type: "HEARING_MAIN", detail: "변론" }
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
// 예: "[변론] 2025르10433 [전자]이혼 및 재산분할" -> "2025르10433"
// 예: "[조정] 2025 느 2080 [전자]이혼 등" -> "2025느2080"
function parseCaseNumber(summary: string): string | null {
  // [유형] 다음의 사건번호 패턴 (숫자 + 한글 + 숫자, 공백 허용)
  const match = summary.match(/\]\s*(\d{4}\s*[가-힣]+\s*\d+)/);
  if (!match) return null;

  // 공백 제거
  return match[1].replace(/\s+/g, '');
}

// 장소에서 법원 + 법정 정보 추출
// 예: "수원가정법원 평택지원 제42호 법정" -> { courtName: "수원가정법원 평택지원", courtroom: "제42호 법정" }
function parseLocation(location: string | null | undefined): {
  courtName: string | null;
  courtroom: string | null;
} {
  if (!location) {
    return { courtName: null, courtroom: null };
  }

  // "제XXX호 법정/조정실/심문실" 패턴 찾기
  const match = location.match(/^(.+?)\s*(제?\d+호?\s*(법정|조정실|심문실)?.*)$/);
  if (match) {
    return {
      courtName: match[1].trim(),
      courtroom: match[2].trim(),
    };
  }

  return { courtName: location, courtroom: null };
}

// 저장된 토큰 가져오기
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

// 토큰 업데이트
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

// court_case_number로 사건 찾기 (공백 무시하고 검색)
async function findCaseByNumber(supabase: any, caseNumber: string): Promise<string | null> {
  // 정확히 일치하는 경우
  const { data: exactMatch } = await supabase
    .from('legal_cases')
    .select('id')
    .eq('court_case_number', caseNumber)
    .single();

  if (exactMatch) {
    return exactMatch.id;
  }

  // court_case_number에 법원명이 포함된 경우를 위해 LIKE 검색
  // 예: "평택지원 2024가단51071" 에서 "2024가단51071" 검색
  const { data: likeMatch } = await supabase
    .from('legal_cases')
    .select('id, court_case_number')
    .ilike('court_case_number', `%${caseNumber}%`);

  if (likeMatch && likeMatch.length === 1) {
    return likeMatch[0].id;
  }

  return null;
}

// 캘린더 이벤트를 court_hearings에 동기화
export async function syncCalendarEvents() {
  const supabase = await createAdminClient();

  // 1. 토큰 가져오기
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  let accessToken = tokens.access_token;

  // 2. 토큰 만료 확인 및 갱신
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

  // 3. 캘린더 이벤트 가져오기 (오늘부터 6개월)
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const events = await getCalendarEvents(accessToken, CASENOTE_CALENDAR_ID, {
    timeMin,
    timeMax,
    maxResults: 250,
  });

  // 4. 각 이벤트 처리
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

      // 파싱
      const { type: hearingType, detail: hearingDetail } = parseHearingType(summary);
      const caseNumber = parseCaseNumber(summary);
      const { courtName, courtroom } = parseLocation(location);

      // 날짜/시간 파싱
      const startDateTime = event.start?.dateTime || event.start?.date;
      if (!startDateTime) {
        skipped++;
        continue;
      }

      const hearingDateTime = startDateTime.includes('T')
        ? startDateTime
        : `${startDateTime}T00:00:00`;

      // 사건번호로 legal_cases에서 case_id 찾기
      let caseId: string | null = null;
      if (caseNumber) {
        caseId = await findCaseByNumber(supabase, caseNumber);
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
        // 사건 못 찾음 -> pending_calendar_events에만 저장 (court_hearings에 저장 안 함)
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
          // 이미 pending에 있으면 업데이트
          await supabase
            .from('pending_calendar_events')
            .update({
              ...pendingData,
              match_attempts: existingPending.match_attempts + 1,
            })
            .eq('id', existingPending.id);
        } else {
          // pending에 없으면 새로 추가
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

// 매칭 안 된 항목만 재시도
export async function retryPendingEvents() {
  const supabase = await createAdminClient();

  // pending 상태인 이벤트들 가져오기
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

    // 사건 찾기
    const caseId = await findCaseByNumber(supabase, caseNumber);

    if (caseId) {
      // court_hearings에 저장
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

      // pending에서 삭제 또는 상태 변경
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
      // 여전히 매칭 안 됨
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

// Push Notification 등록
export async function registerCalendarWatch() {
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google Calendar not connected');
  }

  let accessToken = tokens.access_token;

  // 토큰 만료 확인 및 갱신
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

  // 7일 후 만료
  const expiration = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const response = await calendar.events.watch({
    calendarId: CASENOTE_CALENDAR_ID,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      expiration: String(expiration),
    },
  });

  // 채널 정보 저장 (나중에 갱신/취소용)
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

// Push Notification 해제
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

  // 저장된 watch 정보 삭제
  await supabase
    .from('app_settings')
    .delete()
    .eq('key', 'google_calendar_watch');

  return { message: 'Watch stopped' };
}

// 매칭 안 된 이벤트 목록 조회
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
