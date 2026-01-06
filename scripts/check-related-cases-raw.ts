/**
 * SCOURT API 연관사건 필드 확인
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  // 최근 스냅샷의 raw data 확인
  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('*')
    .eq('legal_case_id', '5e50cc05-42fb-4605-8875-7a2b88e0b9fb')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!snapshot) {
    console.log('스냅샷 없음');
    return;
  }

  console.log('=== 스냅샷 정보 ===');
  console.log('Case Number:', snapshot.case_number);
  console.log('Court Code:', snapshot.court_code);
  console.log('\n=== Related Cases ===');
  console.log(JSON.stringify(snapshot.related_cases, null, 2));
  console.log('\n=== Lower Court ===');
  console.log(JSON.stringify(snapshot.lower_court, null, 2));
  console.log('\n=== Basic Info (심급 관련) ===');
  const basicInfo = snapshot.basic_info as any;
  if (basicInfo) {
    console.log('lwstDvsCd (심급코드):', basicInfo.lwstDvsCd);
    console.log('cfupMarkNm (상소표시):', basicInfo.cfupMarkNm);
    console.log('csMrgTypNm (병합유형):', basicInfo.csMrgTypNm);
  }

  // legal_cases의 scourt_raw_data 확인
  const { data: legalCase } = await supabase
    .from('legal_cases')
    .select('scourt_raw_data')
    .eq('id', '5e50cc05-42fb-4605-8875-7a2b88e0b9fb')
    .single();

  if (legalCase?.scourt_raw_data) {
    console.log('\n=== SCOURT Raw Data (dlt_reltCsLst) ===');
    const rawData = legalCase.scourt_raw_data as any;
    console.log('dlt_reltCsLst:', JSON.stringify(rawData?.dlt_reltCsLst, null, 2));
  }
}

main().catch(console.error);
