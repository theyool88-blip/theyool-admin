import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const nonExistentName = 'this_client_definitely_does_not_exist_12345';

  console.log('=== .single() 테스트 (존재하지 않는 의뢰인) ===');
  const result1 = await supabase
    .from('clients')
    .select('id, name')
    .eq('name', nonExistentName)
    .single();

  console.log('data:', result1.data);
  console.log('error:', result1.error);
  console.log('');

  console.log('=== .maybeSingle() 테스트 (존재하지 않는 의뢰인) ===');
  const result2 = await supabase
    .from('clients')
    .select('id, name')
    .eq('name', nonExistentName)
    .maybeSingle();

  console.log('data:', result2.data);
  console.log('error:', result2.error);
  console.log('');

  // 조건문 테스트
  console.log('=== 조건문 분기 테스트 ===');

  const { data: existingClient } = result1;  // single() 결과 사용
  if (existingClient) {
    console.log('.single() 결과: existingClient 존재');
  } else {
    console.log('.single() 결과: existingClient 없음 (else 분기 진입)');
  }

  const { data: existingClient2 } = result2;  // maybeSingle() 결과 사용
  if (existingClient2) {
    console.log('.maybeSingle() 결과: existingClient2 존재');
  } else {
    console.log('.maybeSingle() 결과: existingClient2 없음 (else 분기 진입)');
  }
}

test().catch(console.error);
