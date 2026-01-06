import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  const caseId = '149f787d-2508-4f3d-a81f-0b49e3fde1de';

  // Check legal_case
  const { data: lc } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_name, enc_cs_no, scourt_case_name, scourt_wmonid, scourt_last_sync')
    .eq('id', caseId)
    .single();

  console.log('=== legal_case ===');
  console.log(lc);

  // Check snapshot by legal_case_id
  const { data: snapshot, error } = await supabase
    .from('scourt_case_snapshots')
    .select('id, case_number, legal_case_id, basic_info, scraped_at')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1);

  // Check snapshot by case_number
  const { data: snapshotByNumber } = await supabase
    .from('scourt_case_snapshots')
    .select('id, case_number, legal_case_id, scraped_at')
    .eq('case_number', lc?.court_case_number || '')
    .order('scraped_at', { ascending: false })
    .limit(1);

  console.log('\n=== snapshot by case_number ===');
  console.log(snapshotByNumber);

  console.log('\n=== snapshot by legal_case_id ===');
  if (error) {
    console.log('Error:', error.message);
  } else if (snapshot && snapshot.length > 0) {
    const s = snapshot[0];
    console.log('snapshot_id:', s.id);
    console.log('case_number:', s.case_number);
    console.log('legal_case_id:', s.legal_case_id);
    console.log('scraped_at:', s.scraped_at);
    console.log('basic_info keys:', Object.keys(s.basic_info || {}));
  } else {
    console.log('No snapshot found linked to this case');
  }

  // Check scourt_case_info
  const { data: caseInfo } = await supabase
    .from('scourt_case_info')
    .select('*')
    .eq('legal_case_id', caseId);

  console.log('\n=== scourt_case_info ===');
  console.log(caseInfo);
}

check();
