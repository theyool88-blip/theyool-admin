import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('=== case_parties 컬럼 테스트 ===');
  
  // 테스트용 사건 조회
  const { data: testCase } = await supabase
    .from('legal_cases')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .limit(1)
    .single();

  if (!testCase) {
    console.log('테스트 사건 없음');
    return;
  }

  console.log('테스트 사건 ID:', testCase.id);

  // case_parties 최소 필드 삽입 테스트
  const { error: err1 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      party_name: 'TEST_PARTY',
      party_type: 'plaintiff',
    });
  console.log('최소 필드:', err1?.message || '✅ 성공');

  // retainer_fee 테스트 (case_parties)
  const { error: err2 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      party_name: 'TEST_PARTY2',
      party_type: 'plaintiff',
      retainer_fee: 1000000,
    });
  console.log('retainer_fee:', err2?.message || '✅ 성공');

  console.log('\n=== case_clients 컬럼 테스트 ===');
  
  // 테스트용 의뢰인 조회
  const { data: testClient } = await supabase
    .from('clients')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .limit(1)
    .single();

  if (!testClient) {
    console.log('테스트 의뢰인 없음');
    return;
  }

  console.log('테스트 의뢰인 ID:', testClient.id);

  // case_clients 최소 필드 삽입 테스트
  const { error: err3 } = await supabase
    .from('case_clients')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      client_id: testClient.id,
    });
  console.log('최소 필드:', err3?.message || '✅ 성공');

  // case_clients retainer_fee 테스트
  const { error: err4 } = await supabase
    .from('case_clients')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      client_id: testClient.id,
      retainer_fee: 1000000,
    });
  console.log('retainer_fee:', err4?.message || '✅ 성공');

  // case_clients is_primary_client 테스트
  const { error: err5 } = await supabase
    .from('case_clients')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      client_id: testClient.id,
      is_primary_client: true,
    });
  console.log('is_primary_client:', err5?.message || '✅ 성공');

  // case_clients linked_party_id 테스트
  const { error: err6 } = await supabase
    .from('case_clients')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      client_id: testClient.id,
      linked_party_id: '00000000-0000-0000-0000-000000000000',
    });
  console.log('linked_party_id:', err6?.message || '✅ 성공');

  // 정리
  console.log('\n=== 테스트 데이터 정리 ===');
  await supabase.from('case_clients').delete().eq('case_id', testCase.id);
  await supabase.from('case_parties').delete().like('party_name', 'TEST_%');
  console.log('정리 완료');
}

main().catch(console.error);
