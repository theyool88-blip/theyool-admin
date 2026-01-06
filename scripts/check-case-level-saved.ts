/**
 * 심급 정보 저장 확인
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // 2025르10595 사건의 case_level 확인
  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, case_level, enc_cs_no, scourt_last_sync')
    .eq('id', '5e50cc05-42fb-4605-8875-7a2b88e0b9fb')
    .single();

  if (error) {
    console.error('에러:', error);
    return;
  }

  console.log('=== 사건 정보 ===');
  console.log('ID:', data.id);
  console.log('사건명:', data.case_name);
  console.log('사건번호:', data.court_case_number);
  console.log('심급 (case_level):', data.case_level || '(없음)');
  console.log('encCsNo:', data.enc_cs_no ? data.enc_cs_no.substring(0, 30) + '...' : '(없음)');
  console.log('마지막 동기화:', data.scourt_last_sync);
}

main().catch(console.error);
