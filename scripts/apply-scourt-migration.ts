/**
 * 대법원 세션 시스템 마이그레이션 적용 스크립트
 *
 * 실행: npx tsx scripts/apply-scourt-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 대법원 세션 시스템 마이그레이션 시작...\n');

  try {
    // 1. scourt_profiles 테이블 생성
    console.log('1️⃣ scourt_profiles 테이블 생성...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS scourt_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          lawyer_id UUID,
          profile_name VARCHAR(100) NOT NULL UNIQUE,
          case_count INTEGER DEFAULT 0,
          max_cases INTEGER DEFAULT 50,
          status VARCHAR(20) DEFAULT 'active',
          last_sync_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_scourt_profiles_lawyer_id ON scourt_profiles(lawyer_id);
        CREATE INDEX IF NOT EXISTS idx_scourt_profiles_status ON scourt_profiles(status);
      `
    });

    if (error1) {
      // RPC가 없으면 직접 쿼리 시도
      console.log('   RPC 없음, 직접 테이블 확인...');

      // 테이블 존재 확인
      const { data: tables } = await supabase
        .from('scourt_profiles')
        .select('id')
        .limit(1);

      if (tables === null) {
        console.log('   ⚠️  테이블이 없습니다. Supabase 대시보드에서 SQL을 실행해주세요.');
        console.log('\n📋 Supabase 대시보드 → SQL Editor에서 다음 파일 실행:');
        console.log('   supabase/migrations/20251230_scourt_session_system.sql\n');
        return;
      }
    }
    console.log('   ✅ scourt_profiles 확인됨');

    // 2. scourt_profile_cases 테이블 확인
    console.log('2️⃣ scourt_profile_cases 테이블 확인...');
    const { data: profileCases } = await supabase
      .from('scourt_profile_cases')
      .select('id')
      .limit(1);

    if (profileCases === null) {
      console.log('   ⚠️  scourt_profile_cases 테이블이 없습니다.');
    } else {
      console.log('   ✅ scourt_profile_cases 확인됨');
    }

    // 3. scourt_sync_logs 테이블 확인
    console.log('3️⃣ scourt_sync_logs 테이블 확인...');
    const { data: syncLogs } = await supabase
      .from('scourt_sync_logs')
      .select('id')
      .limit(1);

    if (syncLogs === null) {
      console.log('   ⚠️  scourt_sync_logs 테이블이 없습니다.');
    } else {
      console.log('   ✅ scourt_sync_logs 확인됨');
    }

    // 4. legal_cases 컬럼 확인
    console.log('4️⃣ legal_cases 테이블 scourt 컬럼 확인...');
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('scourt_last_sync, scourt_raw_data, scourt_sync_status')
      .limit(1);

    if (legalCase !== null) {
      console.log('   ✅ legal_cases scourt 컬럼 확인됨');
    }

    console.log('\n✅ 마이그레이션 확인 완료!');
    console.log('\n테이블이 없는 경우 Supabase 대시보드에서 SQL을 실행해주세요:');
    console.log('1. https://supabase.com/dashboard 접속');
    console.log('2. 프로젝트 선택 → SQL Editor');
    console.log('3. supabase/migrations/20251230_scourt_session_system.sql 내용 붙여넣기');
    console.log('4. Run 클릭');

  } catch (error) {
    console.error('❌ 마이그레이션 에러:', error);
  }
}

applyMigration();
