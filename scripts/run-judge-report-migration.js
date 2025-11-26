/**
 * 담당 판사 & 재판기일 보고서 컬럼 추가 마이그레이션
 *
 * 실행 방법: node scripts/run-judge-report-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 담당 판사 & 재판기일 보고서 마이그레이션 시작...\n');

  try {
    // 1. cases 테이블에 judge_name 컬럼 추가
    console.log('📝 Step 1: cases 테이블에 judge_name 컬럼 추가');
    const { error: judgeError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE cases ADD COLUMN IF NOT EXISTS judge_name TEXT;`
    });

    if (judgeError) {
      console.error('❌ judge_name 컬럼 추가 실패:', judgeError);
      throw judgeError;
    }
    console.log('✅ judge_name 컬럼 추가 완료\n');

    // 2. court_hearings 테이블에 report 컬럼 추가
    console.log('📝 Step 2: court_hearings 테이블에 report 컬럼 추가');
    const { error: reportError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE court_hearings ADD COLUMN IF NOT EXISTS report TEXT;`
    });

    if (reportError) {
      console.error('❌ report 컬럼 추가 실패:', reportError);
      throw reportError;
    }
    console.log('✅ report 컬럼 추가 완료\n');

    // 3. 컬럼 주석 추가
    console.log('📝 Step 3: 컬럼 주석 추가');
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: `
        COMMENT ON COLUMN cases.judge_name IS '담당 판사명';
        COMMENT ON COLUMN court_hearings.report IS '재판기일 보고서 (텍스트)';
      `
    });

    if (commentError) {
      console.log('⚠️  주석 추가 실패 (무시됨):', commentError.message);
    } else {
      console.log('✅ 컬럼 주석 추가 완료\n');
    }

    console.log('🎉 마이그레이션 성공!\n');
    console.log('추가된 컬럼:');
    console.log('  - cases.judge_name (TEXT)');
    console.log('  - court_hearings.report (TEXT)\n');

  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    process.exit(1);
  }
}

runMigration();
