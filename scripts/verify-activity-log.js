const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  try {
    // 1. 테이블 확인
    console.log('1️⃣  consultation_activity_log 테이블 확인...');
    const { data: activities, error: activitiesError } = await supabase
      .from('consultation_activity_log')
      .select('*')
      .limit(5);

    if (activitiesError) throw activitiesError;
    console.log('✅ 테이블 존재 확인:', activities.length, '개 레코드');

    // 2. 기존 상담에 대한 이력 확인
    console.log('\n2️⃣  기존 상담 이력 확인...');
    const { data: consultations, error: consultError } = await supabase
      .from('consultations')
      .select('id, name')
      .limit(1)
      .single();

    if (consultError) throw consultError;

    if (consultations) {
      const { data: logs, error: logsError } = await supabase
        .from('consultation_activity_log')
        .select('*')
        .eq('consultation_id', consultations.id)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      console.log('✅ 상담', consultations.name, '의 이력:', logs.length, '개');

      if (logs.length > 0) {
        console.log('   최근 활동:', logs[0].activity_type, '-', logs[0].description);
      }
    }

    // 3. 통계 함수 확인
    console.log('\n3️⃣  통계 함수 확인...');
    if (consultations) {
      const { data: summary, error: summaryError } = await supabase
        .rpc('get_consultation_activity_summary', {
          consultation_uuid: consultations.id
        });

      if (summaryError) throw summaryError;
      if (summary && summary.length > 0) {
        console.log('✅ 통계 함수 작동:');
        console.log('   - 전체 활동:', summary[0].total_activities, '건');
        console.log('   - 상태 변경:', summary[0].status_changes, '건');
        console.log('   - 일정 변경:', summary[0].schedule_changes, '건');
        console.log('   - 메모 추가:', summary[0].notes_added, '건');
      }
    }

    // 4. 활동 유형별 통계
    console.log('\n4️⃣  활동 유형별 통계...');
    const { data: typeStats, error: typeError } = await supabase
      .from('consultation_activity_log')
      .select('activity_type');

    if (typeError) throw typeError;

    const typeCounts = {};
    typeStats.forEach(log => {
      typeCounts[log.activity_type] = (typeCounts[log.activity_type] || 0) + 1;
    });

    console.log('✅ 활동 유형별 통계:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log('   -', type + ':', count, '건');
    });

    console.log('\n✅ 모든 검증 완료!');
    console.log('\n📋 다음 단계:');
    console.log('   1. 상담 관리 페이지 접속 (http://localhost:3000/admin/consultations)');
    console.log('   2. 상담 클릭하여 상세 모달 열기');
    console.log('   3. "📜 활동 이력" 탭 클릭하여 타임라인 확인');
    console.log('   4. 상담 정보 수정 시 자동으로 이력이 기록됩니다!');

  } catch (error) {
    console.error('❌ 검증 실패:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verify();
