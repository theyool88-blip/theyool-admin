require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSchema() {
  console.log('🔍 legal_cases 테이블 구조 확인...\n');

  // legal_cases 테이블에서 샘플 데이터 가져오기
  const { data, error } = await supabase
    .from('legal_cases')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ 에러:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ legal_cases 테이블 컬럼:');
    Object.keys(data[0]).forEach(key => {
      console.log(`   - ${key}: ${typeof data[0][key]}`);
    });

    // case_number 또는 contract_number가 있는지 확인
    if (data[0].case_number) {
      console.log('\n✅ case_number 컬럼 존재');
    } else if (data[0].contract_number) {
      console.log('\n✅ contract_number 컬럼 존재');
    } else if (data[0].court_case_number) {
      console.log('\n✅ court_case_number 컬럼 존재');
    } else {
      console.log('\n⚠️  case_number, contract_number, court_case_number 컬럼 중 어느 것도 없음');
      console.log('   실제 사건번호 컬럼명을 확인하세요.');
    }
  } else {
    console.log('⚠️  데이터가 없어서 컬럼을 확인할 수 없습니다.');
    console.log('   샘플 사건을 먼저 생성하세요.');
  }

  // 뷰 테스트
  console.log('\n🔍 upcoming_hearings 뷰 테스트...');
  const { data: viewData, error: viewError } = await supabase
    .from('upcoming_hearings')
    .select('*')
    .limit(1);

  if (viewError) {
    console.error('❌ 뷰 에러:', viewError);
    console.log('\n💡 해결 방법:');
    console.log('   뷰가 참조하는 컬럼명이 legal_cases 테이블과 일치하지 않습니다.');
    console.log('   위에서 확인한 실제 컬럼명으로 뷰를 수정해야 합니다.');
  } else {
    console.log('✅ upcoming_hearings 뷰 정상 작동');
  }
}

checkSchema();
