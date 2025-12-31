/**
 * API 검색 테스트 스크립트
 *
 * 테스트 목표:
 * 1. 세션 매니저 초기화
 * 2. PyTorch 캡챠 모델로 검색
 * 3. 검색 결과 확인
 *
 * 실행: npx tsx scripts/test-api-search.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtSessionManager } from '../lib/scourt/session-manager';

// 테스트할 사건 정보 (legal_cases에서 가져온 실제 데이터)
const TEST_CASE = {
  caseYear: '2023',
  caseType: '드단',
  caseSerial: '2418',
  partyName: '김',
};

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  나의사건검색 API 테스트');
  console.log('═'.repeat(60));
  console.log('');

  const sessionManager = getScourtSessionManager();

  try {
    // 1. 프로필 조회/생성
    console.log('1️⃣ 프로필 조회/생성...');
    const profile = await sessionManager.getOrCreateProfile();
    console.log(`   ✅ 프로필: ${profile.profileName}`);
    console.log(`   📊 사용량: ${profile.caseCount}/${profile.maxCases}건`);
    console.log('');

    // 2. 검색 실행
    console.log('2️⃣ 사건 검색 시작...');
    console.log(`   검색 대상: ${TEST_CASE.caseYear}${TEST_CASE.caseType}${TEST_CASE.caseSerial}`);
    console.log(`   당사자명: ${TEST_CASE.partyName}`);
    console.log('   ⏳ 브라우저 시작 중...');
    console.log('');

    const startTime = Date.now();
    const result = await sessionManager.searchCase(
      profile,
      TEST_CASE,
      10 // 최대 10회 캡챠 시도
    );
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success && result.caseInfo) {
      console.log('3️⃣ 검색 결과:');
      console.log(`   ✅ 검색 성공! (${elapsed}초 소요)`);
      console.log(`   법원: ${result.caseInfo.court}`);
      console.log(`   사건번호: ${result.caseInfo.caseNumber}`);
      console.log(`   사건명: ${result.caseInfo.caseName}`);
      console.log(`   캡챠 시도: ${result.captchaAttempts}회`);
    } else {
      console.log('3️⃣ 검색 결과:');
      console.log(`   ❌ 검색 실패 (${elapsed}초 소요)`);
      console.log(`   에러: ${result.error}`);
      console.log(`   캡챠 시도: ${result.captchaAttempts}회`);
    }

    // 4. 브라우저 종료
    console.log('');
    console.log('4️⃣ 브라우저 종료...');
    await sessionManager.closeBrowser(profile.profileName);
    console.log('   ✅ 종료 완료');

  } catch (error: any) {
    console.error('❌ 에러 발생:', error.message);
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log('  테스트 완료');
  console.log('═'.repeat(60));
}

main().catch(console.error);
