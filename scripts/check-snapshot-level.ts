/**
 * 기존 스냅샷의 심급 정보 확인
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('=== 기존 스냅샷의 심급 정보 확인 ===\n');

  // 2025르10595 사건의 스냅샷 확인
  const { data: cases } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, case_level, scourt_raw_data')
    .like('court_case_number', '2025%르%')
    .limit(5);

  if (!cases || cases.length === 0) {
    console.log('르 사건 없음');
    return;
  }

  for (const c of cases) {
    console.log(`\n=== ${c.court_case_number} (${c.case_name}) ===`);
    console.log('  case_level DB:', c.case_level);

    // raw_data 확인
    if (c.scourt_raw_data) {
      const raw = c.scourt_raw_data as any;
      console.log('  csDvsNm (raw):', raw?.csDvsNm);
      console.log('  caseLevel (raw):', raw?.caseLevel);
      console.log('  caseLevelDesc (raw):', raw?.caseLevelDesc);
      console.log('  lwstDvsCd (raw):', raw?.lwstDvsCd);
    }

    // 스냅샷 확인
    const { data: snapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('basic_info, case_level, case_level_desc, sync_status')
      .eq('legal_case_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshot) {
      console.log('  [스냅샷]');
      console.log('    case_level:', snapshot.case_level);
      console.log('    case_level_desc:', snapshot.case_level_desc);
      console.log('    sync_status:', snapshot.sync_status);
      const basicInfo = snapshot.basic_info as any;
      if (basicInfo) {
        console.log('    lwstDvsCd:', basicInfo.lwstDvsCd);
        console.log('    cfupMarkNm:', basicInfo.cfupMarkNm);
        console.log('    csDvsNm:', basicInfo.csDvsNm);
      }
    } else {
      console.log('  스냅샷 없음');
    }
  }

  // 다른 심급 사건도 확인 (드단)
  console.log('\n\n=== 드단 사건 확인 ===');
  const { data: drCases } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, case_level')
    .like('court_case_number', '%드단%')
    .limit(3);

  if (drCases) {
    for (const c of drCases) {
      console.log(`\n${c.court_case_number}: case_level = ${c.case_level}`);
    }
  }
}

main().catch(console.error);
