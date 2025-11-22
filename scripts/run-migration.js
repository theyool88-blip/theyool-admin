const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

async function runSQL(sql) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    console.log('실행 중:', statement.substring(0, 60) + '...');
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.error('오류:', error.message);
      } else {
        console.log('✓ 성공');
      }
    } catch (e) {
      console.error('예외:', e.message);
    }
  }
}

async function main() {
  const sql = fs.readFileSync('/tmp/migration.sql', 'utf8');
  console.log('마이그레이션 실행 중...\n');
  await runSQL(sql);
  console.log('\n마이그레이션 완료!');
}

main().catch(console.error);
