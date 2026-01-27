import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTable(tableName: string) {
  console.log(`\n=== ${tableName} 테이블 스키마 ===`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`Error: ${error.message}`);
    return;
  }

  if (data && data.length > 0) {
    console.log('컬럼 목록:');
    console.log(Object.keys(data[0]).sort().join('\n'));
  } else {
    console.log('데이터 없음');
  }
}

async function main() {
  await checkTable('case_clients');
  await checkTable('case_parties');
  await checkTable('legal_cases');
}

main();
