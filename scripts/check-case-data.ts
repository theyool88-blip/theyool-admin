import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCase() {
  const { data: c } = await supabase
    .from('legal_cases')
    .select('id, court_case_number')
    .ilike('court_case_number', '%2024드단22272%')
    .single();
  
  if (!c) {
    console.log('사건 없음');
    return;
  }
  
  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('basic_info')
    .eq('legal_case_id', c.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (snapshot) {
    console.log('=== basicInfo 전체 ===');
    console.log(JSON.stringify(snapshot.basic_info, null, 2));
  }
}

checkCase().catch(console.error);
