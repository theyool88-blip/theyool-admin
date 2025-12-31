/**
 * 간단 검색 후 대기 - 저장 여부 수동 확인
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function simpleSearch() {
  console.log('🔍 검색 후 저장 확인\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✓ iframe 발견\n');

    // 저장 옵션 확인 및 체크
    console.log('저장 옵션 체크...');
    const saveChecked = await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      console.log('체크박스 찾음:', !!cb);
      console.log('현재 상태:', cb?.checked);

      if (cb && !cb.checked) {
        cb.click();
        console.log('클릭 후 상태:', cb.checked);
        return cb.checked;
      }
      return cb?.checked || false;
    });
    console.log(`저장 옵션: ${saveChecked ? '✅ 체크됨' : '❌ 체크 안됨'}\n`);

    // 법원 선택
    console.log('법원 선택...');
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));
    console.log('✓ 수원가정법원 선택됨\n');

    // 사건 정보 입력
    console.log('사건 정보 입력...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');

    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial');
    await new Promise(r => setTimeout(r, 500));
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
    console.log('✓ 2024드단26718, 김윤한 입력됨\n');

    // 캡챠
    console.log('캡챠 인식 중...');
    const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImg!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠 인식: "${result.text}"\n`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

    console.log('\n' + '='.repeat(70));
    console.log('📋 입력 완료!');
    console.log('='.repeat(70));
    console.log('저장 옵션: ✅ 체크됨');
    console.log('법원: 수원가정법원');
    console.log('사건: 2024드단26718');
    console.log('당사자: 김윤한');
    console.log(`캡챠: ${result.text}`);
    console.log('='.repeat(70));

    console.log('\n\n🔍 이제 다음을 확인하세요:\n');
    console.log('1. 브라우저에서 "사건검색" 버튼을 직접 클릭하세요');
    console.log('2. 검색 결과가 나오는지 확인하세요');
    console.log('3. 페이지를 새로고침(F5)하세요');
    console.log('4. "기존 사건검색 결과" 목록에 사건이 보이는지 확인하세요');
    console.log('5. 목록의 사건을 클릭해보세요');
    console.log('6. 캡챠 없이 사건 내용이 바로 보이는지 확인하세요\n');

    console.log('⏰ 브라우저를 10분간 열어둡니다...\n');
    await new Promise(r => setTimeout(r, 600000));

  } finally {
    await browser.close();
  }
}

simpleSearch()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
