/**
 * 다른 사건 단일 테스트: 2024드단21385
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const SCOURT_BASE_URL = 'https://ssgo.scourt.go.kr';

async function main() {
  console.log('='.repeat(60));
  console.log('다른 사건 단일 테스트: 2023드단2418');
  console.log('='.repeat(60));

  // 세션 생성
  const init = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`);
  const cookie = init.headers.get('set-cookie');
  const wmonid = cookie?.match(/WMONID=([^;]+)/)?.[1];
  const jsession = cookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  console.log(`WMONID: ${wmonid}`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsession}`,
    'Origin': SCOURT_BASE_URL,
    'Referer': `${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`,
  };

  // 캡챠
  const solver = getVisionCaptchaSolver();
  const captchaRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
    method: 'POST', headers, body: '',
  });
  const captchaData = await captchaRes.json();
  const img = captchaData?.data?.dma_captchaInf?.image;
  const buf = Buffer.from(img.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const result = await solver.solveCaptcha(buf);
  console.log(`캡챠: ${result.text}`);

  // 검색 (2023드단2418 - 수원가정)
  // csNoHistLst: 2023 + 150(드단) + 002418
  const csNoHistLst = '20231500002418';

  console.log(`\n검색: 2023드단2418 (수원가정)`);
  console.log(`csNoHistLst: ${csNoHistLst}`);

  const searchRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '수원가정법원',
        cdScope: 'ALL',
        csNoHistLst: csNoHistLst,
        csDvsCd: '드단',
        csYr: '2023',
        csSerial: '2418',
        btprNm: '김',
        answer: result.text,
        fullCsNo: '',
      },
    }),
  });

  const searchData = await searchRes.json();

  if (searchData.errors) {
    console.log(`❌ 검색 실패: ${searchData.errors.errorMessage}`);
    return;
  }

  const encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;
  console.log(`encCsNo: ${encCsNo?.substring(0, 40)}... (${encCsNo?.length}자)`);

  if (!encCsNo || encCsNo.length !== 64) {
    console.log('❌ 64자 encCsNo 획득 실패');
    return;
  }

  // 새 세션
  const init2 = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`, {
    headers: { 'Cookie': `WMONID=${wmonid}` },
  });
  const cookie2 = init2.headers.get('set-cookie');
  const jsession2 = cookie2?.match(/JSESSIONID=([^;]+)/)?.[1];

  console.log(`\n새 세션: ${jsession2?.substring(0, 20)}...`);

  // 상세 조회 (캡챠 없이)
  const detailRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
    method: 'POST',
    headers: { ...headers, 'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsession2}` },
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',  // 수원가정법원
        csNo: '',
        encCsNo: encCsNo,
        csYear: '2023',
        csDvsCd: '150',
        csSerial: '2418',
        btprtNm: '',
        captchaAnswer: '',
      },
    }),
  });

  const detailData = await detailRes.json();

  if (detailData.errors) {
    console.log(`❌ 상세 조회 실패: ${detailData.errors.errorMessage}`);
  } else if (detailData.data) {
    console.log(`✅ 성공! 사건명: ${detailData.data.dma_csBasCtt?.csNm}`);
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
