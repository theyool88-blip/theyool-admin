import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const caseId = '5379a691-5755-4fd5-9b09-2044a18f97a6';

  const { data } = await supabase
    .from('scourt_case_snapshots')
    .select('progress')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  const progress = data?.progress || [];

  console.log('=== 전체 진행내용 ===');
  progress.forEach((item: any, i: number) => {
    console.log('[' + i + '] ' + JSON.stringify(item));
  });

  console.log('\n=== 종국 관련 항목 ===');
  progress.forEach((item: any, i: number) => {
    const name = item.prcdNm || '';
    if (name.includes('종국')) {
      console.log('Found at [' + i + ']: ' + JSON.stringify(item));
    }
  });
}

main().catch(console.error);
