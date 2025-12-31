/**
 * 상세 조회 API에서 반환된 encCsNo가 재사용 가능한지 테스트
 *
 * 가설: 검색 API의 encCsNo가 아닌, 상세 조회 API의 encCsNo가 영구적임
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('=== 상세 조회 encCsNo 재사용 테스트 ===\n');

  // 1. 세션 생성
  console.log('🔐 세션 1 생성...');
  const init1 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const cookie1 = init1.headers.get('set-cookie');
  const jsession1 = cookie1?.match(/JSESSIONID=([^;]+)/)?.[1];
  console.log(`세션1: ${jsession1?.substring(0, 20)}...`);

  const headers1 = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `JSESSIONID=${jsession1}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 캡챠 획득 및 검색
  console.log('\n🖼️ 캡챠 획득...');
  const captchaRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on', {
    method: 'POST', headers: headers1, body: ''
  });
  const captchaData = await captchaRes.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;
  const captchaToken = captchaData?.data?.dma_captchaInf?.answer;

  const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const solver = getVisionCaptchaSolver();
  const captchaResult = await solver.solveCaptcha(imageBuffer);

  if (!captchaResult.text) {
    console.log('캡챠 인식 실패');
    return;
  }
  console.log(`캡챠: ${captchaResult.text}`);

  // 3. 검색 실행
  console.log('\n🔍 검색...');
  const searchRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on', {
    method: 'POST',
    headers: headers1,
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

  console.log(`검색 encCsNo (${searchEncCsNo?.length}자): ${searchEncCsNo}`);

  if (!searchEncCsNo) {
    console.log('검색 실패');
    return;
  }

  // 4. 상세 조회 (같은 세션)
  console.log('\n📋 상세 조회 (세션1)...');
  const detailRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',
        csNo: '',
        encCsNo: searchEncCsNo,
        csYear: '2024',
        csDvsCd: '150',
        csSerial: '26718',
        btprtNm: '김윤한',
        captchaAnswer: captchaResult.text + captchaToken,
      },
    }),
  });

  const detailData = await detailRes.json();

  if (detailData.errors) {
    console.log('상세 조회 실패:', detailData.errors.errorMessage);
    return;
  }

  // 상세 응답에서 새 encCsNo 추출
  const detailEncCsNo = detailData?.data?.dma_csBasCtt?.encCsNo;
  console.log(`상세 encCsNo (${detailEncCsNo?.length}자): ${detailEncCsNo}`);
  console.log(`사건명: ${detailData?.data?.dma_csBasCtt?.csNm}`);

  // 5. 새 세션에서 상세 encCsNo로 접근
  console.log('\n🔄 새 세션에서 상세 encCsNo 테스트...');

  const init2 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const cookie2 = init2.headers.get('set-cookie');
  const jsession2 = cookie2?.match(/JSESSIONID=([^;]+)/)?.[1];
  console.log(`세션2: ${jsession2?.substring(0, 20)}...`);

  const testRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      'Cookie': `JSESSIONID=${jsession2}`,
      'Origin': 'https://ssgo.scourt.go.kr',
      'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',
        csNo: '',
        encCsNo: detailEncCsNo,  // 상세 API에서 받은 encCsNo
        csYear: '2024',
        csDvsCd: '150',
        csSerial: '26718',
        btprtNm: '',
        captchaAnswer: '',  // 캡챠 없이
      },
    }),
  });

  const testData = await testRes.json();

  if (testData.errors) {
    console.log('❌ 상세 encCsNo도 실패:', testData.errors.errorMessage);
  } else if (testData.data) {
    console.log('✅ 성공! 상세 API의 encCsNo가 재사용 가능!');
    console.log('사건명:', testData.data.dma_csBasCtt?.csNm);
  }
}

main().catch(console.error);
