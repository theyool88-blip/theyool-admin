require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCaseNumbers() {
  const { data: cases } = await supabase
    .from('legal_cases')
    .select('court_case_number, case_name')
    .not('court_case_number', 'is', null)
    .limit(30);

  console.log('📋 샘플 사건번호 (최대 30개):\n');
  cases?.forEach(c => {
    console.log(`   ${c.court_case_number} - ${c.case_name}`);
  });
}

checkCaseNumbers();
