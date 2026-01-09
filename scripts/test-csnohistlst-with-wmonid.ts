/**
 * csNoHistLst로 64자 encCsNo 획득 + WMONID 바인딩 테스트
 *
 * 가설: csNoHistLst에 사건번호를 포함하면 64자 encCsNo가 반환됨
 * 이 64자 encCsNo가 WMONID에 바인딩되면 재사용 가능해야 함
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('='.repeat(60));
  console.log('🔐 csNoHistLst로 64자 encCsNo 획득 테스트');
  console.log('='.repeat(60));

  // 1. 세션 생성
  console.log('\n[Step 1] 세션 생성...');
  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
  const setCookie = initResponse.headers.get('set-cookie');

  const wmonidMatch = setCookie?.match(/WMONID=([^;]+)/);
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);

  const wmonid = wmonidMatch?.[1];
  const jsessionId = jsessionMatch?.[1];

  console.log(`WMONID: ${wmonid}`);
  console.log(`JSESSIONID: ${jsessionId?.substring(0, 20)}...`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 캡챠 획득 및 인식
  console.log('\n[Step 2] 캡챠 획득...');
  const captchaRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on', {
    method: 'POST',
    headers,
    body: '',
  });
  const captchaData = await captchaRes.json();
  const captchaImage = captchaData?.data?.dma_captchaInf?.image;

  if (!captchaImage) {
    console.log('❌ 캡챠 획득 실패');
    return;
  }

  const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const solver = getVisionCaptchaSolver();
  const captchaResult = await solver.solveCaptcha(imageBuffer);
  console.log(`캡챠 인식: ${captchaResult.text}`);

  // 3. 검색 WITH csNoHistLst
  console.log('\n[Step 3] csNoHistLst 포함 검색...');

  // csNoHistLst 형식: "연도+유형코드+일련번호" (예: 20241500026718)
  // 유형코드: 드단=150, 드합=151, 느단=140, 느합=141
  const csNoHistLst = '20241500026718';  // 2024드단26718

  const searchRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '수원가정법원',
        cdScope: 'ALL',
        csNoHistLst: csNoHistLst,  // 핵심: 저장된 사건 목록 포함
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
  const encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;

  console.log(`encCsNo 길이: ${encCsNo?.length || 0}자`);
  console.log(`encCsNo: ${encCsNo}`);

  if (!encCsNo) {
    console.log('❌ encCsNo 획득 실패');
    console.log('응답:', JSON.stringify(searchData, null, 2));
    return;
  }

  // 4. 새 세션에서 64자 encCsNo로 접근 (같은 WMONID)
  console.log('\n[Step 4] 새 세션에서 encCsNo 접근 (같은 WMONID)...');

  const initResponse2 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: { 'Cookie': `WMONID=${wmonid}` },
  });
  const setCookie2 = initResponse2.headers.get('set-cookie');
  const jsessionMatch2 = setCookie2?.match(/JSESSIONID=([^;]+)/);
  const jsessionId2 = jsessionMatch2?.[1];

  console.log(`새 JSESSIONID: ${jsessionId2?.substring(0, 20)}...`);

  const generalRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
    method: 'POST',
    headers: {
      ...headers,
      'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId2}`,
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

    // 5. 완전히 새 세션 (새 WMONID)에서도 테스트
    console.log('\n[Step 5] 완전 새 세션 (새 WMONID)에서 테스트...');

    const initResponse3 = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www');
    const setCookie3 = initResponse3.headers.get('set-cookie');
    const wmonidMatch3 = setCookie3?.match(/WMONID=([^;]+)/);
    const jsessionMatch3 = setCookie3?.match(/JSESSIONID=([^;]+)/);

    console.log(`새 WMONID: ${wmonidMatch3?.[1]}`);

    const generalRes3 = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
      method: 'POST',
      headers: {
        ...headers,
        'Cookie': `WMONID=${wmonidMatch3?.[1]}; JSESSIONID=${jsessionMatch3?.[1]}`,
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

    const generalData3 = await generalRes3.json();
    console.log('결과:', generalData3.errors?.errorMessage || 'SUCCESS');

  } else if (generalData.data) {
    console.log('✅ 성공! csNoHistLst encCsNo가 WMONID에 바인딩됨!');
    console.log('사건명:', generalData.data.dma_csBasCtt?.csNm);
  }

  // 결론
  console.log('\n' + '='.repeat(60));
  console.log('📋 결론');
  console.log('='.repeat(60));
  if (encCsNo?.length === 64) {
    console.log('csNoHistLst로 64자 encCsNo 획득 가능');
  } else {
    console.log(`csNoHistLst로 ${encCsNo?.length}자 encCsNo 반환됨`);
  }
}

main().catch(console.error);
