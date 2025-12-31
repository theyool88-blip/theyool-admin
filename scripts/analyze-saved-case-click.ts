/**
 * 저장된 사건 클릭 시 실제로 어떤 일이 일어나는지 분석
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function analyzeClick() {
  console.log('🔍 저장된 사건 클릭 분석\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(process.cwd(), 'temp', 'click-analysis');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    // 네트워크 요청 모니터링
    const requests: any[] = [];
    page.on('request', req => {
      if (!req.url().includes('.png') && !req.url().includes('.css') && !req.url().includes('.js')) {
        requests.push({
          time: new Date().toISOString(),
          method: req.method(),
          url: req.url(),
          postData: req.postData()
        });
      }
    });

    console.log('페이지 접속...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    // === 검색 실행 ===
    console.log('검색 실행 중...\n');

    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });

    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial');
    await new Promise(r => setTimeout(r, 500));
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImg!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    await new Promise(r => setTimeout(r, 5000));

    console.log('✓ 검색 완료\n');

    // === 페이지 리프레시 ===
    console.log('페이지 리프레시...\n');
    requests.length = 0; // 요청 기록 초기화

    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('리프레시 후 iframe 없음');

    // === 저장된 사건 행 분석 ===
    console.log('='.repeat(70));
    console.log('저장된 사건 행 분석');
    console.log('='.repeat(70));

    const rowInfo = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr');

      if (!firstRow) return null;

      return {
        id: firstRow.id,
        onclick: firstRow.getAttribute('onclick'),
        outerHTML: firstRow.outerHTML.substring(0, 500),
        cells: Array.from(firstRow.querySelectorAll('td')).map((cell, idx) => ({
          index: idx,
          text: cell.textContent?.trim(),
          onclick: cell.getAttribute('onclick'),
          innerHTML: cell.innerHTML.substring(0, 200)
        }))
      };
    });

    if (rowInfo) {
      console.log('\n저장된 사건 행 정보:');
      console.log(`ID: ${rowInfo.id}`);
      console.log(`onclick: ${rowInfo.onclick}\n`);
      console.log('HTML (처음 500자):');
      console.log(rowInfo.outerHTML);
      console.log('\n각 셀 정보:');
      rowInfo.cells.forEach(cell => {
        console.log(`  셀 ${cell.index}: "${cell.text}"`);
        if (cell.onclick) console.log(`    onclick: ${cell.onclick}`);
      });
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('저장된 사건 클릭!');
    console.log('='.repeat(70));

    requests.length = 0;

    const urlBefore = page.url();
    console.log(`\n클릭 전 URL: ${urlBefore}`);

    await page.screenshot({ path: path.join(outputDir, '1-before-click.png'), fullPage: true });

    // 클릭
    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        console.log('클릭 실행:', firstRow.id);
        firstRow.click();
      }
    });

    console.log('\n클릭 실행됨. 5초 대기...\n');
    await new Promise(r => setTimeout(r, 5000));

    const urlAfter = page.url();
    console.log(`클릭 후 URL: ${urlAfter}`);
    console.log(`URL 변경: ${urlBefore !== urlAfter ? 'YES' : 'NO'}\n`);

    await page.screenshot({ path: path.join(outputDir, '2-after-click.png'), fullPage: true });

    // 클릭 후 페이지 상태 확인
    const afterClickState = await targetFrame.evaluate(() => {
      // 기본내용 섹션이 있는지 확인
      const hasBasicInfo = !!document.querySelector('.tbl_type01');

      // 캡챠 필드 상태
      const captchaInput = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer') as HTMLInputElement;
      const captchaVisible = captchaInput ? window.getComputedStyle(captchaInput).display !== 'none' : false;

      return {
        hasBasicInfo,
        captchaVisible,
        bodyText: document.body.textContent?.substring(0, 1000)
      };
    });

    console.log('클릭 후 페이지 상태:');
    console.log(`  - 기본내용 섹션 있음: ${afterClickState.hasBasicInfo ? 'YES' : 'NO'}`);
    console.log(`  - 캡챠 필드 보임: ${afterClickState.captchaVisible ? 'YES' : 'NO'}`);

    console.log('\n\n클릭 시 발생한 네트워크 요청:');
    console.log('='.repeat(70));
    if (requests.length > 0) {
      requests.forEach((req, idx) => {
        console.log(`\n${idx + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`   POST 데이터: ${req.postData.substring(0, 200)}`);
        }
      });
    } else {
      console.log('(네트워크 요청 없음)');
    }

    fs.writeFileSync(
      path.join(outputDir, 'analysis-report.json'),
      JSON.stringify({
        rowInfo,
        urlChanged: urlBefore !== urlAfter,
        urlBefore,
        urlAfter,
        afterClickState,
        networkRequests: requests
      }, null, 2)
    );

    console.log('\n\n브라우저를 2분간 열어둡니다. 직접 확인해보세요...');
    await new Promise(r => setTimeout(r, 120000));

  } finally {
    await browser.close();
  }
}

analyzeClick()
  .then(() => {
    console.log('\n✅ 분석 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
