/**
 * 프로필 풀 제한 테스트
 *
 * npx tsx scripts/test-profile-limits.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testProfileLimits() {
  console.log('🧪 프로필 풀 제한 테스트 시작...\n');

  // 1. scourt_user_settings 테이블 확인
  console.log('1️⃣ scourt_user_settings 테이블 확인...');
  const { data: settings, error: settingsError } = await supabase
    .from('scourt_user_settings')
    .select('*');

  if (settingsError) {
    console.log('   ❌ 에러:', settingsError.message);
    return;
  }

  console.log('   ✅ 설정 목록:');
  settings?.forEach((s) => {
    console.log(`      - user_id: ${s.user_id || '(기본값)'}`);
    console.log(`        max_profiles: ${s.max_profiles}`);
    console.log(`        max_cases_per_profile: ${s.max_cases_per_profile}`);
    console.log(`        최대 저장 가능: ${s.max_profiles * s.max_cases_per_profile}건`);
  });

  // 2. 기본 설정 확인
  console.log('\n2️⃣ 기본 설정 (user_id = null) 확인...');
  const { data: defaultSettings } = await supabase
    .from('scourt_user_settings')
    .select('*')
    .is('user_id', null)
    .single();

  if (defaultSettings) {
    console.log('   ✅ 기본 설정 존재');
    console.log(`      max_profiles: ${defaultSettings.max_profiles}`);
    console.log(`      max_cases_per_profile: ${defaultSettings.max_cases_per_profile}`);
  } else {
    console.log('   ⚠️  기본 설정 없음');
  }

  // 3. scourt_profile_usage 뷰 테스트
  console.log('\n3️⃣ scourt_profile_usage 뷰 테스트...');
  const { data: usage, error: usageError } = await supabase
    .from('scourt_profile_usage')
    .select('*');

  if (usageError) {
    console.log('   ⚠️  뷰 조회 에러 (데이터가 없을 수 있음):', usageError.message);
  } else if (usage && usage.length > 0) {
    console.log('   ✅ 프로필 사용량:');
    usage.forEach((u) => {
      console.log(`      - user_id: ${u.user_id || '(공용)'}`);
      console.log(`        프로필: ${u.profile_count}/${u.max_profiles}`);
      console.log(`        사건: ${u.total_cases}/${u.max_total_cases}`);
    });
  } else {
    console.log('   ℹ️  아직 프로필 데이터 없음');
  }

  // 4. 현재 프로필 목록
  console.log('\n4️⃣ 현재 scourt_profiles 상태...');
  const { data: profiles } = await supabase
    .from('scourt_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (profiles && profiles.length > 0) {
    console.log(`   ✅ 프로필 ${profiles.length}개:`);
    profiles.forEach((p) => {
      console.log(`      - ${p.profile_name}: ${p.case_count}/${p.max_cases}건 (${p.status})`);
    });
  } else {
    console.log('   ℹ️  아직 프로필 없음');
  }

  console.log('\n✅ 테스트 완료!');
  console.log('\n📋 요약:');
  console.log(`   - 기본 프로필 제한: ${defaultSettings?.max_profiles || 6}개`);
  console.log(`   - 프로필당 사건: ${defaultSettings?.max_cases_per_profile || 50}건`);
  console.log(`   - 최대 저장 가능: ${(defaultSettings?.max_profiles || 6) * (defaultSettings?.max_cases_per_profile || 50)}건`);
}

testProfileLimits().catch(console.error);
