import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CASE_ID = 'e7affc63-ad4e-48e8-bd10-3ae1f5c9752e';

async function main() {
  // 1. 사건 기본 정보
  const { data: lc } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_name')
    .eq('id', CASE_ID)
    .single();
  console.log('=== 사건 정보 ===');
  console.log(lc);

  // 2. case_parties 테이블
  const { data: parties } = await supabase
    .from('case_parties')
    .select('*')
    .eq('case_id', CASE_ID);
  console.log('\n=== case_parties 테이블 ===');
  console.log(JSON.stringify(parties, null, 2));

  // 3. scourt_case_snapshots에서 raw_data 확인
  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('raw_data')
    .eq('legal_case_id', CASE_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshot?.raw_data) {
    console.log('\n=== SCOURT raw_data 당사자 (dlt_btprtCttLst) ===');
    const rawData = snapshot.raw_data as Record<string, unknown>;
    if (rawData.dlt_btprtCttLst) {
      console.log(JSON.stringify(rawData.dlt_btprtCttLst, null, 2));
    } else {
      console.log('dlt_btprtCttLst 없음');
      console.log('Available dlt_ keys:', Object.keys(rawData).filter(k => k.startsWith('dlt_')));
    }
  } else {
    console.log('\n스냅샷 없음');
  }
}

main().catch(console.error);
