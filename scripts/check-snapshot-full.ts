import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const caseId = '5379a691-5755-4fd5-9b09-2044a18f97a6';

  const { data, error } = await supabase
    .from('scourt_case_snapshots')
    .select('*')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('=== 스냅샷 컬럼 목록 ===');
  if (data) {
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value === null) {
        console.log(key + ': null');
      } else if (typeof value === 'object') {
        const str = JSON.stringify(value);
        if (str.length > 200) {
          console.log(key + ': ' + str.substring(0, 200) + '... (' + str.length + ' chars)');
        } else {
          console.log(key + ': ' + str);
        }
      } else {
        console.log(key + ': ' + value);
      }
    });
  }
}

main().catch(console.error);
