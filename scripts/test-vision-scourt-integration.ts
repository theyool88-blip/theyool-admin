/**
 * Google Vision API + 대법원 스크래퍼 통합 테스트
 *
 * 실제 사건번호로 조회 테스트
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { ScourtScraper, CaseSearchParams } from '../lib/scourt/scraper';

async function testIntegration() {
  console.log('🚀 Google Vision API + 대법원 스크래퍼 통합 테스트\n');
  console.log('='.repeat(60));

  // 실제 사건 정보 (수원가정법원 2024드단26718)
  const testCase: CaseSearchParams = {
    courtName: '수원가정법원',
    caseYear: '2024',
    caseType: '드단',
    caseNumber: '26718',
    partyName: '김윤한'
  };

  console.log('\n📋 검색할 사건 정보:');
  console.log(`  - 법원: ${testCase.courtName}`);
  console.log(`  - 사건번호: ${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`);
  console.log(`  - 당사자: ${testCase.partyName}`);
  console.log('='.repeat(60));

  const scraper = new ScourtScraper();

  try {
    // 1. 브라우저 초기화
    console.log('\n📍 Step 1: 브라우저 초기화');
    await scraper.initialize(false);  // headless: false (브라우저 보이기)
    console.log('✓ 브라우저 시작됨');

    // 2. 사건 검색
    console.log('\n📍 Step 2: 사건 검색 시작');
    const result = await scraper.searchCase(testCase);

    // 3. 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 검색 결과:');
    console.log('='.repeat(60));

    if (result.success) {
      console.log('✅ 검색 성공!');
      console.log(`\n인식된 캡챠: "${result.captchaText}"`);
      console.log('\n검색 결과 데이터:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ 검색 실패');
      console.log(`에러: ${result.error}`);
      if (result.captchaText) {
        console.log(`마지막 시도 캡챠: "${result.captchaText}"`);
      }
    }

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
  } finally {
    // 4. 정리
    console.log('\n📍 Step 3: 브라우저 종료');
    await scraper.close();
    console.log('✓ 브라우저 종료됨');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 테스트 완료');
  console.log('='.repeat(60));
}

// 메인 함수
async function main() {
  // 환경변수 확인
  console.log('🔍 환경변수 확인...\n');

  if (process.env.GOOGLE_VISION_CREDENTIALS) {
    console.log('✅ GOOGLE_VISION_CREDENTIALS 설정됨');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ GOOGLE_APPLICATION_CREDENTIALS 설정됨');
    console.log(`   파일: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  } else {
    console.log('⚠️  Google Vision API 인증 정보가 설정되지 않았습니다!');
    console.log('\n다음 중 하나를 설정하세요:');
    console.log('  1. GOOGLE_VISION_CREDENTIALS (JSON 문자열)');
    console.log('  2. GOOGLE_APPLICATION_CREDENTIALS (파일 경로)');
    console.log('\n자세한 내용은 docs/guides/GOOGLE_VISION_SETUP.md를 참고하세요.\n');
    console.log('⚠️  인증 없이 계속 진행하면 에러가 발생할 수 있습니다.');
    console.log('그래도 계속하시겠습니까? (5초 대기...)\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // 테스트 실행
  await testIntegration();
}

// 실행
main()
  .then(() => {
    console.log('\n✓ 프로그램 정상 종료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 프로그램 에러:', error);
    process.exit(1);
  });
