import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkParties() {
  const { data: parties, error } = await supabase
    .from('case_parties')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('case_parties 전체 데이터 (' + (parties?.length || 0) + '개):');
  console.log('');
  
  if (parties && parties.length > 0) {
    console.log('컬럼 목록:', Object.keys(parties[0]).join(', '));
    console.log('');
  }

  (parties || []).forEach((p, i) => {
    console.log('[' + i + ']');
    console.log('    party_name="' + p.party_name + '"');
    console.log('    party_type="' + p.party_type + '"');
    console.log('    party_type_label="' + p.party_type_label + '"');
    console.log('    scourt_party_index=' + p.scourt_party_index);
    console.log('    manual_override=' + p.manual_override);
    console.log('');
  });
}

checkParties();
