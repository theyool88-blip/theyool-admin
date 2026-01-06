import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  // Check legal_cases columns
  console.log('=== legal_cases 컬럼 확인 ===');
  const { data: lc } = await supabase.from('legal_cases').select('*').limit(1);
  if (lc && lc[0]) {
    console.log('컬럼:', Object.keys(lc[0]).join(', '));
  }

  // Check case_relations columns
  console.log('\n=== case_relations 컬럼 확인 ===');
  const { data: cr } = await supabase.from('case_relations').select('*').limit(1);
  if (cr && cr[0]) {
    console.log('컬럼:', Object.keys(cr[0]).join(', '));
  } else {
    console.log('테이블 비어있음');
  }

  // Check scourt_case_snapshots columns
  console.log('\n=== scourt_case_snapshots 컬럼 확인 ===');
  const { data: ss } = await supabase.from('scourt_case_snapshots').select('*').limit(1);
  if (ss && ss[0]) {
    console.log('컬럼:', Object.keys(ss[0]).join(', '));
  }
}

checkSchema().catch(console.error);
