/**
 * SCOURT 사건 열기 테스트
 */

import { createClient } from '@supabase/supabase-js';
import { openCaseInBrowser } from '../lib/scourt/case-opener';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqqyipnlkmmprfgygauk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // enc_cs_no가 있는 사건 조회 (API와 동일한 필드 포함)
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, enc_cs_no, scourt_wmonid, court_name, opponent_name')
    .not('enc_cs_no', 'is', null)
    .limit(3);

  if (error) {
    console.error('DB 조회 에러:', error);
    return;
  }

  console.log('enc_cs_no가 있는 사건들:');
  for (const c of cases || []) {
    console.log(`  - ${c.court_case_number} (${c.id})`);
    console.log(`    enc_cs_no: ${c.enc_cs_no?.substring(0, 40)}...`);
    console.log(`    wmonid: ${c.scourt_wmonid?.substring(0, 20)}...`);
    console.log(`    court_name: ${c.court_name}`);
    console.log(`    opponent_name: ${c.opponent_name}`);
  }

  if (!cases || cases.length === 0) {
    console.log('enc_cs_no가 있는 사건이 없습니다.');
    return;
  }

  // 첫 번째 사건으로 테스트
  const testCase = cases[0];
  console.log(`\n🧪 테스트 사건: ${testCase.court_case_number}`);

  console.log('🚀 브라우저 열기 시작...');
  const result = await openCaseInBrowser({
    caseNumber: testCase.court_case_number,
    encCsNo: testCase.enc_cs_no,
    wmonid: testCase.scourt_wmonid,
    courtName: testCase.court_name,
    partyName: testCase.opponent_name,  // 당사자명 (상대방)
  });

  console.log('결과:', result);

  // 브라우저 유지 (30초)
  console.log('\n⏳ 브라우저를 30초간 유지합니다...');
  await new Promise(r => setTimeout(r, 30000));

  console.log('✅ 테스트 완료');
  process.exit(0);
}

main().catch(console.error);
