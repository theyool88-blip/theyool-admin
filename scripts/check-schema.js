const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // legal_cases 테이블의 모든 컬럼 확인
  const { data, error } = await supabase
    .from('legal_cases')
    .select('*')
    .limit(1);

  if (error) {
    console.error('오류:', error);
    return;
  }

  console.log('=== legal_cases 테이블 컬럼 ===');
  if (data && data.length > 0) {
    Object.keys(data[0]).forEach(key => {
      console.log(`- ${key}: ${typeof data[0][key]} (${data[0][key]})`);
    });
  }

  // 수임료 관련 필드가 있는 사건 샘플
  const { data: sampleCases, error: sampleError } = await supabase
    .from('legal_cases')
    .select('case_name, retainer_fee, calculated_success_fee, total_received, total_fee, contract_amount')
    .gt('retainer_fee', 0)
    .limit(5);

  if (sampleError) {
    console.error('샘플 조회 오류:', sampleError);
    return;
  }

  console.log('\n=== 수임료 있는 사건 샘플 ===');
  sampleCases?.forEach(c => {
    console.log(`- ${c.case_name}`);
    console.log(`  retainer_fee: ${c.retainer_fee?.toLocaleString()}`);
    console.log(`  calculated_success_fee: ${c.calculated_success_fee?.toLocaleString()}`);
    console.log(`  total_received: ${c.total_received?.toLocaleString()}`);
    console.log(`  total_fee: ${c.total_fee?.toLocaleString()}`);
    console.log(`  contract_amount: ${c.contract_amount?.toLocaleString()}`);
  });
}

main().catch(console.error);
