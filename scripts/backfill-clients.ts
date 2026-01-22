/**
 * 기존 사건의 의뢰인 일괄 생성
 * - primary_client_name은 있지만 primary_client_id가 없는 사건 처리
 * - 의뢰인 테이블에 생성 후 사건에 연결
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       의뢰인 일괄 생성 (Backfill)');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. primary_client_name은 있지만 primary_client_id가 없는 사건 조회
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, case_name, primary_client_name')
    .eq('tenant_id', TENANT_ID)
    .is('primary_client_id', null)
    .not('primary_client_name', 'is', null);

  if (casesError) {
    console.error('사건 조회 실패:', casesError.message);
    return;
  }

  console.log('처리 대상 사건:', cases?.length || 0, '건\n');

  if (!cases || cases.length === 0) {
    console.log('처리할 사건이 없습니다.');
    return;
  }

  // 2. 고유 의뢰인 이름 추출
  const uniqueClientNames = [...new Set(cases.map(c => c.primary_client_name).filter(Boolean))] as string[];
  console.log('고유 의뢰인 이름:', uniqueClientNames.length, '명\n');

  // 3. 기존 의뢰인 조회
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('tenant_id', TENANT_ID);

  const existingClientMap = new Map<string, string>(
    existingClients?.map(c => [c.name, c.id]) || []
  );
  console.log('기존 의뢰인:', existingClientMap.size, '명\n');

  // 4. 새 의뢰인 생성
  let createdClients = 0;
  let failedClients = 0;
  const clientMap = new Map<string, string>(existingClientMap);

  for (const name of uniqueClientNames) {
    if (clientMap.has(name)) continue;

    const { data: newClient, error } = await supabase
      .from('clients')
      .insert([{ tenant_id: TENANT_ID, name }])
      .select('id')
      .single();

    if (error) {
      console.error('  ❌ 의뢰인 생성 실패:', name, '-', error.message);
      failedClients++;
    } else {
      clientMap.set(name, newClient.id);
      createdClients++;
    }
  }

  console.log('새로 생성된 의뢰인:', createdClients, '명');
  console.log('생성 실패:', failedClients, '명\n');

  // 5. 사건에 의뢰인 연결
  let linkedCases = 0;
  let failedLinks = 0;

  for (const legalCase of cases) {
    const clientId = clientMap.get(legalCase.primary_client_name);
    if (!clientId) {
      failedLinks++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('legal_cases')
      .update({ primary_client_id: clientId })
      .eq('id', legalCase.id);

    if (updateError) {
      console.error('  ❌ 연결 실패:', legalCase.case_name, '-', updateError.message);
      failedLinks++;
    } else {
      linkedCases++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ 의뢰인 연결 완료:', linkedCases, '건');
  console.log('❌ 연결 실패:', failedLinks, '건');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
