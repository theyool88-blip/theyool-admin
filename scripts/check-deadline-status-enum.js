/**
 * case_deadlines 테이블의 status 컬럼 enum 값 확인
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

async function checkDeadlineStatuses() {
  console.log('🔍 case_deadlines.status 값 확인 중...\n');

  try {
    const { data, error } = await supabase
      .from('case_deadlines')
      .select('id, status, deadline_type, deadline_date')
      .limit(20);

    if (error) {
      console.error('❌ 오류:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  데이터가 없습니다.');
      return;
    }

    console.log(`✅ ${data.length}건의 기한 조회됨\n`);

    // status 값 종류 수집
    const statusValues = new Set();
    data.forEach(d => {
      statusValues.add(d.status);
    });

    console.log('📋 발견된 status 값:');
    Array.from(statusValues).sort().forEach(status => {
      const count = data.filter(d => d.status === status).length;
      console.log(`   - "${status}" (${count}건)`);
    });

    console.log('\n📝 샘플 데이터:');
    data.slice(0, 5).forEach((d, idx) => {
      console.log(`   ${idx + 1}. ${d.deadline_date} | ${d.deadline_type} | status: "${d.status}"`);
    });

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }
}

checkDeadlineStatuses();
