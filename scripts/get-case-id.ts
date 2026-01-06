import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a case with court case number to test
  const { data } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number')
    .eq('court_case_number', '2025드단5823')
    .single();

  if (data) {
    console.log('Case ID:', data.id);
    console.log('Case Name:', data.case_name);
    console.log('Court Number:', data.court_case_number);
  } else {
    // Get any case with court number
    const { data: cases } = await supabase
      .from('legal_cases')
      .select('id, case_name, court_case_number')
      .not('court_case_number', 'is', null)
      .limit(1);

    if (cases && cases[0]) {
      console.log('Case ID:', cases[0].id);
      console.log('Case Name:', cases[0].case_name);
      console.log('Court Number:', cases[0].court_case_number);
    }
  }
}
main();
