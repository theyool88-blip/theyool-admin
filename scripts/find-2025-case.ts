import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const { data } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number')
    .like('court_case_number', '2025%')
    .limit(5);

  if (data) {
    data.forEach(c => console.log(c.id + ' | ' + c.court_case_number + ' | ' + c.case_name));
  }
}
main();
