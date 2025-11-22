require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 법원 기일 관리 시스템 마이그레이션 시작...\n');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251122_court_hearings_system.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📄 마이그레이션 파일 로드 완료');
  console.log(`📍 경로: ${sqlPath}`);
  console.log(`📏 크기: ${(sql.length / 1024).toFixed(2)} KB\n`);

  console.log('⚙️  SQL 실행 중...\n');

  try {
    // Supabase SQL Editor API를 통한 실행
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ 마이그레이션 실패:', error.message);
      process.exit(1);
    }

    console.log('✅ 마이그레이션 성공!\n');

    // 테이블 확인
    console.log('🔍 생성된 테이블 확인 중...\n');

    const tables = ['deadline_types', 'court_hearings', 'case_deadlines'];
    for (const table of tables) {
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`   ❌ ${table}: ${countError.message}`);
      } else {
        console.log(`   ✅ ${table}: ${count}개 행`);
      }
    }

    console.log('\n✅ 모든 작업 완료!');

  } catch (err) {
    console.error('❌ 예상치 못한 오류:', err);
    process.exit(1);
  }
}

runMigration();
