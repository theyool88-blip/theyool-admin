/**
 * csNoHistLst 파라미터로 재사용 가능한 encCsNo 획득 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('=== csNoHistLst로 encCsNo 획득 테스트 ===\n');

  // 1. 세션 생성
  console.log('🔐 세션 생성...');
  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const setCookie = initResponse.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);

  if (!jsessionMatch) {
    console.log('세션 생성 실패');
    return;
  }

  const jsessionId = jsessionMatch[1];
  console.log(`세션: ${jsessionId.substring(0, 20)}...\n`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `JSESSIONID=${jsessionId}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 캡챠 획득
  console.log('🖼️ 캡챠 획득...');
  const captchaResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on',
    { method: 'POST', headers, body: '' }
  );
  const captchaData = await captchaResponse.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;

  if (!captchaImage) {
    console.log('캡챠 이미지 획득 실패');
    return;
  }

  // 3. 캡챠 인식
  const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const solver = getVisionCaptchaSolver();
  const captchaResult = await solver.solveCaptcha(imageBuffer);

  if (!captchaResult.text) {
    console.log('캡챠 인식 실패');
    return;
  }

  console.log(`캡챠 인식: ${captchaResult.text}\n`);

  // 4. 검색 - csNoHistLst 포함
  console.log('🔍 검색 (csNoHistLst 포함)...');

  // 기존 저장된 사건 번호 목록 (브라우저에서 가져온 것)
  const csNoHistLst = '20231510011801,20241500000531,20241500025790,20241500023848,20230790002410,20240710000030,20241500026718';

  const searchRequest = {
    dma_search: {
      cortCd: '수원가정법원',
      cdScope: 'ALL',
      csNoHistLst: csNoHistLst,  // 핵심: 기존 사건 목록 포함
      csDvsCd: '드단',
      csYr: '2024',
      csSerial: '26718',
      btprNm: '김',
      answer: captchaResult.text,
      fullCsNo: '',
    },
  };

  console.log('요청:', JSON.stringify(searchRequest, null, 2));

  const searchResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on',
    {
      method: 'POST',
      headers,
      body: JSON.stringify(searchRequest),
    }
  );

  const searchData = await searchResponse.json();

  console.log('\n=== 검색 응답 ===');
  console.log(JSON.stringify(searchData, null, 2));

  // 5. encCsNo 확인
  const encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;
  console.log('\n=== encCsNo ===');
  console.log(`길이: ${encCsNo?.length || 0}자`);
  console.log(`값: ${encCsNo}`);

  if (encCsNo && encCsNo.length === 64) {
    console.log('\n✅ 64자 encCsNo 획득! (브라우저와 동일한 형식)');

    // 6. 새 세션에서 이 encCsNo로 접근 테스트
    console.log('\n🔄 새 세션에서 encCsNo 접근 테스트...');

    const newInitResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
    const newSetCookie = newInitResponse.headers.get('set-cookie');
    const newJsessionMatch = newSetCookie?.match(/JSESSIONID=([^;]+)/);
    const newJsessionId = newJsessionMatch?.[1];

    const detailResponse = await fetch(
      'https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',
      {
        method: 'POST',
        headers: {
          ...headers,
          'Cookie': `JSESSIONID=${newJsessionId}`,
        },
        body: JSON.stringify({
          dma_search: {
            cortCd: '000302',
            csNo: '',
            encCsNo: encCsNo,
            csYear: '2024',
            csDvsCd: '150',
            csSerial: '26718',
            btprtNm: '',
            captchaAnswer: '',
          },
        }),
      }
    );

    const detailData = await detailResponse.json();

    if (detailData.errors) {
      console.log('❌ 실패:', detailData.errors.errorMessage);
    } else if (detailData.data) {
      console.log('✅ 성공! API로 획득한 encCsNo로 캡챠 없이 접근 가능!');
    }

  } else {
    console.log(`\n⚠️ ${encCsNo?.length || 0}자 encCsNo (44자면 세션 한정)`);
  }
}

main().catch(console.error);
