/**
 * 배치 임포트 상태 확인 스크립트
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수 미설정');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('       배치 임포트 상태 확인');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. clients 테이블 확인
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, created_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('📋 최근 등록된 의뢰인 (clients 테이블)');
  console.log('─'.repeat(50));
  if (clientsError) {
    console.log('  Error:', clientsError.message);
  } else if (!clients?.length) {
    console.log('  ❌ 의뢰인 없음');
  } else {
    clients.forEach(c => console.log(`  ✅ ${c.name}`));
  }

  // 2. legal_cases에서 primary_client_id 확인
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, primary_client_id, scourt_enc_cs_no, scourt_last_snapshot_id')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n📋 최근 등록된 사건 (legal_cases 테이블)');
  console.log('─'.repeat(50));
  if (casesError) {
    console.log('  Error:', casesError.message);
  } else {
    const withClient = cases?.filter(c => c.primary_client_id) || [];
    const withoutClient = cases?.filter(c => !c.primary_client_id) || [];
    const withEncCsNo = cases?.filter(c => c.scourt_enc_cs_no) || [];
    const withSnapshot = cases?.filter(c => c.scourt_last_snapshot_id) || [];

    console.log(`  총 ${cases?.length || 0}건 확인:`);
    console.log(`  - 의뢰인 연결됨: ${withClient.length}건`);
    console.log(`  - 의뢰인 미연결: ${withoutClient.length}건`);
    console.log(`  - enc_cs_no 있음: ${withEncCsNo.length}건`);
    console.log(`  - 스냅샷 있음: ${withSnapshot.length}건`);

    if (withoutClient.length > 0) {
      console.log('\n  ⚠️ 의뢰인 미연결 사건:');
      withoutClient.slice(0, 5).forEach(c => {
        console.log(`    - ${c.court_case_number || c.id}`);
      });
    }
  }

  // 3. scourt_case_snapshots 확인
  const { count: snapshotCount } = await supabase
    .from('scourt_case_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  console.log('\n📋 대법원 스냅샷 (scourt_case_snapshots)');
  console.log('─'.repeat(50));
  console.log(`  총 스냅샷 수: ${snapshotCount || 0}개`);

  // 4. 전체 사건 수 vs 스냅샷 수 비교
  const { count: totalCasesWithEnc } = await supabase
    .from('legal_cases')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .not('scourt_enc_cs_no', 'is', null);

  console.log(`  enc_cs_no 있는 사건: ${totalCasesWithEnc || 0}건`);

  if ((totalCasesWithEnc || 0) > (snapshotCount || 0)) {
    console.log(`  ⚠️ 스냅샷 누락: ${(totalCasesWithEnc || 0) - (snapshotCount || 0)}건`);
  }

  // 5. case_clients 테이블 확인
  const { data: caseClients, error: ccError } = await supabase
    .from('case_clients')
    .select('id, case_id, client_id, is_primary_client')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n📋 case_clients 테이블 (사건-의뢰인 연결)');
  console.log('─'.repeat(50));
  if (ccError) {
    console.log('  Error:', ccError.message);
  } else if (!caseClients?.length) {
    console.log('  ❌ case_clients 데이터 없음 (연결 안됨)');
  } else {
    const primaryClients = caseClients.filter(cc => cc.is_primary_client);
    const nonPrimaryClients = caseClients.filter(cc => !cc.is_primary_client);
    console.log(`  총 ${caseClients.length}건:`);
    console.log(`  - is_primary_client=true: ${primaryClients.length}건`);
    console.log(`  - is_primary_client=false: ${nonPrimaryClients.length}건`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
