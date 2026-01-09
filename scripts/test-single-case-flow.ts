/**
 * 단일 사건 등록 → 즉시 캡챠 없이 조회 테스트
 *
 * 이전 성공 테스트와 동일한 흐름으로 검증
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const SCOURT_BASE_URL = 'https://ssgo.scourt.go.kr';

async function main() {
  console.log('='.repeat(60));
  console.log('단일 사건 등록 → 캡챠 없이 조회 테스트');
  console.log('='.repeat(60));

  // 1. 세션 생성
  console.log('\n[1] 세션 생성...');
  const initRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`);
  const setCookie = initRes.headers.get('set-cookie');

  const wmonid = setCookie?.match(/WMONID=([^;]+)/)?.[1];
  const jsessionId = setCookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  console.log(`WMONID: ${wmonid}`);
  console.log(`JSESSIONID: ${jsessionId?.substring(0, 20)}...`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
    'Origin': SCOURT_BASE_URL,
    'Referer': `${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`,
  };

  // 2. 캡챠 획득 및 인식
  console.log('\n[2] 캡챠 획득...');
  const captchaRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
    method: 'POST',
    headers,
    body: '',
  });
  const captchaData = await captchaRes.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;

  const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const solver = getVisionCaptchaSolver();
  const captchaResult = await solver.solveCaptcha(imageBuffer);
  console.log(`캡챠: ${captchaResult.text}`);

  // 3. csNoHistLst 포함 검색 (2024드단26718)
  console.log('\n[3] csNoHistLst 포함 검색...');

  const csNoHistLst = '20241500026718';  // 2024 + 150(드단) + 026718

  const searchRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '수원가정법원',
        cdScope: 'ALL',
        csNoHistLst: csNoHistLst,
        csDvsCd: '드단',
        csYr: '2024',
        csSerial: '26718',
        btprNm: '김',
        answer: captchaResult.text,
        fullCsNo: '',
      },
    }),
  });

  const searchData = await searchRes.json();

  if (searchData.errors) {
    console.log('❌ 검색 실패:', searchData.errors.errorMessage);
    return;
  }

  const encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;
  console.log(`encCsNo: ${encCsNo} (${encCsNo?.length}자)`);

  if (!encCsNo || encCsNo.length !== 64) {
    console.log('❌ 64자 encCsNo 획득 실패');
    return;
  }

  // 4. 새 세션 (같은 WMONID)
  console.log('\n[4] 새 세션 생성 (같은 WMONID)...');

  const testInitRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`, {
    headers: { 'Cookie': `WMONID=${wmonid}` },
  });
  const testCookie = testInitRes.headers.get('set-cookie');
  const testJsession = testCookie?.match(/JSESSIONID=([^;]+)/)?.[1];
  const testWmonid = testCookie?.match(/WMONID=([^;]+)/)?.[1];

  console.log(`새 JSESSIONID: ${testJsession?.substring(0, 20)}...`);
  console.log(`WMONID 유지: ${testWmonid ? '새로 발급됨: ' + testWmonid : '유지됨 (OK)'}`);

  // 5. 캡챠 없이 일반내용 조회
  console.log('\n[5] 캡챠 없이 일반내용 조회...');

  const generalRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
    method: 'POST',
    headers: {
      ...headers,
      'Cookie': `WMONID=${wmonid}; JSESSIONID=${testJsession}`,
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
  });

  const generalData = await generalRes.json();

  if (generalData.errors) {
    console.log('❌ 실패:', generalData.errors.errorMessage);
    console.log('\n전체 응답:', JSON.stringify(generalData, null, 2));
  } else if (generalData.data) {
    console.log('✅ 성공!');
    console.log('사건명:', generalData.data.dma_csBasCtt?.csNm);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
