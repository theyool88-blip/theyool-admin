import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // case_parties에 테스트 삽입 시도
  console.log('=== case_parties 컬럼 확인 ===');
  const { error: err1 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: '799ce69a-df47-454d-8355-90b981ecf32f',
      case_id: '00000000-0000-0000-0000-000000000000',
      party_name: 'test',
      party_type: 'plaintiff',
      is_primary: true,  // 이 컬럼이 존재하는지?
    });
  console.log('is_primary 테스트:', err1?.message || '성공');

  const { error: err2 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: '799ce69a-df47-454d-8355-90b981ecf32f',
      case_id: '00000000-0000-0000-0000-000000000000',
      party_name: 'test2',
      party_type: 'plaintiff',
      is_our_client: true,  // 이 컬럼이 존재하는지?
    });
  console.log('is_our_client 테스트:', err2?.message || '성공');

  const { error: err3 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: '799ce69a-df47-454d-8355-90b981ecf32f',
      case_id: '00000000-0000-0000-0000-000000000000',
      party_name: 'test3',
      party_type: 'plaintiff',
      client_id: '00000000-0000-0000-0000-000000000000',  // 이 컬럼이 존재하는지?
    });
  console.log('client_id 테스트:', err3?.message || '성공');

  // 최소 필드로 삽입 테스트
  const { error: err4 } = await supabase
    .from('case_parties')
    .insert({
      tenant_id: '799ce69a-df47-454d-8355-90b981ecf32f',
      case_id: '00000000-0000-0000-0000-000000000000',
      party_name: 'test4',
      party_type: 'plaintiff',
    });
  console.log('최소 필드 테스트:', err4?.message || '성공');
}

main();
