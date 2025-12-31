/**
 * 사건 상세 정보 API 분석
 * 검색 후 사건 클릭 시 어떤 API가 호출되는지 확인
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

interface NetworkRequest {
  url: string;
  method: string;
  postData?: string;
  timestamp: number;
}

async function analyzeDetailApi() {
  console.log('🔍 사건 상세 API 분석 시작...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const requests: NetworkRequest[] = [];
  let captureEnabled = false;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 네트워크 요청 캡처
    page.on('request', (request) => {
      if (!captureEnabled) return;

      const url = request.url();
      if (url.includes('ssgo.scourt.go.kr') && request.method() === 'POST') {
        requests.push({
          url,
          method: request.method(),
          postData: request.postData(),
          timestamp: Date.now(),
        });
        console.log(`📡 POST: ${url}`);
        if (request.postData()) {
          console.log(`   Data: ${request.postData()?.substring(0, 200)}`);
        }
      }
    });

    // Alert 처리
    page.on('dialog', async (dialog) => {
      console.log(`⚠️ Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    console.log('📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 10000));

    const targetFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe을 찾을 수 없습니다');

    console.log('✅ iframe 발견\n');

    // 법원 선택
    console.log('🔧 검색 조건 입력...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise((r) => setTimeout(r, 2000));

    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    // 캡챠 해결
    console.log('🔧 캡챠 해결 중...');
    const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (captchaImg) {
      const screenshot = await captchaImg.screenshot();
      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(screenshot);
      console.log(`  캡챠 인식: ${result.text}`);
      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text || '');
    }

    // 네트워크 캡처 시작
    captureEnabled = true;
    console.log('\n📡 네트워크 캡처 시작...\n');

    // 검색 실행
    console.log('🔎 검색 버튼 클릭...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    await new Promise((r) => setTimeout(r, 5000));

    // 결과 확인
    const hasResults = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      return rows && rows.length > 0;
    });

    if (!hasResults) {
      console.log('⚠️ 검색 결과 없음. 캡챠가 틀렸을 수 있습니다.');
      await new Promise((r) => setTimeout(r, 30000));
      return;
    }

    console.log('✅ 검색 결과 있음!\n');

    // 첫 번째 결과 클릭
    console.log('🖱️ 첫 번째 사건 클릭...');
    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) firstRow.click();
    });

    await new Promise((r) => setTimeout(r, 5000));

    // 결과 저장
    const outputDir = path.join(process.cwd(), 'temp', 'detail-api-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'api-requests.json'),
      JSON.stringify(requests, null, 2)
    );

    await page.screenshot({
      path: path.join(outputDir, 'after-click.png'),
      fullPage: true,
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 캡처된 API 요청');
    console.log('='.repeat(60));

    requests.forEach((req, idx) => {
      console.log(`\n[${idx + 1}] ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`    Data: ${req.postData.substring(0, 300)}`);
      }
    });

    console.log('\n✅ 결과 저장: temp/detail-api-analysis/');

    // 브라우저 유지
    console.log('\n브라우저를 60초간 열어둡니다...');
    await new Promise((r) => setTimeout(r, 60000));

  } finally {
    await browser.close();
  }

  return requests;
}

analyzeDetailApi()
  .then(() => {
    console.log('\n✅ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
