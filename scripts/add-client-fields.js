const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Adding fields to clients table...\n');

  try {
    const fs = require('fs');
    const sql = fs.readFileSync('/tmp/add-client-fields.sql', 'utf8');

    console.log('📝 SQL to execute:');
    console.log('─'.repeat(70));
    console.log(sql);
    console.log('─'.repeat(70));
    console.log('\n⚠️  Please run this SQL in your Supabase SQL Editor:');
    console.log('📍 Go to: https://supabase.com/dashboard/project/kqqyipnlkmmprfgygauk/sql/new');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

runMigration();
