import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // legal_cases 테이블에서 빈 쿼리로 컬럼 확인
  const { data, error } = await supabase
    .from('legal_cases')
    .select('*')
    .limit(1);

  if (error) {
    console.log('에러:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('legal_cases 컬럼:');
    console.log(Object.keys(data[0]).sort().join('\n'));
  } else {
    console.log('데이터 없음, 빈 insert 시도로 확인...');

    // 빈 insert로 필수 필드 확인
    const { error: insertError } = await supabase
      .from('legal_cases')
      .insert({})
      .select();

    if (insertError) {
      console.log('Insert 에러 (필수 필드 힌트):', insertError.message);
    }
  }
}

main();
