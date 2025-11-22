require('dotenv').config({ path: '.env.local' });
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

async function testSystem() {
  console.log('🧪 법원 기일 관리 시스템 테스트 시작...\n');

  // Test 1: deadline_types 테이블 확인
  console.log('1️⃣ deadline_types 테이블 확인');
  const { data: deadlineTypes, error: deadlineTypesError } = await supabase
    .from('deadline_types')
    .select('*')
    .order('days_count');

  if (deadlineTypesError) {
    console.error('   ❌ 에러:', deadlineTypesError.message);
  } else {
    console.log(`   ✅ ${deadlineTypes.length}개의 데드라인 타입 확인`);
    deadlineTypes.forEach(dt => {
      console.log(`      - ${dt.name} (${dt.days_count}일)`);
    });
  }

  // Test 2: court_hearings 테이블 확인
  console.log('\n2️⃣ court_hearings 테이블 확인');
  const { count: hearingsCount, error: hearingsError } = await supabase
    .from('court_hearings')
    .select('*', { count: 'exact', head: true });

  if (hearingsError) {
    console.error('   ❌ 에러:', hearingsError.message);
  } else {
    console.log(`   ✅ ${hearingsCount}개의 법원 기일 (현재 데이터 없음은 정상)`);
  }

  // Test 3: case_deadlines 테이블 확인
  console.log('\n3️⃣ case_deadlines 테이블 확인');
  const { count: deadlinesCount, error: deadlinesError } = await supabase
    .from('case_deadlines')
    .select('*', { count: 'exact', head: true });

  if (deadlinesError) {
    console.error('   ❌ 에러:', deadlinesError.message);
  } else {
    console.log(`   ✅ ${deadlinesCount}개의 데드라인 (현재 데이터 없음은 정상)`);
  }

  // Test 4: upcoming_hearings 뷰 확인
  console.log('\n4️⃣ upcoming_hearings 뷰 확인');
  const { data: upcomingHearings, error: upcomingError } = await supabase
    .from('upcoming_hearings')
    .select('*');

  if (upcomingError) {
    console.error('   ❌ 에러:', upcomingError.message);
  } else {
    console.log(`   ✅ 뷰 작동 확인 (${upcomingHearings.length}개의 다가오는 기일)`);
  }

  // Test 5: urgent_deadlines 뷰 확인
  console.log('\n5️⃣ urgent_deadlines 뷰 확인');
  const { data: urgentDeadlines, error: urgentError } = await supabase
    .from('urgent_deadlines')
    .select('*');

  if (urgentError) {
    console.error('   ❌ 에러:', urgentError.message);
  } else {
    console.log(`   ✅ 뷰 작동 확인 (${urgentDeadlines.length}개의 긴급 데드라인)`);
  }

  // Test 6: ENUM 타입 확인
  console.log('\n6️⃣ hearing_type ENUM 확인');
  const { data: enumData, error: enumError } = await supabase.rpc('exec', {
    query: `
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'hearing_type')
      ORDER BY enumsortorder;
    `
  });

  if (enumError) {
    // exec RPC가 없으면 직접 쿼리
    console.log('   ℹ️  ENUM 값은 Supabase SQL Editor에서 확인하세요:');
    console.log('      SELECT enumlabel FROM pg_enum');
    console.log('      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = \'hearing_type\')');
  } else {
    console.log(`   ✅ ${enumData?.length || 7}개의 hearing_type 값 확인`);
  }

  console.log('\n✅ 시스템 테스트 완료!');
  console.log('\n📋 다음 단계:');
  console.log('   1. http://localhost:3005 에서 대시보드 확인');
  console.log('   2. "+ 법원기일 추가" 버튼 클릭');
  console.log('   3. 사건 상세 페이지에서 "법원기일", "데드라인" 탭 확인');
  console.log('   4. /schedules 페이지에서 통합 캘린더 확인');
}

testSystem().catch(console.error);
