/**
 * 대법원 사건 검색 전체 플로우 테스트
 *
 * npx tsx scripts/test-scourt-search-flow.ts
 */

import { getScourtSessionManager } from '../lib/scourt/session-manager';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function testSearchFlow() {
  console.log('🧪 대법원 사건 검색 테스트\n');

  const sessionManager = getScourtSessionManager();

  try {
    // 1. 프로필 생성/조회
    console.log('1️⃣ 프로필 조회/생성...');
    const profile = await sessionManager.getOrCreateProfile();
    console.log(`   ✅ 프로필: ${profile.profileName}`);
    console.log(`   📊 사용량: ${profile.caseCount}/${profile.maxCases}건\n`);

    // 2. 사용량 확인
    const usage = await sessionManager.getProfileUsage();
    console.log(`2️⃣ 전체 사용량:`);
    console.log(`   프로필: ${usage.profileCount}/${usage.maxProfiles}개`);
    console.log(`   사건: ${usage.totalCases}/${usage.maxTotalCases}건`);
    console.log(`   남은 슬롯: ${usage.remainingProfiles}개 프로필\n`);

    // 3. 검색 파라미터 입력
    console.log('3️⃣ 검색할 사건 정보 입력:');
    const caseYear = await ask('   연도 (예: 2024): ') || '2024';
    const caseType = await ask('   구분 (예: 드단, 가단): ') || '드단';
    const caseSerial = await ask('   일련번호 (예: 26718): ');
    const partyName = await ask('   당사자명 (예: 김): ') || '김';

    if (!caseSerial) {
      console.log('\n❌ 일련번호는 필수입니다.');
      rl.close();
      return;
    }

    // 4. 검색 실행
    console.log(`\n4️⃣ 검색 시작: ${caseYear}${caseType}${caseSerial} (당사자: ${partyName})`);
    console.log('   ⏳ 브라우저 시작 중... (headless: false로 실행)\n');

    const result = await sessionManager.searchCase(
      profile,
      {
        caseYear,
        caseType,
        caseSerial,
        partyName,
      },
      10 // 최대 10회 캡챠 시도
    );

    if (result.success && result.caseInfo) {
      console.log('\n✅ 검색 성공!');
      console.log(`   법원: ${result.caseInfo.court}`);
      console.log(`   사건번호: ${result.caseInfo.caseNumber}`);
      console.log(`   사건명: ${result.caseInfo.caseName}`);
      console.log(`   캡챠 시도: ${result.captchaAttempts}회`);

      // 5. 상세 조회 테스트
      const doDetail = await ask('\n상세 조회 테스트? (y/n): ');
      if (doDetail.toLowerCase() === 'y') {
        console.log('\n5️⃣ 상세 조회 시작 (캡챠 불필요!)...');
        const detailResult = await sessionManager.getCaseDetail(
          profile,
          result.caseInfo.caseNumber
        );

        if (detailResult.success && detailResult.detail) {
          console.log('\n✅ 상세 조회 성공!');
          console.log(`   사건번호: ${detailResult.detail.caseNumber}`);
          console.log(`   사건명: ${detailResult.detail.caseName}`);
          console.log(`   법원: ${detailResult.detail.court}`);
          console.log(`   재판부: ${detailResult.detail.judge}`);
          console.log(`   원고: ${detailResult.detail.plaintiffs.join(', ')}`);
          console.log(`   피고: ${detailResult.detail.defendants.join(', ')}`);
          console.log(`   접수일: ${detailResult.detail.filingDate}`);
          if (detailResult.detail.hearings.length > 0) {
            console.log(`   기일: ${detailResult.detail.hearings.length}건`);
            detailResult.detail.hearings.forEach((h, i) => {
              console.log(`      ${i + 1}. ${h.date} ${h.time} - ${h.type}`);
            });
          }
        } else {
          console.log(`\n❌ 상세 조회 실패: ${detailResult.error}`);
        }
      }
    } else {
      console.log(`\n❌ 검색 실패: ${result.error}`);
      console.log(`   캡챠 시도: ${result.captchaAttempts}회`);
    }

    // 6. 브라우저 종료
    const keepBrowser = await ask('\n브라우저 유지? (y/n): ');
    if (keepBrowser.toLowerCase() !== 'y') {
      await sessionManager.closeBrowser(profile.profileName);
      console.log('브라우저 종료됨');
    } else {
      console.log('브라우저가 유지됩니다. 수동으로 확인 후 종료하세요.');
    }

  } catch (error) {
    console.error('\n❌ 에러:', error);
  } finally {
    rl.close();
  }
}

testSearchFlow();
