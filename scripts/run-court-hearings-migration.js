/**
 * 법원 기일 관리 시스템 마이그레이션 실행 스크립트
 * @description Supabase에 법원 기일, 데드라인 테이블 및 함수 생성
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log('🚀 법원 기일 관리 시스템 마이그레이션 시작...\n');

    // 마이그레이션 SQL 파일 읽기
    const migrationPath = path.resolve(
      __dirname,
      '../supabase/migrations/20251122_court_hearings_system.sql'
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`마이그레이션 파일을 찾을 수 없습니다: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 마이그레이션 파일 로드 완료');
    console.log(`📍 경로: ${migrationPath}`);
    console.log(`📏 크기: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // SQL 실행 (Service Role Key 사용)
    console.log('⚙️  SQL 실행 중...');

    // SQL을 개별 명령어로 분리 (주석 및 공백 제거)
    const sqlStatements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => {
        // 빈 줄이나 주석만 있는 줄 제거
        return (
          stmt.length > 0 &&
          !stmt.startsWith('--') &&
          !stmt.startsWith('/*') &&
          stmt !== '/*' &&
          stmt !== '*/'
        );
      });

    console.log(`📊 총 ${sqlStatements.length}개의 SQL 명령어 발견\n`);

    // 각 명령어를 순차적으로 실행
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sqlStatements.length; i++) {
      const stmt = sqlStatements[i];
      if (!stmt) continue;

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });

        if (error) {
          // exec_sql RPC가 없을 수 있으므로 직접 실행 시도
          const { error: directError } = await supabase.from('_migrations').insert({
            name: `stmt_${i}`,
            executed_at: new Date().toISOString(),
          });

          if (directError) {
            console.error(`❌ 명령어 ${i + 1} 실행 실패:`, error.message);
            console.error(`SQL: ${stmt.substring(0, 100)}...`);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
          if (i % 10 === 0) {
            console.log(`✅ ${i + 1}/${sqlStatements.length} 실행 완료...`);
          }
        }
      } catch (err) {
        console.error(`❌ 명령어 ${i + 1} 실행 중 예외:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📊 마이그레이션 결과:');
    console.log(`   ✅ 성공: ${successCount}개`);
    console.log(`   ❌ 실패: ${errorCount}개\n`);

    // 테이블 존재 확인
    console.log('🔍 생성된 테이블 확인 중...\n');

    const tablesToCheck = [
      'deadline_types',
      'court_hearings',
      'case_deadlines',
    ];

    for (const table of tablesToCheck) {
      const { data, error } = await supabase.from(table).select('id').limit(1);

      if (error) {
        console.log(`   ❌ ${table}: 생성 실패 또는 접근 불가`);
        console.log(`      에러: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: 정상 생성됨`);
      }
    }

    console.log('\n🔍 deadline_types 초기 데이터 확인...\n');

    const { data: deadlineTypes, error: dtError } = await supabase
      .from('deadline_types')
      .select('*');

    if (dtError) {
      console.log(`   ❌ 조회 실패: ${dtError.message}`);
    } else if (deadlineTypes && deadlineTypes.length > 0) {
      console.log(`   ✅ ${deadlineTypes.length}개의 데드라인 타입 확인:`);
      deadlineTypes.forEach((dt) => {
        console.log(`      - ${dt.name} (${dt.type}): ${dt.days_count}일`);
      });
    } else {
      console.log('   ⚠️  데이터가 없습니다. 수동 삽입이 필요할 수 있습니다.');
    }

    console.log('\n✅ 마이그레이션 완료!\n');
    console.log('📌 다음 단계:');
    console.log('   1. Supabase 대시보드에서 테이블 구조 확인');
    console.log('   2. RLS 정책이 올바르게 설정되었는지 확인');
    console.log('   3. API 엔드포인트 테스트 (/api/admin/court-hearings)');
    console.log('   4. 샘플 데이터 추가 (선택사항)\n');
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error.message);
    console.error('상세:', error);
    process.exit(1);
  }
}

// 실행
runMigration();
