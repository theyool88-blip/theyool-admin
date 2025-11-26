/**
 * 테이블 스키마 확인 스크립트
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkTableSchemas() {
  console.log('🔍 테이블 스키마 확인 중...\n');

  const tables = [
    'clients',
    'legal_cases',
    'court_hearings',
    'case_deadlines'
  ];

  for (const table of tables) {
    console.log(`\n📋 ${table} 테이블:`);

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ 오류: ${error.message}`);
        continue;
      }

      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`✅ 컬럼 목록 (${columns.length}개):`);
        columns.sort().forEach(col => {
          const value = data[0][col];
          const type = value === null ? 'null' : typeof value;
          console.log(`   - ${col} (${type})`);
        });
      } else {
        console.log('⚠️  데이터가 없습니다.');
      }
    } catch (err) {
      console.error(`❌ 오류: ${err.message}`);
    }
  }
}

checkTableSchemas();
