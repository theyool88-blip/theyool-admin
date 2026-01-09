/**
 * 브라우저와 동일한 헤더로 일반내용 API 테스트
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const BASE_URL = 'https://ssgo.scourt.go.kr';

async function testWithBrowserHeaders() {
  console.log('🧪 브라우저 헤더로 일반내용 API 테스트\n');

  // 1. 세션 획득 - 브라우저와 동일한 User-Agent 사용
  console.log('1️⃣ 세션 획득...');
  const sessionRes = await fetch(`${BASE_URL}/ssgo/index.on?cortId=www`, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const setCookie = sessionRes.headers.get('set-cookie');
  const jsessionId = setCookie?.match(/JSESSIONID=([^;]+)/)?.[1];
  const wmonid = setCookie?.match(/WMONID=([^;]+)/)?.[1];

  if (!jsessionId) {
    console.log('❌ 세션 획득 실패');
    return;
  }
  console.log('✅ JSESSIONID:', jsessionId.substring(0, 20) + '...');
  console.log('✅ WMONID:', wmonid);

  // 전체 쿠키 문자열
  const cookies = `WMONID=${wmonid}; JSESSIONID=${jsessionId}`;
  console.log('✅ 쿠키:', cookies.substring(0, 50) + '...\n');

  // 공통 헤더 - 브라우저와 최대한 동일하게
  const commonHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': cookies,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="143", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  };

  // 2. 캡챠 획득
  console.log('2️⃣ 캡챠 획득...');
  const captchaRes = await fetch(`${BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_captcha',
    },
    body: '',
  });

  const captchaData = await captchaRes.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;
  const captchaToken = captchaData?.data?.dma_captchaInf?.answer;

  if (!captchaImage || !captchaToken) {
    console.log('❌ 캡챠 획득 실패');
    console.log(JSON.stringify(captchaData, null, 2));
    return;
  }
  console.log('✅ 캡챠 토큰:', captchaToken.substring(0, 30) + '...\n');

  // 3. 캡챠 인식
  console.log('3️⃣ 캡챠 인식...');
  const imageBuffer = Buffer.from(captchaImage, 'base64');
  const solver = getVisionCaptchaSolver();
  const result = await solver.solveCaptcha(imageBuffer);

  if (!result.text || result.text.length > 6) {
    console.log('❌ 캡챠 인식 실패:', result.text);
    return;
  }
  console.log(`✅ 캡챠 인식: "${result.text}"\n`);

  // 4. 검색 API 호출
  console.log('4️⃣ 검색 API 호출...');
  const searchRes = await fetch(`${BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: '수원가정법원',
        cdScope: 'ALL',
        csNoHistLst: '',
        csDvsCd: '드단',
        csYr: '2024',
        csSerial: '26718',
        btprNm: '김윤한',
        answer: result.text,
        fullCsNo: '',
      },
    }),
  });

  const searchData = await searchRes.json();
  const encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;

  if (!encCsNo) {
    console.log('❌ 검색 실패:', searchData.message || searchData.errors?.errorMessage);
    return;
  }
  console.log('✅ 검색 성공! encCsNo:', encCsNo.substring(0, 30) + '...\n');

  // 5. 일반내용 API - 다양한 방법 시도
  console.log('5️⃣ 일반내용 API 테스트...\n');

  const fullCaptchaAnswer = result.text + captchaToken;

  // 테스트: WebSquare 추가 헤더 포함
  console.log('📋 WebSquare 헤더 추가 테스트');

  const generalRes = await fetch(`${BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
      'X-Requested-With': 'XMLHttpRequest',
      // WebSquare5 특정 헤더들 추가
      'w2xPath': '/ui/ssgo/ssgo10l/hmpgMain.xml',
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: '000302',
        csNo: '',
        encCsNo: '',  // 빈 값으로 시도 (브라우저에서 본 것처럼)
        csYear: '2024',
        csDvsCd: '150',
        csSerial: '26718',
        btprtNm: '김윤한',
        captchaAnswer: fullCaptchaAnswer,
      },
    }),
  });

  const generalData = await generalRes.json();
  console.log('응답:', JSON.stringify(generalData, null, 2).substring(0, 500));

  // 다른 엔드포인트 시도: 민사/형사 등 다른 유형
  console.log('\n📋 다른 일반내용 API 엔드포인트 테스트...');

  const endpoints = [
    '/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',  // 가사
    '/ssgo/ssgo103/selectHmpgCvlCsGnrlCtt.on',   // 민사
    '/ssgo/ssgo104/selectHmpgCrmCsGnrlCtt.on',   // 형사
  ];

  for (const ep of endpoints) {
    console.log(`\n  테스트: ${ep.split('/').pop()}`);
    try {
      const res = await fetch(`${BASE_URL}${ep}`, {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
        },
        body: JSON.stringify({
          dma_search: {
            cortCd: '000302',
            csNo: '',
            encCsNo: encCsNo,
            csYear: '2024',
            csDvsCd: '150',
            csSerial: '26718',
            btprtNm: '김윤한',
            captchaAnswer: fullCaptchaAnswer,
          },
        }),
      });

      const data = await res.json();
      if (data.errors?.errorMessage) {
        console.log(`  ❌ ${data.errors.errorMessage} (${data.errors.errorCode})`);
      } else {
        console.log(`  ✅ 성공:`, JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`  ❌ 에러: ${e}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n✅ 테스트 완료');
}

testWithBrowserHeaders().catch(console.error);
