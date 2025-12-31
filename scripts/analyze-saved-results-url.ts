/**
 * 저장된 검색 결과 클릭 시 URL/API 분석
 * Network 탭 모니터링 + URL 변화 확인
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function analyzeURL() {
  console.log('🔍 저장된 검색 결과 URL 분석\n');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allRequests: any[] = [];
  const allResponses: any[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Network 모니터링 시작
    await page.setRequestInterception(true);

    page.on('request', request => {
      allRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
      request.continue();
    });

    page.on('response', async response => {
      allResponses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
    });

    console.log('📍 페이지 접속...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const frames = page.frames();
    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      throw new Error('iframe을 찾을 수 없습니다');
    }

    console.log('✓ iframe 발견\n');

    // 사건 정보
    const testCase = {
      courtName: '수원가정법원',
      caseYear: '2024',
      caseType: '드단',
      caseNumber: '26718',
      partyName: '김윤한'
    };

    console.log('📋 검색 조건:');
    console.log(`  - 사건번호: ${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`);
    console.log(`  - 당사자: ${testCase.partyName}\n`);

    // 1. "사건검색 결과 저장" 체크박스 먼저 체크
    console.log('📍 Step 1: 사건검색 결과 저장 옵션 체크');
    try {
      await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0');
      console.log('✓ 저장 옵션 활성화됨\n');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.log('⚠️  저장 옵션 체크 실패\n');
    }

    // 2. 검색 폼 입력
    console.log('📍 Step 2: 검색 폼 입력');

    // 법원 선택 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    const fullCaseNo = `${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`;

    // 사건번호 입력 필드가 로드될 때까지 대기
    await targetFrame.waitForSelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', { timeout: 10000 });

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', testCase.partyName);
    console.log('✓ 폼 입력 완료\n');

    // 3. 캡챠 해결
    console.log('📍 Step 3: 캡챠 인식');
    const captchaImage = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImage!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠: "${result.text}"\n`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

    // 4. 검색 실행 전 Network 요청 초기화
    allRequests.length = 0;
    allResponses.length = 0;

    console.log('📍 Step 4: 검색 실행 (Network 모니터링 중...)');
    const initialUrl = page.url();
    console.log(`현재 URL: ${initialUrl}\n`);

    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterSearchUrl = page.url();
    console.log(`검색 후 URL: ${afterSearchUrl}`);
    console.log(`URL 변경됨: ${initialUrl !== afterSearchUrl ? '✅ YES' : '❌ NO'}\n`);

    // 5. Network 요청 분석
    console.log('📡 검색 시 발생한 Network 요청:\n');
    const relevantRequests = allRequests.filter(req =>
      !req.url.includes('google') &&
      !req.url.includes('captcha') &&
      !req.url.includes('.png') &&
      !req.url.includes('.css') &&
      !req.url.includes('.js')
    );

    relevantRequests.forEach((req, idx) => {
      console.log(`${idx + 1}. ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`   POST 데이터: ${req.postData.substring(0, 200)}`);
      }
    });

    // 6. 저장된 검색 결과 그리드 확인
    console.log('\n📍 Step 5: 저장된 검색 결과 확인\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const savedResults = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return { hasData: false, rowCount: 0 };
      }

      // 첫 번째 행 분석
      const firstRow = rows[0];

      return {
        hasData: true,
        rowCount: rows.length,
        rowHTML: firstRow.outerHTML,
        onClick: firstRow.getAttribute('onclick'),
        rowId: firstRow.id,
        cells: Array.from(firstRow.querySelectorAll('td')).map(cell => ({
          text: cell.textContent?.trim(),
          hasLink: !!cell.querySelector('a'),
          linkHref: cell.querySelector('a')?.getAttribute('href'),
          onClick: cell.getAttribute('onclick')
        }))
      };
    });

    console.log('저장된 검색 결과:');
    console.log(JSON.stringify(savedResults, null, 2));

    if (savedResults.hasData) {
      console.log('\n📍 Step 6: 저장된 결과 클릭 테스트\n');

      // Network 요청 초기화
      allRequests.length = 0;
      allResponses.length = 0;

      // 첫 번째 행 클릭
      await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr');
        if (firstRow) {
          (firstRow as HTMLElement).click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const afterClickUrl = page.url();
      console.log(`클릭 후 URL: ${afterClickUrl}`);
      console.log(`URL 변경됨: ${afterSearchUrl !== afterClickUrl ? '✅ YES' : '❌ NO'}\n`);

      console.log('📡 클릭 시 발생한 Network 요청:\n');
      const clickRequests = allRequests.filter(req =>
        !req.url.includes('google') &&
        !req.url.includes('.png') &&
        !req.url.includes('.css') &&
        !req.url.includes('.js')
      );

      clickRequests.forEach((req, idx) => {
        console.log(`${idx + 1}. ${req.method} ${req.url}`);
      });
    }

    // 결과 저장
    const outputDir = path.join(process.cwd(), 'temp', 'url-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'network-requests.json'),
      JSON.stringify({
        searchRequests: relevantRequests,
        savedResults: savedResults,
        urls: {
          initial: initialUrl,
          afterSearch: afterSearchUrl
        }
      }, null, 2)
    );

    console.log('\n✓ 분석 결과 저장: temp/url-analysis/network-requests.json');

    console.log('\n브라우저를 30초간 열어둡니다...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
}

analyzeURL()
  .then(() => {
    console.log('\n✓ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
