/**
 * 저장된 encCsNo로 캡챠 없이 접근 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@/lib/supabase';

async function main() {
  console.log('=== encCsNo 캡챠 없이 접근 테스트 ===\n');

  const supabase = createClient();

  // 1. DB에서 저장된 사건 조회
  const { data: cases } = await supabase
    .from('scourt_profile_cases')
    .select('case_number, court_name, enc_cs_no')
    .not('enc_cs_no', 'is', null)
    .limit(1);

  if (!cases || cases.length === 0) {
    console.log('저장된 encCsNo가 없습니다.');
    return;
  }

  const testCase = cases[0];
  console.log(`테스트 사건: ${testCase.case_number} (${testCase.court_name})`);
  console.log(`encCsNo: ${testCase.enc_cs_no}\n`);

  // 2. 새 세션 생성
  console.log('🔐 새 API 세션 생성...');
  const response = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const setCookie = response.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);

  if (!jsessionMatch) {
    console.log('세션 생성 실패');
    return;
  }

  const jsessionId = jsessionMatch[1];
  console.log(`세션: ${jsessionId.substring(0, 20)}...\n`);

  // 3. encCsNo만으로 일반내용 조회 시도 (캡챠 없이)
  console.log('📋 encCsNo로 일반내용 조회 시도 (captchaAnswer 없음)...\n');

  const generalRequest = {
    dma_search: {
      cortCd: '000302', // 수원가정법원
      csNo: '',
      encCsNo: testCase.enc_cs_no,
      csYear: '2024',
      csDvsCd: '150', // 드단
      csSerial: '26718',
      btprtNm: '',
      captchaAnswer: '', // 빈 캡챠
    },
  };

  console.log('요청:', JSON.stringify(generalRequest, null, 2));

  const generalResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        'Cookie': `JSESSIONID=${jsessionId}`,
        'Origin': 'https://ssgo.scourt.go.kr',
        'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
      },
      body: JSON.stringify(generalRequest),
    }
  );

  const generalData = await generalResponse.json();

  console.log('\n=== 응답 ===');
  console.log(JSON.stringify(generalData, null, 2));

  // 4. 결과 분석
  if (generalData.errors) {
    console.log('\n❌ 실패:', generalData.errors.errorMessage);
  } else if (generalData.data) {
    console.log('\n✅ 성공! 캡챠 없이 일반내용 조회 가능');
  }
}

main().catch(console.error);
