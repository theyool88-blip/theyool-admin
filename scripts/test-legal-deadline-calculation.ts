/**
 * 법정 기간 계산 테스트 스크립트
 * 민법 제161조 적용 확인
 */

import {
  calculateLegalDeadline,
  calculateLegalDeadlineString,
  isNonBusinessDay,
  isSaturday,
  isSunday,
  isPublicHoliday,
  KOREAN_PUBLIC_HOLIDAYS_2025
} from '../lib/utils/korean-legal-dates';

interface TestCase {
  name: string;
  triggerDate: string;
  days: number;
  excludeInitialDay: boolean;
  expectedDeadline: string;
  reason: string;
}

const TEST_CASES: TestCase[] = [
  // 1. 기본 케이스: 평일 → 평일
  {
    name: '평일 선고 → 평일 만료',
    triggerDate: '2025-03-03', // 월요일 (삼일절 대체공휴일)
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-03-17', // 월요일
    reason: '삼일절 대체공휴일이지만 기산일이므로 14일 후 월요일'
  },

  // 2. 토요일 연장 케이스
  {
    name: '평일 선고 → 토요일 만료 → 월요일 연장',
    triggerDate: '2025-03-01', // 토요일 (삼일절)
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-03-17', // 월요일 (15일 토요일 → 17일 월요일)
    reason: '3/15(토) → 민법 제161조에 따라 3/17(월)로 연장'
  },

  // 3. 일요일 연장 케이스 (공휴일로 처리)
  {
    name: '평일 선고 → 일요일 만료 → 월요일 연장',
    triggerDate: '2025-03-02', // 일요일
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-03-17', // 월요일 (16일 일요일 → 17일 월요일)
    reason: '3/16(일) → 일요일은 공휴일이므로 3/17(월)로 연장'
  },

  // 4. 공휴일 연장 케이스
  {
    name: '평일 선고 → 어린이날(화) 만료 → 대체공휴일(화)로 연장',
    triggerDate: '2025-04-21', // 월요일
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-05-07', // 수요일 (5/5 공휴일 → 5/6 대체공휴일 → 5/7)
    reason: '5/5(월, 어린이날) → 5/6(화, 대체공휴일) → 5/7(수)로 연장'
  },

  // 5. 추석 연휴 케이스
  {
    name: '평일 선고 → 추석 연휴 만료 → 연휴 다음날로 연장',
    triggerDate: '2025-09-22', // 월요일
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-10-10', // 금요일 (10/6 추석 → 10/9 한글날 다음 평일)
    reason: '10/6(월, 추석) → 10/7(화, 추석연휴) → 10/8(수, 대체공휴일) → 10/9(목, 한글날) → 10/10(금)'
  },

  // 6. 초일불산입 케이스
  {
    name: '초일불산입 적용 (즉시항고기간)',
    triggerDate: '2025-03-03', // 월요일
    days: 7,
    excludeInitialDay: true,
    expectedDeadline: '2025-03-11', // 화요일 (3/4부터 시작 → 3/10까지 7일 → 평일이므로 그대로)
    reason: '초일불산입: 3/4부터 계산 → 3/11(화)'
  },

  // 7. 연말연시 케이스
  {
    name: '연말 선고 → 신정 만료 → 연장',
    triggerDate: '2024-12-18', // 수요일
    days: 14,
    excludeInitialDay: false,
    expectedDeadline: '2025-01-02', // 목요일 (1/1 신정 → 1/2)
    reason: '2025/1/1(수, 신정) → 2025/1/2(목)로 연장'
  }
];

function formatDate(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  return `${date.toISOString().split('T')[0]} (${dayOfWeek})`;
}

function runTests() {
  console.log('\n🧪 법정 기간 계산 테스트 (민법 제161조 적용)\n');
  console.log('='.repeat(80));

  let passCount = 0;
  let failCount = 0;

  TEST_CASES.forEach((testCase, index) => {
    console.log(`\n[테스트 ${index + 1}] ${testCase.name}`);
    console.log(`기산일: ${testCase.triggerDate} (${testCase.days}일 기간)`);
    console.log(`초일불산입: ${testCase.excludeInitialDay ? '적용' : '미적용'}`);
    console.log(`예상 만료일: ${testCase.expectedDeadline}`);
    console.log(`사유: ${testCase.reason}`);

    try {
      const actualDeadline = calculateLegalDeadlineString(
        testCase.triggerDate,
        testCase.days,
        testCase.excludeInitialDay
      );

      const triggerDate = new Date(testCase.triggerDate);
      const expectedDate = new Date(testCase.expectedDeadline);
      const actualDate = new Date(actualDeadline);

      console.log(`\n📅 계산 결과:`);
      console.log(`  기산일: ${formatDate(triggerDate)}`);
      console.log(`  예상: ${formatDate(expectedDate)}`);
      console.log(`  실제: ${formatDate(actualDate)}`);

      // 검증
      if (actualDeadline === testCase.expectedDeadline) {
        console.log(`✅ PASS`);
        passCount++;
      } else {
        console.log(`❌ FAIL - 예상과 다른 결과`);
        failCount++;
      }

      // 추가 정보
      const isWeekend = isSaturday(actualDate) || isSunday(actualDate);
      const isHoliday = isPublicHoliday(actualDate);
      const isNonBusiness = isNonBusinessDay(actualDate);

      if (isWeekend || isHoliday) {
        console.log(`⚠️  경고: 만료일이 ${isWeekend ? '주말' : '공휴일'}입니다!`);
        console.log(`   이는 민법 제161조 위반 가능성이 있습니다.`);
      }

    } catch (error: any) {
      console.log(`❌ ERROR: ${error.message}`);
      failCount++;
    }

    console.log('-'.repeat(80));
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n📊 테스트 결과 요약:`);
  console.log(`  총 테스트: ${TEST_CASES.length}개`);
  console.log(`  ✅ 통과: ${passCount}개`);
  console.log(`  ❌ 실패: ${failCount}개`);
  console.log(`  성공률: ${((passCount / TEST_CASES.length) * 100).toFixed(1)}%`);

  // 공휴일 목록 출력
  console.log(`\n📅 2025년 법정 공휴일 (${KOREAN_PUBLIC_HOLIDAYS_2025.length}개):`);
  KOREAN_PUBLIC_HOLIDAYS_2025.forEach(holiday => {
    const date = new Date(holiday);
    console.log(`  ${formatDate(date)}`);
  });

  console.log('\n');
}

// 테스트 실행
runTests();
