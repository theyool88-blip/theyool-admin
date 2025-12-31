/**
 * 최종 검증: 검색 → 저장 → 재접속 → 저장된 결과 클릭
 * (타이밍 이슈 해결 버전)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function fullVerification() {
  console.log('\n🔍 최종 검증: 검색 → 저장 → 클릭\n');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(process.cwd(), 'temp', 'final-verification');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 경고창 자동 처리
    page.on('dialog', async dialog => {
      console.log(`⚠️  "${dialog.message().substring(0, 50)}..."`);
      await dialog.accept();
    });

    // === PHASE 1: 검색 ===
    console.log('\n📍 PHASE 1: 사건 검색\n');

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 10000)); // 충분한 로딩 시간

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✓ iframe 발견\n');

    // 저장 옵션 체크
    console.log('Step 1: 저장 옵션 체크...');
    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });
    console.log('✓ 완료\n');

    // 법원 선택 (수원가정법원)
    console.log('Step 2: 법원 선택 (수원가정법원)...');
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    console.log('✓ 완료\n');

    // 사건번호 입력
    console.log('Step 3: 사건번호 입력 (2024드단26718)...');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', '2024드단26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
    console.log('✓ 완료\n');

    // 캡챠
    console.log('Step 4: 캡챠 인식...');
    const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImg!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);
    console.log(`✓ 캡챠: "${result.text}"\n`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

    // 검색
    console.log('Step 5: 검색 실행...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    await new Promise(r => setTimeout(r, 5000));

    await page.screenshot({ path: path.join(outputDir, '1-after-search.png'), fullPage: true });
    console.log('✓ 스크린샷: 1-after-search.png\n');

    // 검색 결과 확인
    const hasResults = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      return tbody?.querySelectorAll('tr').length || 0;
    });
    console.log(`검색 결과: ${hasResults}건\n`);

    // === PHASE 2: 페이지 리프레시 ===
    console.log('\n📍 PHASE 2: 페이지 리프레시\n');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('리프레시 후 iframe 없음');

    console.log('✓ 리프레시 완료\n');

    // 저장된 결과 확인
    console.log('Step 6: 저장된 검색 결과 확인...');
    await new Promise(r => setTimeout(r, 3000));

    const savedResults = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return { count: 0, data: [] };
      }

      return {
        count: rows.length,
        data: Array.from(rows).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return {
            법원: cells[2]?.textContent?.trim(),
            사건번호: cells[3]?.textContent?.trim(),
            사건명: cells[4]?.textContent?.trim()
          };
        })
      };
    });

    console.log(`저장된 결과: ${savedResults.count}건`);
    if (savedResults.count > 0) {
      console.log('내용:', JSON.stringify(savedResults.data, null, 2));
    }
    console.log();

    await page.screenshot({ path: path.join(outputDir, '2-saved-list.png'), fullPage: true });
    console.log('✓ 스크린샷: 2-saved-list.png\n');

    // === PHASE 3: 저장된 결과 클릭 ===
    if (savedResults.count > 0) {
      console.log('\n📍 PHASE 3: 저장된 결과 클릭\n');

      const urlBefore = page.url();
      console.log(`클릭 전 URL: ${urlBefore}\n`);

      console.log('Step 7: 첫 번째 결과 클릭...');
      await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr') as HTMLElement;
        if (firstRow) firstRow.click();
      });

      await new Promise(r => setTimeout(r, 5000));

      const urlAfter = page.url();
      console.log(`클릭 후 URL: ${urlAfter}`);
      console.log(`URL 변경: ${urlBefore !== urlAfter ? '✅ YES' : '❌ NO'}\n`);

      // 캡챠 필요 여부
      const needsCaptcha = await targetFrame.evaluate(() => {
        const captcha = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer');
        return captcha && window.getComputedStyle(captcha).display !== 'none';
      });

      console.log(`캡챠 필요: ${needsCaptcha ? '❌ YES (재검색)' : '✅ NO (직접 접근)'}\n`);

      await page.screenshot({ path: path.join(outputDir, '3-after-click.png'), fullPage: true });
      console.log('✓ 스크린샷: 3-after-click.png\n');

      // 최종 결론
      console.log('\n' + '='.repeat(70));
      console.log('📊 최종 결과:');
      console.log('='.repeat(70));
      console.log(`1. 검색 결과: ${hasResults}건`);
      console.log(`2. 저장된 결과: ${savedResults.count}건`);
      console.log(`3. URL 변경: ${urlBefore !== urlAfter ? 'YES' : 'NO'}`);
      console.log(`4. 캡챠 불필요: ${!needsCaptcha ? 'YES → 고유 URL 있음!' : 'NO → 재검색 방식'}`);
      console.log('='.repeat(70));

      fs.writeFileSync(
        path.join(outputDir, 'final-report.json'),
        JSON.stringify({
          searchResults: hasResults,
          savedResults: savedResults.count,
          urlChanged: urlBefore !== urlAfter,
          captchaNotNeeded: !needsCaptcha,
          conclusion: !needsCaptcha ? '고유 URL 존재' : '쿠키 기반 재검색'
        }, null, 2)
      );
    }

    console.log('\n브라우저를 30초간 열어둡니다...');
    await new Promise(r => setTimeout(r, 30000));

  } finally {
    await browser.close();
  }
}

fullVerification()
  .then(() => {
    console.log('\n✅ 검증 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
