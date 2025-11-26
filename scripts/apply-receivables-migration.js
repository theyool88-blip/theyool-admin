const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const migrationPath = path.join(__dirname, '../supabase/migrations/20251126_receivable_writeoffs_and_memos.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Executing ${statements.length} SQL statements...`);

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        // Try direct query if rpc doesn't work
        const { error: queryError } = await supabase.from('_temp').select().limit(0);
        console.log('Statement:', statement.substring(0, 50) + '...');
        console.log('Error (may be expected):', error.message);
      } else {
        console.log('✓ Executed:', statement.substring(0, 50) + '...');
      }
    } catch (e) {
      console.log('Statement:', statement.substring(0, 50) + '...');
      console.log('Error:', e.message);
    }
  }

  // Verify tables exist
  const { data: writeoffs, error: wErr } = await supabase
    .from('receivable_writeoffs')
    .select('id')
    .limit(1);

  const { data: memos, error: mErr } = await supabase
    .from('receivable_memos')
    .select('id')
    .limit(1);

  console.log('\n=== 테이블 확인 ===');
  console.log('receivable_writeoffs:', wErr ? `오류: ${wErr.message}` : '✓ 존재');
  console.log('receivable_memos:', mErr ? `오류: ${mErr.message}` : '✓ 존재');
}

main().catch(console.error);
