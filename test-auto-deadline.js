const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0'
);

async function testAutoDeadline() {
  console.log('🧪 자동 데드라인 생성 기능 확인\n');
  
  // API-TEST-002 사건의 데드라인 확인
  const { data: deadlines, error } = await supabase
    .from('case_deadlines')
    .select('*')
    .eq('case_number', 'API-TEST-002');
  
  if (error) {
    console.error('❌ 조회 실패:', error.message);
    return;
  }
  
  if (deadlines && deadlines.length > 0) {
    console.log('✅ 자동 생성된 데드라인 발견!');
    console.log(`   총 ${deadlines.length}개\n`);
    
    deadlines.forEach((d, i) => {
      console.log(`📌 데드라인 #${i + 1}:`);
      console.log('   유형:', d.deadline_type);
      console.log('   기산일:', d.trigger_date);
      console.log('   만료일:', d.deadline_date);
      console.log('   메모:', d.notes);
      console.log('');
    });
  } else {
    console.log('⚠️  자동 생성된 데드라인이 없습니다.');
    console.log('   브라우저에서 UI를 통해 선고기일을 추가해보세요!');
  }
}

testAutoDeadline();
