import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testClientInsert() {
  // 1. 테넌트 확인
  const { data: tenants } = await supabase.from('tenants').select('id, name').limit(1);
  console.log('=== 테넌트 ===');
  console.log(tenants);

  if (!tenants || tenants.length === 0) {
    console.log('테넌트 없음!');
    return;
  }

  const tenantId = tenants[0].id;
  console.log('tenant_id:', tenantId);

  // 2. 직접 clients INSERT 테스트
  console.log('\n=== clients INSERT 테스트 ===');
  const { data: newClient, error: insertError } = await supabase
    .from('clients')
    .insert([{
      tenant_id: tenantId,
      name: 'test_client_' + Date.now(),
      phone: '010-0000-0000'
    }])
    .select()
    .single();

  if (insertError) {
    console.log('INSERT 실패:', insertError);
  } else {
    console.log('INSERT 성공:', newClient);

    // 정리
    await supabase.from('clients').delete().eq('id', newClient.id);
    console.log('(테스트 데이터 삭제 완료)');
  }
}

testClientInsert().catch(console.error);
