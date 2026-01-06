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
    .select('progress, scraped_at')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('scraped_at:', data?.scraped_at);
  console.log('progress type:', typeof data?.progress);
  console.log('progress length:', Array.isArray(data?.progress) ? data.progress.length : 'not array');

  if (Array.isArray(data?.progress)) {
    console.log('\n마지막 5개 항목:');
    const lastItems = data.progress.slice(-5);
    lastItems.forEach((item: any, i: number) => {
      console.log('[' + (data.progress.length - 5 + i) + ']', JSON.stringify(item));
    });
  }
}

main().catch(console.error);
