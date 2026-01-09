/**
 * 일반내용 API 다양한 요청 방식 테스트
 * 어떤 조합이 작동하는지 확인
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const BASE_URL = 'https://ssgo.scourt.go.kr';

async function testGeneralVariants() {
  console.log('🧪 일반내용 API 다양한 요청 방식 테스트\n');

  // 1. 세션 획득
  console.log('1️⃣ 세션 획득...');
  const sessionRes = await fetch(`${BASE_URL}/ssgo/index.on?cortId=www`);
  const setCookie = sessionRes.headers.get('set-cookie');
  const jsessionId = setCookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  if (!jsessionId) {
    console.log('❌ 세션 획득 실패');
    return;
  }
  console.log('✅ 세션:', jsessionId.substring(0, 20) + '...\n');

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `JSESSIONID=${jsessionId}`,
    'Accept': 'application/json',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 캡챠 획득
  console.log('2️⃣ 캡챠 획득...');
  const captchaRes = await fetch(`${BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
    method: 'POST',
    headers: { ...headers, submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_captcha' },
    body: '',
  });

  const captchaData = await captchaRes.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;
  const captchaToken = captchaData?.data?.dma_captchaInf?.answer;

  if (!captchaImage || !captchaToken) {
    console.log('❌ 캡챠 획득 실패');
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
    headers: { ...headers, submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_search' },
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

  // 5. 일반내용 API 테스트 - 다양한 조합
  console.log('5️⃣ 일반내용 API 테스트...\n');

  const fullCaptchaAnswer = result.text + captchaToken;

  // 테스트 케이스들
  const testCases = [
    {
      name: '테스트 1: encCsNo 포함, csNo 빈값',
      body: {
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
      },
      submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    {
      name: '테스트 2: encCsNo 빈값 (브라우저와 동일)',
      body: {
        dma_search: {
          cortCd: '000302',
          csNo: '',
          encCsNo: '',
          csYear: '2024',
          csDvsCd: '150',
          csSerial: '26718',
          btprtNm: '김윤한',
          captchaAnswer: fullCaptchaAnswer,
        },
      },
      submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    {
      name: '테스트 3: 다른 submissionid',
      body: {
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
      },
      submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_detail',
    },
    {
      name: '테스트 4: captchaAnswer 없이 (토큰만)',
      body: {
        dma_search: {
          cortCd: '000302',
          csNo: '',
          encCsNo: encCsNo,
          csYear: '2024',
          csDvsCd: '150',
          csSerial: '26718',
          btprtNm: '김윤한',
          captchaAnswer: captchaToken,  // 토큰만
        },
      },
      submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    {
      name: '테스트 5: 법원명으로 (코드 대신)',
      body: {
        dma_search: {
          cortCd: '수원가정법원',
          csNo: '',
          encCsNo: encCsNo,
          csYear: '2024',
          csDvsCd: '드단',
          csSerial: '26718',
          btprtNm: '김윤한',
          captchaAnswer: fullCaptchaAnswer,
        },
      },
      submissionid: 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
  ];

  for (const tc of testCases) {
    console.log(`\n📋 ${tc.name}`);
    console.log('   요청:', JSON.stringify(tc.body.dma_search).substring(0, 100) + '...');

    try {
      const res = await fetch(`${BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
        method: 'POST',
        headers: { ...headers, submissionid: tc.submissionid },
        body: JSON.stringify(tc.body),
      });

      const data = await res.json();

      if (data.errors?.errorMessage) {
        console.log(`   ❌ 실패: ${data.errors.errorMessage} (${data.errors.errorCode || 'no code'})`);
      } else if (data.status === 200) {
        console.log('   ✅ 성공!');
        console.log('   응답:', JSON.stringify(data).substring(0, 300));
      } else {
        console.log('   ⚠️ 응답:', JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`   ❌ 에러: ${e}`);
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n✅ 테스트 완료');
}

testGeneralVariants().catch(console.error);
