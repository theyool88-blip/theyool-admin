/**
 * SCOURT 기일 → court_hearings 동기화 서비스
 *
 * SCOURT에서 스크래핑한 기일 정보를 court_hearings 테이블에 자동 저장
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { HearingInfo } from './change-detector';
import type { HearingType, HearingResult, HearingStatus } from '@/types/court-hearing';
import {
  createTenantCalendarEvent,
  updateTenantCalendarEvent,
  deleteTenantCalendarEvent,
  getTenantIntegration,
  type CalendarEventData,
} from '@/lib/google-calendar';

// ============================================================
// 타입 정의
// ============================================================

export interface HearingSyncResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ============================================================
// SCOURT 기일명 → HearingType 매핑
// ============================================================

const SCOURT_HEARING_TYPE_MAP: Record<string, HearingType> = {
  // 변론기일
  '변론': 'HEARING_MAIN',
  '변론기일': 'HEARING_MAIN',
  '변론준비': 'HEARING_MAIN',
  '변론준비기일': 'HEARING_MAIN',
  '증인신문': 'HEARING_MAIN',
  '증인신문기일': 'HEARING_MAIN',
  '당사자신문': 'HEARING_MAIN',
  '당사자신문기일': 'HEARING_MAIN',
  '공판': 'HEARING_MAIN',
  '공판기일': 'HEARING_MAIN',

  // 조정기일
  '조정': 'HEARING_MEDIATION',
  '조정기일': 'HEARING_MEDIATION',
  '조정조치': 'HEARING_MEDIATION',
  '화해권고': 'HEARING_MEDIATION',
  '화해권고기일': 'HEARING_MEDIATION',
  '조정회부': 'HEARING_MEDIATION',

  // 조사기일
  '조사': 'HEARING_INVESTIGATION',
  '조사기일': 'HEARING_INVESTIGATION',
  '면접조사': 'HEARING_INVESTIGATION',
  '사실조회': 'HEARING_INVESTIGATION',
  '현장조사': 'HEARING_INVESTIGATION',

  // 선고기일
  '선고': 'HEARING_JUDGMENT',
  '선고기일': 'HEARING_JUDGMENT',
  '판결선고': 'HEARING_JUDGMENT',
  '판결선고기일': 'HEARING_JUDGMENT',
  '결정선고': 'HEARING_JUDGMENT',

  // 심문기일 (보전처분 등)
  '심문': 'HEARING_INTERIM',
  '심문기일': 'HEARING_INTERIM',
  '가처분': 'HEARING_INTERIM',
  '가처분심문': 'HEARING_INTERIM',
  '가압류': 'HEARING_INTERIM',
  '보전처분': 'HEARING_INTERIM',

  // 상담/교육 기일
  '상담': 'HEARING_PARENTING',
  '양육상담': 'HEARING_PARENTING',
  '부모교육': 'HEARING_PARENTING',
  '면접교섭': 'HEARING_PARENTING',
};

// ============================================================
// SCOURT 기일결과 → HearingResult 매핑
// ============================================================

const SCOURT_RESULT_MAP: Record<string, HearingResult> = {
  '속행': 'continued',
  '변론속행': 'continued',
  '조정속행': 'continued',
  '종결': 'settled',
  '변론종결': 'settled',
  '조정종결': 'settled',
  '조정성립': 'settled',
  '화해성립': 'settled',
  '연기': 'adjourned',
  '기일연기': 'adjourned',
  '휴정': 'adjourned',
  '기일변경': 'adjourned',
  '변경': 'adjourned',
  '취하': 'withdrawn',
  '각하': 'dismissed',
  '기각': 'dismissed',
  '판결선고': 'judgment',
  '선고': 'judgment',
  '변론재개': 'continued',
  '쌍방조사': 'other',
  '조정불성립': 'dismissed',
  '조정에갈음하는결정': 'judgment',
  '불출석': 'other',
  '출석': 'other',
};

// ============================================================
// 화상 참여자 타입
// ============================================================

export type VideoParticipantSide = 'plaintiff_side' | 'defendant_side' | 'both' | null;

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * SCOURT 기일명에서 화상 참여자 측 추출
 * - 쌍방 화상장치 → 'both'
 * - 일방 화상장치 → raw_data에서 추출 필요 (이 함수에서는 'unknown' placeholder)
 * - 화상 아님 → null
 */
export function extractVideoTypeFromScourtType(scourtType: string): 'both' | 'one_way' | null {
  if (scourtType.includes('쌍방 화상장치') || scourtType.includes('쌍방화상장치')) {
    return 'both';
  }
  if (scourtType.includes('일방 화상장치') || scourtType.includes('일방화상장치')) {
    return 'one_way';
  }
  return null;
}

/**
 * SCOURT 기일명 → HearingType 변환
 */
export function mapScourtHearingType(scourtType: string): HearingType {
  // 정확한 매칭 시도
  if (SCOURT_HEARING_TYPE_MAP[scourtType]) {
    return SCOURT_HEARING_TYPE_MAP[scourtType];
  }

  // 부분 매칭 시도
  const typeLC = scourtType.toLowerCase();
  if (typeLC.includes('변론') || typeLC.includes('공판') || typeLC.includes('신문')) {
    return 'HEARING_MAIN';
  }
  if (typeLC.includes('조정') || typeLC.includes('화해')) {
    return 'HEARING_MEDIATION';
  }
  if (typeLC.includes('조사') || typeLC.includes('면접')) {
    return 'HEARING_INVESTIGATION';
  }
  if (typeLC.includes('선고') || typeLC.includes('판결')) {
    return 'HEARING_JUDGMENT';
  }
  if (typeLC.includes('심문') || typeLC.includes('보전') || typeLC.includes('가처분') || typeLC.includes('가압류')) {
    return 'HEARING_INTERIM';
  }
  if (typeLC.includes('상담') || typeLC.includes('교육') || typeLC.includes('양육')) {
    return 'HEARING_PARENTING';
  }

  // 기본값
  return 'HEARING_MAIN';
}

/**
 * SCOURT 기일결과 → HearingResult 변환
 */
export function mapScourtResult(scourtResult: string | undefined): HearingResult | null {
  if (!scourtResult || scourtResult.trim() === '') {
    return null;
  }

  // 정확한 매칭 시도
  if (SCOURT_RESULT_MAP[scourtResult]) {
    return SCOURT_RESULT_MAP[scourtResult];
  }

  // 부분 매칭 시도 (순서 중요: 더 구체적인 패턴이 먼저)
  const resultLC = scourtResult.toLowerCase();
  if (resultLC.includes('속행') || resultLC.includes('재개')) return 'continued';
  if (resultLC.includes('불성립')) return 'dismissed';  // MUST be before '성립'
  if (resultLC.includes('종결') || resultLC.includes('성립') || resultLC.includes('화해')) return 'settled';
  if (resultLC.includes('연기') || resultLC.includes('휴정') || resultLC.includes('변경')) return 'adjourned';
  if (resultLC.includes('취하')) return 'withdrawn';
  if (resultLC.includes('각하') || resultLC.includes('기각')) return 'dismissed';
  if (resultLC.includes('선고') || resultLC.includes('판결')) return 'judgment';

  return 'other';  // Changed from null - any non-empty unmapped result gets 'other'
}

/**
 * SCOURT 날짜/시간 → ISO datetime 변환
 * @param date SCOURT 날짜 형식: "2025.01.15" 또는 "20250115" (YYYYMMDD)
 * @param time SCOURT 시간 형식: "10:30" 또는 "1030" (HHMM) 또는 ""
 * @returns ISO datetime string: "2025-01-15T10:30:00+09:00"
 */
export function parseHearingDateTime(date: string, time: string): string {
  let year: string, month: string, day: string;

  // 날짜 파싱 (YYYY.MM.DD 또는 YYYYMMDD)
  const dotMatch = date.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const dashMatch = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const compactMatch = date.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (dotMatch) {
    [, year, month, day] = dotMatch;
  } else if (dashMatch) {
    [, year, month, day] = dashMatch;
  } else if (compactMatch) {
    [, year, month, day] = compactMatch;
  } else {
    throw new Error(`Invalid date format: ${date}`);
  }

  const dateStr = `${year}-${month}-${day}`;

  // 시간 파싱 (HH:MM 또는 HHMM)
  let timeStr = '09:00:00'; // 기본값
  if (time && time.trim()) {
    const colonMatch = time.match(/(\d{1,2}):(\d{2})/);
    const compactTimeMatch = time.match(/^(\d{2})(\d{2})$/);

    if (colonMatch) {
      const [, hour, minute] = colonMatch;
      timeStr = `${hour.padStart(2, '0')}:${minute}:00`;
    } else if (compactTimeMatch) {
      const [, hour, minute] = compactTimeMatch;
      timeStr = `${hour}:${minute}:00`;
    }
  }

  // 한국 시간대 (KST)
  return `${dateStr}T${timeStr}+09:00`;
}

/**
 * 기일 해시 생성 (중복 방지용)
 * @param hearing HearingInfo
 * @returns SHA256 해시 (64자)
 */
export function generateHearingHash(hearing: HearingInfo): string {
  const content = `${hearing.date}|${hearing.time}|${hearing.type}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 기일명에서 회차 추출
 * "제1회 변론기일" → 1
 * "제2회 변론준비기일" → 2
 * "조정기일" → null
 */
export function extractHearingSequence(typeName: string): number | null {
  const match = typeName.match(/제(\d+)회/);
  return match ? parseInt(match[1]) : null;
}

/**
 * 기일 상태 결정
 */
function determineHearingStatus(hearing: HearingInfo): HearingStatus {
  // 결과가 있으면 완료
  if (hearing.result && hearing.result.trim()) {
    return 'COMPLETED';
  }

  // 날짜 확인
  const dateMatch = hearing.date.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!dateMatch) return 'SCHEDULED';

  const hearingDate = new Date(
    parseInt(dateMatch[1]),
    parseInt(dateMatch[2]) - 1,
    parseInt(dateMatch[3])
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 과거 날짜이면 완료
  if (hearingDate < today) {
    return 'COMPLETED';
  }

  return 'SCHEDULED';
}

// ============================================================
// 화상 참여자 추출 (raw_data에서)
// ============================================================

/**
 * SCOURT raw_data에서 화상 참여자 측 추출
 * @param caseNumber 사건번호
 * @param supabase Supabase 클라이언트
 * @returns 화상 참여자 측 ('plaintiff_side' | 'defendant_side' | null)
 */
async function extractVideoParticipantFromRawData(
  caseNumber: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<VideoParticipantSide> {
  try {
    const { data: snapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('raw_data')
      .eq('case_number', caseNumber)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot?.raw_data) {
      return null;
    }

    const rawStr = JSON.stringify(snapshot.raw_data as Record<string, unknown>);

    // [화상장치] 마커가 포함된 대리인/당사자 찾기
    const videoMarkerMatches = rawStr.match(/"agntNm":"[^"]*\[화상장치\][^"]*"/g);

    if (!videoMarkerMatches || videoMarkerMatches.length === 0) {
      return null;
    }

    // 해당 대리인의 구분(원고/피고) 확인
    for (const match of videoMarkerMatches) {
      const idx = rawStr.indexOf(match);
      // 주변 컨텍스트에서 agntDvsNm 추출
      const context = rawStr.substring(idx, Math.min(rawStr.length, idx + match.length + 100));
      const dvsMatch = context.match(/"agntDvsNm":"([^"]*)"/);

      if (dvsMatch) {
        const dvsNm = dvsMatch[1];
        if (dvsNm.includes('원고')) {
          return 'plaintiff_side';
        }
        if (dvsNm.includes('피고')) {
          return 'defendant_side';
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[extractVideoParticipantFromRawData] Error:', error);
    return null;
  }
}

// ============================================================
// 동기화 서비스
// ============================================================

/**
 * SCOURT 기일 목록을 court_hearings 테이블에 동기화
 *
 * @param caseId 사건 UUID (legal_cases.id)
 * @param caseNumber 사건번호 (예: "2024드단26718")
 * @param hearings SCOURT에서 추출한 기일 목록
 * @returns 동기화 결과
 */
export async function syncHearingsToCourtHearings(
  caseId: string,
  caseNumber: string,
  hearings: HearingInfo[]
): Promise<HearingSyncResult> {
  const result: HearingSyncResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (!hearings || hearings.length === 0) {
    return result;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  for (const hearing of hearings) {
    try {
      const hash = generateHearingHash(hearing);
      const hearingType = mapScourtHearingType(hearing.type);
      const hearingResult = mapScourtResult(hearing.result);
      const hearingStatus = determineHearingStatus(hearing);
      const hearingDateTime = parseHearingDateTime(hearing.date, hearing.time);

      // 기존 기일 확인 (case_id + 해시로 검색)
      const { data: existing } = await supabase
        .from('court_hearings')
        .select('id, result, status, scourt_type_raw, scourt_raw_data')
        .eq('case_id', caseId)
        .eq('scourt_hearing_hash', hash)
        .single();

      if (existing) {
        // SCOURT 원본 결과 변경 감지
        const existingRawResult = (existing.scourt_raw_data as Record<string, unknown>)?.result as string | undefined;
        const normalizedNew = hearing.result?.trim() || '';
        const normalizedOld = existingRawResult?.trim() || '';
        const rawResultChanged = normalizedNew !== normalizedOld;

        const needsUpdate =
          (hearingResult && existing.result !== hearingResult) ||
          (hearingStatus !== existing.status) ||
          (!existing.scourt_type_raw && hearing.type) ||
          rawResultChanged;

        if (needsUpdate) {
          const updateData: Record<string, unknown> = {};
          if (hearingResult && existing.result !== hearingResult) {
            updateData.result = hearingResult;
          }
          if (hearingStatus !== existing.status) {
            updateData.status = hearingStatus;
          }
          // SCOURT 원본 기일명이 없으면 채워주기 (마이그레이션 전 데이터 대응)
          if (!existing.scourt_type_raw && hearing.type) {
            updateData.scourt_type_raw = hearing.type;
          }

          // SCOURT 원본 데이터는 항상 최신으로 업데이트 (결과 변경 반영)
          if (rawResultChanged || (!existing.scourt_type_raw && hearing.type)) {
            updateData.scourt_raw_data = {
              type: hearing.type,
              result: hearing.result,
              location: hearing.location,
              sequence: extractHearingSequence(hearing.type || ''),
            };
          }

          const { error: updateError } = await supabase
            .from('court_hearings')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) {
            throw updateError;
          }
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // 화상 참여자 정보 추출
        let videoParticipantSide: VideoParticipantSide = null;
        const videoType = extractVideoTypeFromScourtType(hearing.type || '');

        if (videoType === 'both') {
          videoParticipantSide = 'both';
        } else if (videoType === 'one_way') {
          // 일방 화상기일인 경우 raw_data에서 참여자 측 추출
          videoParticipantSide = await extractVideoParticipantFromRawData(caseNumber, supabase);
        }

        // 새 기일 생성
        const insertData = {
          case_id: caseId,              // UUID (필수)
          case_number: caseNumber,      // 사건번호 (참조용)
          hearing_type: hearingType,
          hearing_date: hearingDateTime,
          location: hearing.location || null,
          result: hearingResult,
          status: hearingStatus,
          scourt_hearing_hash: hash,
          // SCOURT 원본 데이터 저장 (나의사건검색 동일 표시용)
          scourt_type_raw: hearing.type || null,              // "제1회 변론기일"
          scourt_raw_data: {
            type: hearing.type,
            result: hearing.result,
            location: hearing.location,
            sequence: extractHearingSequence(hearing.type || ''),
          },
          notes: null,  // 원본은 scourt_type_raw에 저장
          // 화상 참여자 정보
          video_participant_side: videoParticipantSide,
        };

        const { error: insertError } = await supabase
          .from('court_hearings')
          .insert(insertData);

        if (insertError) {
          // 중복 해시 에러는 스킵 (동시성 이슈 대응)
          if (insertError.code === '23505') {
            result.skipped++;
          } else {
            throw insertError;
          }
        } else {
          result.created++;
        }
      }
    } catch (error) {
      console.error('[syncHearingsToCourtHearings] Error:', error);
      const errorMsg = error instanceof Error
        ? error.message
        : (typeof error === 'object' && error !== null)
          ? JSON.stringify(error)
          : String(error);
      result.errors.push(`${hearing.date} ${hearing.type}: ${errorMsg}`);
      result.success = false;
    }
  }

  return result;
}

// ============================================================
// Google Calendar 동기화
// ============================================================

/**
 * HearingType → 표시명 변환 (캘린더 이벤트 제목용)
 */
const HEARING_TYPE_DISPLAY: Record<HearingType, string> = {
  'HEARING_MAIN': '변론기일',
  'HEARING_MEDIATION': '조정기일',
  'HEARING_INVESTIGATION': '조사기일',
  'HEARING_JUDGMENT': '선고기일',
  'HEARING_INTERIM': '심문기일',
  'HEARING_PARENTING': '양육상담',
  'HEARING_LAWYER_MEETING': '변호사 면담',
  'HEARING_SENTENCE': '선고기일',
  'HEARING_TRIAL': '공판기일',
  'HEARING_EXAMINATION': '심문기일',
};

/**
 * court_hearing → Google Calendar 이벤트 생성
 */
export async function syncHearingToGoogleCalendar(
  tenantId: string,
  hearingId: string,
  caseNumber: string,
  hearingType: HearingType,
  hearingDate: string,      // ISO datetime
  location?: string | null
): Promise<{ eventId: string; htmlLink: string } | null> {
  // 테넌트 연동 정보 확인
  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    console.log('[syncHearingToGoogleCalendar] Google Calendar not connected');
    return null;
  }

  // 캘린더 ID 확인 (설정에서)
  const calendarId = (integration.settings as Record<string, string>)?.calendarId || 'primary';

  // 이벤트 데이터 생성
  const startDate = new Date(hearingDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1시간

  const eventData: CalendarEventData = {
    summary: `[${HEARING_TYPE_DISPLAY[hearingType] || hearingType}] ${caseNumber}`,
    description: `사건번호: ${caseNumber}\n기일 유형: ${HEARING_TYPE_DISPLAY[hearingType] || hearingType}`,
    location: location || undefined,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Asia/Seoul',
    },
    colorId: '7',  // 청록색 (법원 기일용)
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 * 24 },  // 1일 전
        { method: 'popup', minutes: 60 },        // 1시간 전
      ],
    },
  };

  const result = await createTenantCalendarEvent(tenantId, calendarId, eventData);

  if (result) {
    // google_event_id 업데이트
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from('court_hearings')
      .update({ google_event_id: result.id })
      .eq('id', hearingId);

    console.log('[syncHearingToGoogleCalendar] Created:', result.id);
    return { eventId: result.id, htmlLink: result.htmlLink };
  }

  return null;
}

/**
 * Google Calendar 이벤트 삭제
 */
export async function deleteHearingFromGoogleCalendar(
  tenantId: string,
  googleEventId: string
): Promise<boolean> {
  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    return false;
  }

  const calendarId = (integration.settings as Record<string, string>)?.calendarId || 'primary';
  return deleteTenantCalendarEvent(tenantId, calendarId, googleEventId);
}

/**
 * Google Calendar 이벤트 업데이트
 */
export async function updateHearingInGoogleCalendar(
  tenantId: string,
  googleEventId: string,
  hearingType: HearingType,
  caseNumber: string,
  hearingDate: string,
  location?: string | null
): Promise<boolean> {
  const integration = await getTenantIntegration(tenantId, 'google_calendar');
  if (!integration || integration.status !== 'connected') {
    return false;
  }

  const calendarId = (integration.settings as Record<string, string>)?.calendarId || 'primary';

  const startDate = new Date(hearingDate);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  return updateTenantCalendarEvent(tenantId, calendarId, googleEventId, {
    summary: `[${HEARING_TYPE_DISPLAY[hearingType] || hearingType}] ${caseNumber}`,
    location: location || undefined,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'Asia/Seoul',
    },
  });
}
