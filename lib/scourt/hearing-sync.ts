/**
 * SCOURT 기일 → court_hearings 동기화 서비스
 *
 * SCOURT에서 스크래핑한 기일 정보를 court_hearings 테이블에 자동 저장
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { HearingInfo } from './change-detector';
import type { HearingType, HearingResult, HearingStatus } from '@/types/court-hearing';

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
  '속행': 'CONTINUED',
  '변론속행': 'CONTINUED',
  '조정속행': 'CONTINUED',
  '종결': 'CONCLUDED',
  '변론종결': 'CONCLUDED',
  '조정종결': 'CONCLUDED',
  '조정성립': 'CONCLUDED',
  '연기': 'POSTPONED',
  '기일연기': 'POSTPONED',
  '취하': 'DISMISSED',
  '각하': 'DISMISSED',
  '기각': 'DISMISSED',
};

// ============================================================
// 유틸리티 함수
// ============================================================

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

  // 부분 매칭 시도
  const resultLC = scourtResult.toLowerCase();
  if (resultLC.includes('속행')) return 'CONTINUED';
  if (resultLC.includes('종결') || resultLC.includes('성립')) return 'CONCLUDED';
  if (resultLC.includes('연기')) return 'POSTPONED';
  if (resultLC.includes('취하') || resultLC.includes('각하') || resultLC.includes('기각')) return 'DISMISSED';

  return null;
}

/**
 * SCOURT 날짜/시간 → ISO datetime 변환
 * @param date SCOURT 날짜 형식: "2025.01.15"
 * @param time SCOURT 시간 형식: "10:30" 또는 ""
 * @returns ISO datetime string: "2025-01-15T10:30:00+09:00"
 */
export function parseHearingDateTime(date: string, time: string): string {
  // 날짜 파싱 (YYYY.MM.DD)
  const dateMatch = date.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${date}`);
  }

  const [, year, month, day] = dateMatch;
  const dateStr = `${year}-${month}-${day}`;

  // 시간 파싱 (HH:MM)
  let timeStr = '09:00:00'; // 기본값
  if (time && time.trim()) {
    const timeMatch = time.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const [, hour, minute] = timeMatch;
      timeStr = `${hour.padStart(2, '0')}:${minute}:00`;
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
// 동기화 서비스
// ============================================================

/**
 * SCOURT 기일 목록을 court_hearings 테이블에 동기화
 *
 * @param caseNumber 사건번호 (예: "2024드단26718")
 * @param hearings SCOURT에서 추출한 기일 목록
 * @returns 동기화 결과
 */
export async function syncHearingsToCourtHearings(
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

      // 기존 기일 확인 (해시로 검색)
      const { data: existing } = await supabase
        .from('court_hearings')
        .select('id, result, status')
        .eq('case_number', caseNumber)
        .eq('scourt_hearing_hash', hash)
        .single();

      if (existing) {
        // 기존 기일이 있으면 결과/상태만 업데이트 (변경된 경우만)
        const needsUpdate =
          (hearingResult && existing.result !== hearingResult) ||
          (hearingStatus !== existing.status);

        if (needsUpdate) {
          const updateData: Record<string, unknown> = {};
          if (hearingResult && existing.result !== hearingResult) {
            updateData.result = hearingResult;
          }
          if (hearingStatus !== existing.status) {
            updateData.status = hearingStatus;
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
        // 새 기일 생성
        const insertData = {
          case_number: caseNumber,
          hearing_type: hearingType,
          hearing_date: hearingDateTime,
          location: hearing.location || null,
          result: hearingResult,
          status: hearingStatus,
          source: 'scourt',
          scourt_hearing_hash: hash,
          notes: `SCOURT 동기화: ${hearing.type}`,
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${hearing.date} ${hearing.type}: ${errorMsg}`);
      result.success = false;
    }
  }

  return result;
}
