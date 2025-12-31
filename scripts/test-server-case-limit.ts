/**
 * 서버에 50건 제한이 있는지 확인
 *
 * 테스트: csNoHistLst에 51개 이상의 사건번호를 보내면?
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 서버 측 사건 수 제한 테스트');
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

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 캡챠 획득
  console.log('\n[Step 2] 캡챠 획득...');
  const captchaRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/getCaptchaInf.on', {
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

  // 3. 60개 사건번호로 csNoHistLst 생성 (50개 초과)
  console.log('\n[Step 3] 60개 사건번호로 테스트...');

  // 가상의 사건번호 60개 생성 (형식: 연도+유형코드+일련번호)
  const fakeCaseNumbers: string[] = [];
  for (let i = 1; i <= 60; i++) {
    // 2024드단XXXXX 형식
    fakeCaseNumbers.push(`2024150${String(i).padStart(5, '0')}`);
  }

  // 마지막에 실제 존재하는 사건 추가
  fakeCaseNumbers.push('20241500026718');  // 실제 사건: 2024드단26718

  const csNoHistLst = fakeCaseNumbers.join(',');
  console.log(`csNoHistLst 길이: ${fakeCaseNumbers.length}개`);
  console.log(`첫 3개: ${fakeCaseNumbers.slice(0, 3).join(', ')}`);
  console.log(`마지막: ${fakeCaseNumbers.slice(-1)}`);

  // 4. 검색 실행
  console.log('\n[Step 4] 검색 실행...');

  const searchRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on', {
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

  // 5. 결과 분석
  console.log('\n[결과]');
  if (searchData.errors) {
    console.log('❌ 에러:', searchData.errors.errorMessage);
    if (searchData.errors.errorMessage.includes('50') ||
        searchData.errors.errorMessage.includes('제한')) {
      console.log('\n✅ 서버에 50건 제한 존재!');
    }
  } else if (searchData.data) {
    const histList = searchData.data.dlt_csNoHistLst || [];
    console.log(`✅ 성공! 반환된 encCsNo 개수: ${histList.length}`);

    if (histList.length > 50) {
      console.log('\n🎉 서버에 50건 제한 없음! 50개 이상 처리 가능');
    } else if (histList.length === 1) {
      console.log('\n⚠️ 검색 결과만 반환됨 (csNoHistLst는 encCsNo 생성에만 사용)');
    }

    // encCsNo 샘플 출력
    if (histList[0]) {
      console.log(`\nencCsNo 샘플: ${histList[0].encCsNo} (${histList[0].encCsNo?.length}자)`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 결론');
  console.log('='.repeat(60));
  console.log('1. csNoHistLst: 클라이언트가 보내는 저장된 사건 목록');
  console.log('2. 서버는 csNoHistLst를 받아 encCsNo 생성');
  console.log('3. 50건 제한: 서버/클라이언트 어디서 적용되는지 확인');
  console.log('='.repeat(60));
}

main().catch(console.error);
