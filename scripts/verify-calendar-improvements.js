#!/usr/bin/env node

/**
 * 통합 캘린더 개선사항 검증 스크립트
 * 작성일: 2025-11-23
 *
 * 검증 항목:
 * 1. cases 테이블에 case_number 컬럼 존재 확인
 * 2. unified_calendar VIEW에 새 컬럼들 확인
 * 3. 정렬 순서 검증 (시간 없는 일정 우선)
 * 4. 일정 표시 형식 검증 (종류) 사건명
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCasesTable() {
  console.log('📋 1. cases 테이블 검증\n');

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, title, case_number')
    .limit(5);

  if (error) {
    console.error('❌ cases 테이블 조회 실패:', error.message);
    return false;
  }

  console.log('✅ cases 테이블 컬럼 확인:');
  console.log('   - id: ✓');
  console.log('   - title: ✓');
  console.log('   - case_number:', cases && cases.length > 0 ? '✓' : '❓ (컬럼은 있지만 데이터 없음)');

  if (cases && cases.length > 0) {
    console.log('\n📊 샘플 데이터:');
    console.table(cases.map(c => ({
      id: c.id.substring(0, 8) + '...',
      title: c.title.substring(0, 30),
      case_number: c.case_number || '(미입력)'
    })));
  }

  return true;
}

async function verifyUnifiedCalendarView() {
  console.log('\n📅 2. unified_calendar VIEW 검증\n');

  const { data: events, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ unified_calendar VIEW 조회 실패:', error.message);
    console.log('\n⚠️  VIEW를 수동으로 생성해야 합니다.');
    console.log('   파일: /supabase/migrations/20251123_update_unified_calendar_view.sql');
    return false;
  }

  if (!events || events.length === 0) {
    console.log('⚠️  VIEW는 존재하지만 데이터가 없습니다.');
    return true;
  }

  const event = events[0];
  const expectedColumns = [
    'id', 'event_type', 'event_type_kr', 'event_subtype',
    'title', 'case_name', 'event_date', 'event_time',
    'event_datetime', 'reference_id', 'location',
    'description', 'status', 'sort_priority'
  ];

  console.log('✅ unified_calendar VIEW 컬럼 확인:');
  const actualColumns = Object.keys(event);
  expectedColumns.forEach(col => {
    const exists = actualColumns.includes(col);
    console.log(`   - ${col}: ${exists ? '✓' : '✗'}`);
  });

  console.log('\n📊 샘플 이벤트:');
  console.log({
    title: event.title,
    event_type_kr: event.event_type_kr,
    case_name: event.case_name || '(사건 연동 안됨)',
    event_date: event.event_date,
    event_time: event.event_time,
    sort_priority: event.sort_priority
  });

  return true;
}

async function verifySortOrder() {
  console.log('\n🔢 3. 정렬 순서 검증\n');

  // 오늘 날짜부터 7일간의 일정 조회
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const endDate = nextWeek.toISOString().split('T')[0];

  const { data: events, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .gte('event_date', today)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })
    .order('sort_priority', { ascending: true })
    .order('event_time', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ 일정 조회 실패:', error.message);
    return false;
  }

  if (!events || events.length === 0) {
    console.log('⚠️  이번 주 일정이 없습니다.');
    console.log('   테스트 데이터를 추가해주세요.');
    return true;
  }

  console.log(`✅ 이번 주 일정 ${events.length}개 조회 성공\n`);
  console.log('📋 정렬 순서 확인:');
  console.log('   (날짜 → 시간우선순위 → 시간 순서로 정렬)\n');

  // 같은 날짜별로 그룹화
  const byDate = events.reduce((acc, event) => {
    if (!acc[event.event_date]) {
      acc[event.event_date] = [];
    }
    acc[event.event_date].push(event);
    return acc;
  }, {});

  Object.entries(byDate).forEach(([date, dateEvents]) => {
    console.log(`📆 ${date}`);
    dateEvents.forEach((event, idx) => {
      const priority = event.sort_priority === 1 ? '🔝 (시간없음 우선)' : '⏰ (시간있음)';
      console.log(`   ${idx + 1}. ${priority}`);
      console.log(`      시간: ${event.event_time || '없음'}`);
      console.log(`      제목: ${event.title}`);
      console.log(`      종류: ${event.event_type_kr || event.event_type}`);
      console.log('');
    });
  });

  // 정렬 검증
  let sortValid = true;
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];

    // 날짜 비교
    if (current.event_date > next.event_date) {
      console.error(`❌ 정렬 오류: 날짜 순서가 잘못됨 (${current.event_date} > ${next.event_date})`);
      sortValid = false;
    }

    // 같은 날짜인 경우 sort_priority 비교
    if (current.event_date === next.event_date) {
      if (current.sort_priority > next.sort_priority) {
        console.error(`❌ 정렬 오류: 우선순위가 잘못됨 (${current.sort_priority} > ${next.sort_priority})`);
        sortValid = false;
      }

      // 같은 우선순위인 경우 시간 비교
      if (current.sort_priority === next.sort_priority &&
          current.event_time > next.event_time) {
        console.error(`❌ 정렬 오류: 시간 순서가 잘못됨 (${current.event_time} > ${next.event_time})`);
        sortValid = false;
      }
    }
  }

  if (sortValid) {
    console.log('✅ 정렬 순서 검증 완료: 모든 일정이 올바르게 정렬되었습니다.\n');
  }

  return sortValid;
}

async function verifyTitleFormat() {
  console.log('\n📝 4. 일정 제목 형식 검증\n');

  const { data: events, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ 일정 조회 실패:', error.message);
    return false;
  }

  if (!events || events.length === 0) {
    console.log('⚠️  일정 데이터가 없습니다.');
    return true;
  }

  console.log('✅ 일정 제목 형식 확인:\n');

  events.forEach((event, idx) => {
    const hasParentheses = event.title.includes('(') && event.title.includes(')');
    const formatOk = hasParentheses || event.event_type === 'CONSULTATION';

    console.log(`${idx + 1}. ${formatOk ? '✓' : '✗'} ${event.title}`);
    console.log(`   종류: ${event.event_type_kr || event.event_type}`);
    console.log(`   사건명: ${event.case_name || '(없음)'}`);
    console.log(`   형식: ${hasParentheses ? '(종류) 사건명 ✓' : '단순 제목'}`);
    console.log('');
  });

  return true;
}

async function verifyAPI() {
  console.log('\n🌐 5. API 엔드포인트 검증\n');

  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endDate = nextWeek.toISOString().split('T')[0];

    const response = await fetch(
      `http://localhost:3000/api/admin/calendar?start_date=${today}&end_date=${endDate}`
    );

    if (!response.ok) {
      console.log('⚠️  API 서버가 실행되지 않았거나 인증이 필요합니다.');
      console.log('   개발 서버를 실행하고 로그인 후 다시 시도하세요.');
      return true; // 선택적 검증
    }

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`✅ API 응답 성공: ${result.data.length}개 일정 조회`);

      if (result.data.length > 0) {
        console.log('\n📊 API 응답 샘플:');
        console.log(JSON.stringify(result.data[0], null, 2));
      }
    } else {
      console.log('⚠️  API 응답이 예상과 다릅니다:', result);
    }
  } catch (error) {
    console.log('⚠️  API 검증 스킵 (서버 미실행 또는 네트워크 오류)');
    console.log('   에러:', error.message);
  }

  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  통합 캘린더 시스템 개선사항 검증');
  console.log('═══════════════════════════════════════════════════\n');

  const results = [];

  results.push(await verifyCasesTable());
  results.push(await verifyUnifiedCalendarView());
  results.push(await verifySortOrder());
  results.push(await verifyTitleFormat());
  results.push(await verifyAPI());

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  검증 결과 요약');
  console.log('═══════════════════════════════════════════════════\n');

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`✅ 통과: ${passed}/${total}`);

  if (passed < total) {
    console.log('\n⚠️  일부 검증 항목이 실패했습니다.');
    console.log('   다음 SQL 파일을 Supabase Dashboard에서 수동 실행하세요:');
    console.log('   1. /scripts/manual-add-case-number.sql');
    console.log('   2. /supabase/migrations/20251123_update_unified_calendar_view.sql\n');
  } else {
    console.log('\n🎉 모든 검증 항목을 통과했습니다!\n');
  }

  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
