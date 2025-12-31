/**
 * API 클라이언트 테스트
 * 브라우저 없이 직접 API 호출로 사건 검색 테스트
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function testApiClient() {
  console.log('🧪 API 클라이언트 테스트 시작\n');

  const client = getScourtApiClient();

  // 1. 세션 초기화 테스트
  console.log('='.repeat(60));
  console.log('1️⃣ 세션 초기화 테스트');
  console.log('='.repeat(60));

  const sessionOk = await client.initSession();
  console.log(`세션 초기화: ${sessionOk ? '✅ 성공' : '❌ 실패'}`);

  if (!sessionOk) {
    console.log('\n세션 초기화 실패. 종료합니다.');
    return;
  }

  const session = client.getSession();
  console.log(`JSESSIONID: ${session?.jsessionId.substring(0, 30)}...`);

  // 2. 캡챠 API 테스트
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣ 캡챠 API 테스트');
  console.log('='.repeat(60));

  const captchaImage = await client['getCaptchaImage']();
  console.log(`캡챠 이미지: ${captchaImage ? `✅ 획득 (${captchaImage.image.length} bytes)` : '❌ 실패'}`);

  // 3. 검색 API 테스트 (캡챠 없이 구조만 확인)
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣ 검색 API 구조 테스트 (빈 캡챠)');
  console.log('='.repeat(60));

  const searchResult = await client['searchCase'](
    {
      cortCd: '수원가정법원',
      csYr: '2024',
      csDvsCd: '드단',
      csSerial: '26718',
      btprNm: '김윤한',
    },
    'TEST' // 테스트용 캡챠 값
  );

  console.log(`검색 결과: ${searchResult.success ? '✅ 성공' : '⚠️ 예상된 실패'}`);
  console.log(`응답 데이터 키:`, searchResult.data ? Object.keys(searchResult.data) : 'null');

  if (searchResult.error) {
    console.log(`에러 메시지: ${searchResult.error}`);
  }

  // 4. 전체 플로우 테스트 (캡챠 해결 포함)
  console.log('\n' + '='.repeat(60));
  console.log('4️⃣ 전체 플로우 테스트 (Vision API + 검색)');
  console.log('='.repeat(60));

  const fullResult = await client.searchWithCaptcha({
    cortCd: '수원가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '김윤한',
  });

  console.log('\n--- 최종 결과 ---');
  console.log(`성공: ${fullResult.success}`);
  console.log(`시도 횟수: ${fullResult.captchaAttempts}`);

  if (fullResult.success) {
    console.log(`데이터:`, JSON.stringify(fullResult.data, null, 2).substring(0, 500));
  } else {
    console.log(`에러: ${fullResult.error}`);
  }

  console.log('\n✅ 테스트 완료');
}

testApiClient()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  });
