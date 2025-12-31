/**
 * API 검색 + 상세 조회 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function main() {
  console.log('=== API 검색 + 상세 조회 테스트 ===\n');

  const client = getScourtApiClient();

  const params = {
    cortCd: '서울가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '홍길동',
  };

  console.log('검색 파라미터:', params);

  try {
    // searchAndGetDetail 메서드 사용
    const result = await client.searchAndGetDetail(params);

    console.log('\n=== 검색 결과 ===');
    console.log('성공:', result.searchResult.success);
    console.log('캡챠 시도:', result.searchResult.captchaAttempts);

    if (result.searchResult.encCsNo) {
      console.log('암호화된 사건번호:', result.searchResult.encCsNo);
    }

    if (result.detailResult) {
      console.log('\n=== 상세 정보 ===');
      console.log('성공:', result.detailResult.success);

      if (result.detailResult.success && result.detailResult.data) {
        const detail = result.detailResult.data;
        console.log('사건번호:', detail.csNo);
        console.log('법원:', detail.cortNm);
        console.log('사건명:', detail.csNm);
        console.log('당사자:', detail.parties);
        console.log('기일:', detail.hearings);
      } else if (result.detailResult.error) {
        console.log('상세 조회 에러:', result.detailResult.error);
      }
    }

    // 전체 응답 출력
    console.log('\n=== 전체 응답 (JSON) ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('에러:', error);
  }
}

main().catch(console.error);
