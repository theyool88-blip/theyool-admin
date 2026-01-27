/**
 * 대량 등록 시스템 버그 수정 검증 스크립트
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function verify() {
  console.log('=== 대량 등록 시스템 버그 수정 검증 ===\n');

  // 1. case_clients 데이터 확인
  console.log('📋 1. case_clients 데이터 확인\n');

  const { data: caseClients, error: ccError } = await supabase
    .from('case_clients')
    .select(`
      id,
      case_id,
      client_id,
      is_primary_client,
      clients!client_id (name)
    `)
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (ccError) {
    console.error('case_clients 조회 오류:', ccError.message);
  } else {
    console.log(`총 ${caseClients?.length || 0}건:`);
    caseClients?.forEach(cc => {
      const clientName = (cc.clients as unknown as { name: string } | null)?.name || 'N/A';
      console.log(`  - case_id: ${cc.case_id?.substring(0,8)}... | client: ${clientName} | primary: ${cc.is_primary_client}`);
    });
  }

  // 2. legal_cases 캐시 필드 확인 (트리거 동작 여부)
  console.log('\n📋 2. legal_cases 캐시 필드 확인 (트리거 동작 여부)\n');

  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, primary_client_id, primary_client_name')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (casesError) {
    console.error('legal_cases 조회 오류:', casesError.message);
  } else {
    const withClient = cases?.filter(c => c.primary_client_id) || [];
    const withoutClient = cases?.filter(c => !c.primary_client_id) || [];
    console.log(`총 ${cases?.length || 0}건 중:`);
    console.log(`  - primary_client_id 있음: ${withClient.length}건`);
    console.log(`  - primary_client_id 없음: ${withoutClient.length}건`);
    console.log('\n최근 5건:');
    cases?.slice(0, 5).forEach(c => {
      console.log(`  - ${c.court_case_number} | client_id: ${c.primary_client_id ? '✓' : '✗'} | name: ${c.primary_client_name || '없음'}`);
    });
  }

  // 3. 스냅샷 저장 확인
  console.log('\n📋 3. 스냅샷 저장 확인\n');

  const { data: snapshots, error: snapError } = await supabase
    .from('scourt_case_snapshots')
    .select(`
      id,
      legal_case_id,
      case_number,
      basic_info,
      progress,
      legal_cases!legal_case_id (court_case_number)
    `)
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  if (snapError) {
    console.error('스냅샷 조회 오류:', snapError.message);
  } else {
    console.log(`총 ${snapshots?.length || 0}건:`);
    snapshots?.forEach(s => {
      const caseNum = (s.legal_cases as unknown as { court_case_number: string } | null)?.court_case_number || s.case_number;
      const hasBasic = s.basic_info ? '✓' : '✗';
      const progressCount = Array.isArray(s.progress) ? s.progress.length : 0;
      console.log(`  - ${caseNum} | basic_info: ${hasBasic} | progress: ${progressCount}건`);
    });
  }

  // 4. legal_cases.scourt_last_snapshot_id 연결 확인
  console.log('\n📋 4. legal_cases.scourt_last_snapshot_id 연결 확인\n');

  const { data: linkedCases, error: linkedError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, scourt_enc_cs_no, scourt_last_snapshot_id')
    .eq('tenant_id', TENANT_ID)
    .not('scourt_enc_cs_no', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (linkedError) {
    console.error('연결 확인 오류:', linkedError.message);
  } else {
    const withSnapshot = linkedCases?.filter(c => c.scourt_last_snapshot_id) || [];
    const withoutSnapshot = linkedCases?.filter(c => !c.scourt_last_snapshot_id) || [];
    console.log(`대법원 연동된 사건 ${linkedCases?.length || 0}건 중:`);
    console.log(`  - snapshot_id 있음: ${withSnapshot.length}건`);
    console.log(`  - snapshot_id 없음: ${withoutSnapshot.length}건`);

    if (withoutSnapshot.length > 0) {
      console.log('\n⚠️ snapshot_id 없는 사건 (기존 데이터 - 수정 전 등록된 것):');
      withoutSnapshot.slice(0, 3).forEach(c => {
        console.log(`  - ${c.court_case_number}`);
      });
    }
  }

  console.log('\n=== 검증 완료 ===');
  console.log('\n💡 참고: 위 데이터는 기존에 등록된 사건들입니다.');
  console.log('   수정된 로직은 새로 대량 등록하는 사건에 적용됩니다.');
}

verify().catch(console.error);
