/**
 * API 클라이언트 검색 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function main() {
  console.log('=== API 클라이언트 검색 테스트 ===\n');

  const client = getScourtApiClient();

  // 검색 파라미터
  const params = {
    cortCd: '서울가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '홍길동',  // 2글자 이상 필수
  };

  console.log('검색 파라미터:');
  console.log(`  법원: ${params.cortCd}`);
  console.log(`  사건: ${params.csYr}${params.csDvsCd}${params.csSerial}`);
  console.log(`  당사자: ${params.btprNm}`);

  try {
    const result = await client.searchWithCaptcha(params);

    console.log('\n검색 결과:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ API 검색 성공!');
      console.log(`  캡챠 시도 횟수: ${result.captchaAttempts}`);
      if (result.encCsNo) {
        console.log(`  암호화된 사건번호: ${result.encCsNo}`);
      }
    } else {
      console.log('\n❌ API 검색 실패');
      console.log(`  오류: ${result.error}`);
    }

  } catch (error) {
    console.error('에러:', error);
  }
}

main().catch(console.error);
