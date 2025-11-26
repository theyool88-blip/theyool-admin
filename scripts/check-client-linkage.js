const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. 전체 사건 수 확인
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, case_name, client_id, retainer_fee, total_received, clients(id, name)');

  if (casesError) {
    console.error('사건 조회 오류:', casesError);
    return;
  }

  const withClient = cases.filter(c => c.client_id);
  const withoutClient = cases.filter(c => !c.client_id);

  console.log('=== 사건-의뢰인 연결 현황 ===');
  console.log('총 사건 수:', cases.length);
  console.log('client_id 연결됨:', withClient.length);
  console.log('client_id 없음:', withoutClient.length);

  // 2. 의뢰인 테이블 확인
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name');

  if (clientsError) {
    console.error('의뢰인 조회 오류:', clientsError);
    return;
  }

  console.log('\n=== 의뢰인 현황 ===');
  console.log('총 의뢰인 수:', clients.length);

  // 3. client_id 없는 사건 목록
  if (withoutClient.length > 0) {
    console.log('\n=== client_id 없는 사건 목록 (처음 10건) ===');
    withoutClient.slice(0, 10).forEach(c => {
      console.log(`- "${c.case_name}"`);
    });
  }

  // 4. 금액 데이터 확인
  console.log('\n=== 금액 데이터 샘플 (처음 10건) ===');
  withClient.slice(0, 10).forEach(c => {
    console.log(`- ${c.case_name}`);
    console.log(`  수임료: ${(c.retainer_fee || 0).toLocaleString()}원, 수금액: ${(c.total_received || 0).toLocaleString()}원`);
  });

  // 5. 수임료가 있는 사건 중 미수금 확인
  const casesWithFee = withClient.filter(c => c.retainer_fee > 0);
  console.log(`\n수임료 설정된 사건: ${casesWithFee.length}건`);

  const receivables = casesWithFee.filter(c => {
    const expected = (c.retainer_fee || 0);
    const received = (c.total_received || 0);
    return expected > received;
  });

  console.log(`\n=== 미수금 있는 사건 ===`);
  receivables.slice(0, 10).forEach(c => {
    const outstanding = (c.retainer_fee || 0) - (c.total_received || 0);
    console.log(`- ${c.case_name}: 미수금 ${outstanding.toLocaleString()}원 (수임료: ${c.retainer_fee?.toLocaleString()}, 수금: ${c.total_received?.toLocaleString()})`);
  });
  console.log(`미수금 있는 사건: ${receivables.length}건`);
}

main().catch(console.error);
