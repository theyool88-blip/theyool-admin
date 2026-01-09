import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixProfiles() {
  const testEmails = ['owner@testlaw.kr', 'lawyer@testlaw.kr', 'staff@testlaw.kr'];

  const { data: users } = await supabase.auth.admin.listUsers();
  const testUsers = users?.users?.filter(u => testEmails.includes(u.email || ''));

  console.log('=== 프로필 생성 중 ===');

  for (const user of testUsers || []) {
    const { data: existing } = await supabase
      .from('users_profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (existing) {
      console.log(`⏭️ ${user.email}: 이미 존재`);
      continue;
    }

    const { error } = await supabase
      .from('users_profiles')
      .insert({
        auth_user_id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        email: user.email,
        role: 'master',
      });

    if (error) {
      console.log(`❌ ${user.email}: ${error.message}`);
    } else {
      console.log(`✅ ${user.email}: 생성됨`);
    }
  }
}

fixProfiles();
