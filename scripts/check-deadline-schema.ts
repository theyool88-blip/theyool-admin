import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkSchema() {
  // 샘플 데이터로 컬럼 확인
  const { data: sample, error: sampleErr } = await supabase
    .from('case_deadlines')
    .select('*')
    .limit(1);

  if (sampleErr) {
    console.log('Error:', sampleErr.message);
    return;
  }

  if (sample && sample.length > 0) {
    const columns = Object.keys(sample[0]);
    console.log('case_deadlines 컬럼 목록:');
    columns.forEach(col => console.log('  -', col));

    // 특히 확인할 컬럼들
    console.log('\n확인 대상:');
    console.log('  party_id:', columns.includes('party_id') ? '✓ 존재' : '✗ 없음');
    console.log('  party_side:', columns.includes('party_side') ? '✓ 존재' : '✗ 없음');
    console.log('  case_party_id:', columns.includes('case_party_id') ? '✓ 존재' : '✗ 없음');
  } else {
    console.log('테이블에 데이터 없음');

    // SQL로 직접 컬럼 확인
    const { data: cols, error: colErr } = await supabase.rpc('exec_sql', {
      sql: `SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'case_deadlines'
            ORDER BY ordinal_position`
    });

    if (colErr) {
      console.log('RPC error:', colErr.message);

      // party_id, party_side 컬럼 테스트
      const testBoth = await supabase
        .from('case_deadlines')
        .insert({
          case_id: '00000000-0000-0000-0000-000000000000',
          deadline_type: 'DL_APPEAL',
          trigger_date: '2026-01-01',
          party_id: null,
          party_side: 'plaintiff_side'
        });

      if (testBoth.error) {
        console.log('Test insert error:', testBoth.error.message);
        if (testBoth.error.message.includes('party_id')) {
          console.log('=> party_id 컬럼 없음');
        } else if (testBoth.error.message.includes('party_side')) {
          console.log('=> party_side 컬럼 없음');
        } else if (testBoth.error.message.includes('violates foreign key')) {
          console.log('✅ party_id, party_side 컬럼 모두 존재함');
        } else {
          console.log('=> 컬럼 존재 가능성 높음');
        }
      } else {
        console.log('✅ party_id, party_side 컬럼 존재 확인됨');
      }
    } else {
      console.log('Columns from SQL:', cols);
    }
  }
}

checkSchema();
