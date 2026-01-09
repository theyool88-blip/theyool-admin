/**
 * API로 검색 후 encCsNo 확인
 * - API 검색으로 encCsNo 획득
 * - 이 encCsNo로 캡챠 없이 일반내용 조회 가능한지 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';
import { createClient } from '@/lib/supabase';

async function main() {
  console.log('=== API encCsNo 테스트 ===\n');

  const client = getScourtApiClient();
  const supabase = createClient();

  // 테스트 사건
  const params = {
    cortCd: '수원가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '김윤한',
  };

  console.log(`검색 파라미터:`, params);
  console.log('\n');

  // API 검색
  const result = await client.searchWithCaptcha(params);

  console.log('\n=== 검색 결과 ===');
  console.log('성공:', result.success);
  console.log('캡챠 시도:', result.captchaAttempts);

  if (result.success) {
    console.log('\n응답 데이터:', JSON.stringify(result.data, null, 2));

    // encCsNo 확인
    const encCsNo = result.encCsNo;
    console.log('\n=== encCsNo ===');
    console.log('encCsNo:', encCsNo);

    if (encCsNo) {
      console.log('\n이제 이 encCsNo로 캡챠 없이 일반내용 조회를 시도합니다...');

      // DB에 저장 (테스트용)
      const { error } = await supabase.from('scourt_profile_cases').upsert(
        {
          profile_id: 'test-api-enccsno',
          court_name: '수원가정법원',
          case_number: '2024드단26718',
          case_name: '이혼',
          enc_cs_no: encCsNo,
          last_accessed_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,case_number' }
      );

      if (error) {
        console.log('DB 저장 에러:', error.message);
      } else {
        console.log('DB 저장 완료');
      }

      // 새 세션으로 encCsNo만으로 일반내용 조회 시도
      console.log('\n=== 새 세션에서 encCsNo로 일반내용 조회 ===');

      const newClient = new (await import('../lib/scourt/api-client')).ScourtApiClient();
      await newClient.initSession();

      // captchaAnswer 없이 일반내용 조회
      const generalResult = await newClient.getCaseGeneral({
        cortCd: '000302', // 수원가정법원 코드
        csYear: '2024',
        csDvsCd: '150',   // 드단 코드
        csSerial: '26718',
        btprNm: '김윤한',
        encCsNo: encCsNo,
        captchaAnswer: '', // 빈 캡챠 답
      });

      console.log('일반내용 조회 결과:', generalResult.success);
      if (generalResult.success) {
        console.log('일반내용 데이터:', JSON.stringify(generalResult.data, null, 2));
      } else {
        console.log('에러:', generalResult.error);
      }
    }

  } else {
    console.log('에러:', result.error);
  }
}

main().catch(console.error);
