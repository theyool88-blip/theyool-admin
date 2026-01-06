import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProgress() {
  const { data: c } = await supabase
    .from('legal_cases')
    .select('id')
    .ilike('court_case_number', '%2024드단22272%')
    .single();

  if (!c) return;

  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('progress')
    .eq('legal_case_id', c.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshot?.progress) {
    console.log('=== 진행내용 샘플 (처음 5개) ===');
    const items = snapshot.progress.slice(0, 5);
    for (let i = 0; i < items.length; i++) {
      console.log('\n[' + (i + 1) + ']');
      console.log(JSON.stringify(items[i], null, 2));
    }
  }
}

checkProgress().catch(console.error);
