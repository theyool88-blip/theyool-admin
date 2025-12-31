/**
 * WMONID 쿠키를 유지하면서 encCsNo 테스트
 *
 * 가설: WMONID가 브라우저를 식별하고, 이를 통해 encCsNo가 바인딩됨
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('=== WMONID로 encCsNo 바인딩 테스트 ===\n');

  // 1. 첫 번째 세션 - WMONID 획득
  console.log('🔐 세션 1: WMONID 획득...');
  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const setCookie = initResponse.headers.get('set-cookie');

  console.log('Set-Cookie:', setCookie);

  const wmonidMatch = setCookie?.match(/WMONID=([^;]+)/);
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);

  const wmonid = wmonidMatch?.[1];
  const jsessionId1 = jsessionMatch?.[1];

  console.log(`WMONID: ${wmonid}`);
  console.log(`JSESSIONID: ${jsessionId1?.substring(0, 20)}...\n`);

  if (!wmonid || !jsessionId1) {
    console.log('쿠키 획득 실패');
    return;
  }

  // 2. 캡챠 획득 및 검색 (WMONID + JSESSIONID 사용)
  const headers1 = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId1}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  console.log('🖼️ 캡챠 획득...');
  const captchaResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on',
    { method: 'POST', headers: headers1, body: '' }
  );
  const captchaData = await captchaResponse.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;

  if (!captchaImage) {
    console.log('캡챠 이미지 획득 실패');
    return;
  }

  const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const solver = getVisionCaptchaSolver();
  const captchaResult = await solver.solveCaptcha(imageBuffer);

  if (!captchaResult.text) {
    console.log('캡챠 인식 실패');
    return;
  }

  console.log(`캡챠 인식: ${captchaResult.text}\n`);

  // 3. 검색 실행
  console.log('🔍 검색...');
  const searchRequest = {
    dma_search: {
      cortCd: '수원가정법원',
      cdScope: 'ALL',
      csNoHistLst: '',
      csDvsCd: '드단',
      csYr: '2024',
      csSerial: '26718',
      btprNm: '김',
      answer: captchaResult.text,
      fullCsNo: '',
    },
  };

  const searchResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on',
    { method: 'POST', headers: headers1, body: JSON.stringify(searchRequest) }
  );

  const searchData = await searchResponse.json();
  const encCsNo1 = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;

  console.log(`세션1 encCsNo (${encCsNo1?.length}자): ${encCsNo1}\n`);

  if (!encCsNo1) {
    console.log('encCsNo 획득 실패');
    return;
  }

  // 4. 새 세션 생성 (동일한 WMONID, 새로운 JSESSIONID)
  console.log('🔄 세션 2: 동일 WMONID, 새 JSESSIONID...');

  const initResponse2 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: {
      'Cookie': `WMONID=${wmonid}`,  // WMONID만 전송
    }
  });

  const setCookie2 = initResponse2.headers.get('set-cookie');
  const jsessionMatch2 = setCookie2?.match(/JSESSIONID=([^;]+)/);
  const jsessionId2 = jsessionMatch2?.[1];

  console.log(`새 JSESSIONID: ${jsessionId2?.substring(0, 20)}...\n`);

  // 5. 새 세션에서 encCsNo로 상세 조회 (WMONID 포함)
  console.log('📋 세션2에서 encCsNo 접근 (WMONID 포함)...');

  const headers2 = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId2}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  const detailResponse = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',
    {
      method: 'POST',
      headers: headers2,
      body: JSON.stringify({
        dma_search: {
          cortCd: '000302',
          csNo: '',
          encCsNo: encCsNo1,
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
    console.log('❌ WMONID 포함해도 실패:', detailData.errors.errorMessage);
  } else if (detailData.data) {
    console.log('✅ 성공! WMONID가 핵심!');
    console.log('사건명:', detailData.data.dma_csBasCtt?.csNm);
  }

  // 6. 완전히 새로운 세션 (WMONID 없이)
  console.log('\n🔄 세션 3: WMONID 없이 완전 새 세션...');

  const initResponse3 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const setCookie3 = initResponse3.headers.get('set-cookie');
  const jsessionMatch3 = setCookie3?.match(/JSESSIONID=([^;]+)/);
  const jsessionId3 = jsessionMatch3?.[1];

  const headers3 = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `JSESSIONID=${jsessionId3}`,  // WMONID 없음
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  const detailResponse3 = await fetch(
    'https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',
    {
      method: 'POST',
      headers: headers3,
      body: JSON.stringify({
        dma_search: {
          cortCd: '000302',
          csNo: '',
          encCsNo: encCsNo1,
          csYear: '2024',
          csDvsCd: '150',
          csSerial: '26718',
          btprtNm: '',
          captchaAnswer: '',
        },
      }),
    }
  );

  const detailData3 = await detailResponse3.json();

  if (detailData3.errors) {
    console.log('❌ WMONID 없으면 실패:', detailData3.errors.errorMessage);
  } else if (detailData3.data) {
    console.log('✅ WMONID 없어도 성공 (다른 요인)');
  }
}

main().catch(console.error);
