/**
 * 기일 데이터 백필 스크립트
 *
 * 스냅샷에는 있지만 court_hearings에 없는 기일 데이터를 모두 동기화
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type HearingType = 'HEARING_MAIN' | 'HEARING_MEDIATION' | 'HEARING_INVESTIGATION' |
                   'HEARING_JUDGMENT' | 'HEARING_INTERIM' | 'HEARING_PARENTING' | 'HEARING_LAWYER_MEETING';
type HearingResult = 'CONTINUED' | 'CONCLUDED' | 'POSTPONED' | 'DISMISSED';
type HearingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

interface HearingInfo {
  date: string;
  time: string;
  type: string;
  location?: string;
  result?: string;
}

interface SnapshotHearing {
  trmDt?: string;
  trmHm?: string;
  trmNm?: string;
  trmPntNm?: string;
  rslt?: string;
}

const SCOURT_HEARING_TYPE_MAP: Record<string, HearingType> = {
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
  '조정': 'HEARING_MEDIATION',
  '조정기일': 'HEARING_MEDIATION',
  '조정조치': 'HEARING_MEDIATION',
  '화해권고': 'HEARING_MEDIATION',
  '화해권고기일': 'HEARING_MEDIATION',
  '조정회부': 'HEARING_MEDIATION',
  '조사': 'HEARING_INVESTIGATION',
  '조사기일': 'HEARING_INVESTIGATION',
  '면접조사': 'HEARING_INVESTIGATION',
  '사실조회': 'HEARING_INVESTIGATION',
  '현장조사': 'HEARING_INVESTIGATION',
  '선고': 'HEARING_JUDGMENT',
  '선고기일': 'HEARING_JUDGMENT',
  '판결선고': 'HEARING_JUDGMENT',
  '판결선고기일': 'HEARING_JUDGMENT',
  '결정선고': 'HEARING_JUDGMENT',
  '심문': 'HEARING_INTERIM',
  '심문기일': 'HEARING_INTERIM',
  '가처분': 'HEARING_INTERIM',
  '가처분심문': 'HEARING_INTERIM',
  '가압류': 'HEARING_INTERIM',
  '보전처분': 'HEARING_INTERIM',
  '상담': 'HEARING_PARENTING',
  '양육상담': 'HEARING_PARENTING',
  '부모교육': 'HEARING_PARENTING',
  '면접교섭': 'HEARING_PARENTING',
};

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

function mapScourtHearingType(scourtType: string): HearingType {
  if (SCOURT_HEARING_TYPE_MAP[scourtType]) {
    return SCOURT_HEARING_TYPE_MAP[scourtType];
  }

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

  return 'HEARING_MAIN';
}

function mapScourtResult(scourtResult: string | undefined): HearingResult | null {
  if (!scourtResult || scourtResult.trim() === '') {
    return null;
  }

  if (SCOURT_RESULT_MAP[scourtResult]) {
    return SCOURT_RESULT_MAP[scourtResult];
  }

  const resultLC = scourtResult.toLowerCase();
  if (resultLC.includes('속행')) return 'CONTINUED';
  if (resultLC.includes('종결') || resultLC.includes('성립')) return 'CONCLUDED';
  if (resultLC.includes('연기')) return 'POSTPONED';
  if (resultLC.includes('취하') || resultLC.includes('각하') || resultLC.includes('기각')) return 'DISMISSED';

  return null;
}

function parseHearingDateTime(date: string, time: string): string {
  let year: string, month: string, day: string;

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

  let timeStr = '09:00:00';
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

  return `${dateStr}T${timeStr}+09:00`;
}

function generateHearingHash(hearing: HearingInfo): string {
  const content = `${hearing.date}|${hearing.time}|${hearing.type}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

function determineHearingStatus(hearing: HearingInfo): HearingStatus {
  if (hearing.result && hearing.result.trim()) {
    return 'COMPLETED';
  }

  const dateMatch = hearing.date.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  const compactMatch = hearing.date.match(/^(\d{4})(\d{2})(\d{2})$/);

  let year: number, month: number, day: number;
  if (dateMatch) {
    year = parseInt(dateMatch[1]);
    month = parseInt(dateMatch[2]) - 1;
    day = parseInt(dateMatch[3]);
  } else if (compactMatch) {
    year = parseInt(compactMatch[1]);
    month = parseInt(compactMatch[2]) - 1;
    day = parseInt(compactMatch[3]);
  } else {
    return 'SCHEDULED';
  }

  const hearingDate = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (hearingDate < today) {
    return 'COMPLETED';
  }

  return 'SCHEDULED';
}

async function syncHearingsForCase(
  caseId: string,
  caseNumber: string,
  snapHearings: SnapshotHearing[]
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const result = { created: 0, skipped: 0, errors: [] as string[] };

  const hearingsForSync: HearingInfo[] = snapHearings.map((h) => ({
    date: h.trmDt || '',
    time: h.trmHm || '',
    type: h.trmNm || '',
    location: h.trmPntNm || '',
    result: h.rslt || '',
  }));

  for (const hearing of hearingsForSync) {
    try {
      const hash = generateHearingHash(hearing);
      const hearingType = mapScourtHearingType(hearing.type);
      const hearingResult = mapScourtResult(hearing.result);
      const hearingStatus = determineHearingStatus(hearing);
      const hearingDateTime = parseHearingDateTime(hearing.date, hearing.time);

      // 기존 확인
      const { data: existing } = await supabase
        .from('court_hearings')
        .select('id')
        .eq('case_id', caseId)
        .eq('scourt_hearing_hash', hash)
        .single();

      if (existing) {
        result.skipped++;
        continue;
      }

      const insertData = {
        case_id: caseId,
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
        if (insertError.code === '23505') {
          result.skipped++;
        } else {
          result.errors.push(`${hearing.date}: ${insertError.message}`);
        }
      } else {
        result.created++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${hearing.date}: ${msg}`);
    }
  }

  return result;
}

async function main() {
  console.log('=== 기일 데이터 백필 시작 ===\n');

  // 1. court_hearings에 있는 case_id 목록
  const { data: existingHearings } = await supabase
    .from('court_hearings')
    .select('case_id');
  const existingCaseIds = new Set((existingHearings || []).map(h => h.case_id));

  console.log(`기존 court_hearings에 등록된 사건: ${existingCaseIds.size}건\n`);

  // 2. 스냅샷에서 기일이 있는 모든 사건
  const { data: snapshots } = await supabase
    .from('scourt_case_snapshots')
    .select('legal_case_id, hearings')
    .order('scraped_at', { ascending: false });

  const allSnapshotsWithHearings = (snapshots || []).filter(s => {
    const hearings = s.hearings as SnapshotHearing[] | null;
    return hearings && hearings.length > 0;
  });

  // 중복 제거 (legal_case_id 기준 최신 스냅샷만)
  const uniqueSnapshots = new Map<string, typeof allSnapshotsWithHearings[0]>();
  for (const snap of allSnapshotsWithHearings) {
    if (!uniqueSnapshots.has(snap.legal_case_id)) {
      uniqueSnapshots.set(snap.legal_case_id, snap);
    }
  }

  // court_hearings에 없는 사건 필터링
  const missingSnapshots = Array.from(uniqueSnapshots.values()).filter(
    s => !existingCaseIds.has(s.legal_case_id)
  );

  console.log(`스냅샷에 기일이 있는 사건: ${uniqueSnapshots.size}건`);
  console.log(`동기화 필요 사건: ${missingSnapshots.length}건\n`);

  if (missingSnapshots.length === 0) {
    console.log('동기화할 사건이 없습니다.');
    return;
  }

  // 3. 사건 정보 일괄 조회
  const caseIds = missingSnapshots.map(s => s.legal_case_id);
  const { data: cases } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number')
    .in('id', caseIds);

  const caseMap = new Map<string, { case_name: string; court_case_number: string }>();
  for (const c of cases || []) {
    caseMap.set(c.id, { case_name: c.case_name, court_case_number: c.court_case_number });
  }

  // 4. 동기화 실행
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let processedCases = 0;

  for (const snap of missingSnapshots) {
    const caseId = snap.legal_case_id;
    const caseInfo = caseMap.get(caseId);
    const caseNumber = caseInfo?.court_case_number || '';
    const snapHearings = snap.hearings as SnapshotHearing[];

    processedCases++;
    process.stdout.write(`\r[${processedCases}/${missingSnapshots.length}] ${caseNumber || caseId.substring(0, 8)}...`);

    const result = await syncHearingsForCase(caseId, caseNumber, snapHearings);

    totalCreated += result.created;
    totalSkipped += result.skipped;
    totalErrors += result.errors.length;

    if (result.errors.length > 0) {
      console.log(`\n  에러: ${result.errors.join(', ')}`);
    }
  }

  console.log('\n\n=== 백필 완료 ===');
  console.log(`처리 사건: ${processedCases}건`);
  console.log(`생성된 기일: ${totalCreated}건`);
  console.log(`스킵된 기일: ${totalSkipped}건`);
  console.log(`에러: ${totalErrors}건`);

  // 5. 최종 확인
  const { data: finalHearings } = await supabase
    .from('court_hearings')
    .select('id', { count: 'exact' });

  console.log(`\n최종 court_hearings 총 건수: ${finalHearings?.length || 0}건`);
}

main().catch(console.error);
