/**
 * 수동 검증: 폼을 채운 후 수동으로 검색 버튼 클릭
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function manualVerify() {
  console.log('🔍 수동 검증: 폼 자동 입력 후 수동 제출\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    console.log('페이지 접속...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✓ iframe 발견\n');

    // 1. 저장 옵션 체크
    console.log('Step 1: 저장 옵션 체크...');
    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });
    console.log('✓ 완료\n');

    // 2. 법원 선택
    console.log('Step 2: 법원 선택 (수원가정법원)...');
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    console.log('✓ 완료\n');

    // 3. 사건번호 입력
    console.log('Step 3: 사건번호 입력 (2024드단26718)...');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', '2024드단26718');
    console.log('✓ 완료\n');

    // 4. 당사자명 입력
    console.log('Step 4: 당사자명 입력 (김윤한)...');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
    console.log('✓ 완료\n');

    // 5. 캡챠 인식
    console.log('Step 5: 캡챠 인식...');
    const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImg!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠 인식: "${result.text}"\n`);

    // 캡챠 입력
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

    console.log('\n' + '='.repeat(70));
    console.log('📋 입력된 값:');
    console.log('='.repeat(70));
    console.log('법원: 수원가정법원');
    console.log('사건번호: 2024드단26718');
    console.log('당사자명: 김윤한');
    console.log(`캡챠: ${result.text}`);
    console.log('='.repeat(70));

    console.log('\n\n🚨 브라우저에서 다음을 확인하세요:\n');
    console.log('1. 법원이 "수원가정법원"으로 선택되어 있는지');
    console.log('2. 사건번호가 올바르게 입력되어 있는지');
    console.log('3. 당사자명이 올바르게 입력되어 있는지');
    console.log('4. 캡챠가 올바르게 입력되어 있는지 (이미지와 비교)');
    console.log('\n✅ 확인 후 직접 "사건검색" 버튼을 클릭하세요!');
    console.log('\n⏰ 브라우저를 10분간 열어둡니다...\n');
    console.log('💡 종료하려면 Ctrl+C를 누르세요.\n');

    await new Promise(r => setTimeout(r, 600000)); // 10분

  } finally {
    await browser.close();
  }
}

manualVerify()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
