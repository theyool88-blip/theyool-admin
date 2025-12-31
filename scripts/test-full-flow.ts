/**
 * 전체 흐름 테스트: 검색 → 상세 조회 → 새 세션에서 재접근
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('=== 전체 흐름 테스트 ===\n');

  // 1. 세션 생성
  console.log('🔐 세션 생성...');
  const init = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const cookie = init.headers.get('set-cookie');
  const jsession = cookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `JSESSIONID=${jsession}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 캡챠 솔버
  const solver = getVisionCaptchaSolver();

  // 2. 캡챠 획득 및 검색
  console.log('🖼️ 캡챠 1 획득...');
  let captchaRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on', {
    method: 'POST', headers, body: ''
  });
  let captchaData = await captchaRes.json();
  let captchaImage = captchaData?.data?.dma_captchaInf?.image;

  let imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  let captchaResult = await solver.solveCaptcha(imageBuffer);
  console.log(`캡챠1: ${captchaResult.text}`);

  // 검색
  console.log('\n🔍 검색...');
  const searchRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '수원가정법원',
        cdScope: 'ALL',
        csNoHistLst: '',
        csDvsCd: '드단',
        csYr: '2024',
        csSerial: '26718',
        btprNm: '김윤한',
        answer: captchaResult.text,
        fullCsNo: '',
      },
    }),
  });

  const searchData = await searchRes.json();
  const searchEncCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;
  console.log(`검색 encCsNo (${searchEncCsNo?.length}자): ${searchEncCsNo?.substring(0, 30)}...`);

  if (!searchEncCsNo) {
    console.log('검색 실패:', searchData);
    return;
  }

  // 3. 새 캡챠로 상세 조회
  console.log('\n🖼️ 캡챠 2 획득...');
  captchaRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on', {
    method: 'POST', headers, body: ''
  });
  captchaData = await captchaRes.json();
  captchaImage = captchaData?.data?.dma_captchaInf?.image;

  imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  captchaResult = await solver.solveCaptcha(imageBuffer);
  console.log(`캡챠2: ${captchaResult.text}`);

  console.log('\n📋 상세 조회...');
  const detailRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',
        csNo: '',
        encCsNo: searchEncCsNo,
        csYear: '2024',
        csDvsCd: '150',
        csSerial: '26718',
        btprtNm: '김윤한',
        captchaAnswer: captchaResult.text,  // 캡챠 답만 (토큰 없이)
      },
    }),
  });

  const detailData = await detailRes.json();

  if (detailData.errors) {
    console.log('상세 조회 실패:', detailData.errors.errorMessage);
    console.log('전체 응답:', JSON.stringify(detailData, null, 2));
    return;
  }

  const detailEncCsNo = detailData?.data?.dma_csBasCtt?.encCsNo;
  console.log(`✅ 상세 조회 성공!`);
  console.log(`사건명: ${detailData?.data?.dma_csBasCtt?.csNm}`);
  console.log(`상세 encCsNo (${detailEncCsNo?.length}자): ${detailEncCsNo?.substring(0, 30)}...`);

  // 4. 새 세션에서 상세 encCsNo로 접근
  console.log('\n🔄 새 세션에서 상세 encCsNo 테스트...');

  const init2 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const cookie2 = init2.headers.get('set-cookie');
  const jsession2 = cookie2?.match(/JSESSIONID=([^;]+)/)?.[1];

  const testRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
    method: 'POST',
    headers: {
      ...headers,
      'Cookie': `JSESSIONID=${jsession2}`,
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',
        csNo: '',
        encCsNo: detailEncCsNo,
        csYear: '2024',
        csDvsCd: '150',
        csSerial: '26718',
        btprtNm: '',
        captchaAnswer: '',
      },
    }),
  });

  const testData = await testRes.json();

  if (testData.errors) {
    console.log('❌ 실패:', testData.errors.errorMessage);
  } else {
    console.log('✅ 성공! 상세 API의 encCsNo가 재사용 가능!');
  }
}

main().catch(console.error);
