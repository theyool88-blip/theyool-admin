/**
 * 검색 결과 클릭 시 URL 구조 확인
 * 실제로 사건번호를 클릭했을 때 어떤 일이 일어나는지 분석
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function checkResultStructure() {
  console.log('🔍 검색 결과 URL 구조 분석\n');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

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

    // 우리 사건 정보
    const testCase = {
      courtName: '수원가정법원',
      caseYear: '2024',
      caseType: '드단',
      caseNumber: '26718',
      partyName: '김윤한'
    };

    console.log('📋 검색 조건:');
    console.log(`  - 법원: ${testCase.courtName}`);
    console.log(`  - 사건번호: ${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`);
    console.log(`  - 당사자: ${testCase.partyName}\n`);

    // 법원 선택
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', testCase.courtName);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 사건번호 입력
    const fullCaseNo = `${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`;
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', testCase.partyName);

    // 캡챠 해결
    const captchaImage = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImage!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠 인식: "${result.text}"\n`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

    // 결과 대기
    console.log('⏳ 검색 결과 로딩 중...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 그리드 JavaScript 이벤트 핸들러 분석
    console.log('📊 그리드 이벤트 핸들러 분석:\n');

    const gridAnalysis = await targetFrame.evaluate(() => {
      const grid = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid');

      // 그리드 onclick 이벤트 확인
      const hasOnClick = grid?.getAttribute('onclick');

      // tbody에 이벤트가 있는지 확인
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const tbodyOnClick = tbody?.getAttribute('onclick');

      // 페이지의 모든 JavaScript 함수 중 'detail', 'view', 'open' 관련 함수 찾기
      const windowKeys = Object.keys(window).filter(key =>
        key.toLowerCase().includes('detail') ||
        key.toLowerCase().includes('view') ||
        key.toLowerCase().includes('open') ||
        key.toLowerCase().includes('case') ||
        key.toLowerCase().includes('cs')
      );

      return {
        gridOnClick: hasOnClick,
        tbodyOnClick: tbodyOnClick,
        relatedFunctions: windowKeys.slice(0, 20),
        gridId: grid?.id
      };
    });

    console.log('그리드 분석 결과:');
    console.log(JSON.stringify(gridAnalysis, null, 2));

    // 실제 검색 후 결과 행에 클릭 이벤트가 있는지 확인
    console.log('\n\n📍 검색 결과 확인:\n');

    const resultCheck = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return {
          hasResults: false,
          message: '검색 결과가 없습니다 (빈 테이블)'
        };
      }

      // 첫 번째 행 분석
      const firstRow = rows[0];
      const cells = Array.from(firstRow.querySelectorAll('td'));

      return {
        hasResults: true,
        rowCount: rows.length,
        firstRowOnClick: firstRow.getAttribute('onclick'),
        firstRowHTML: firstRow.innerHTML.substring(0, 500),
        cells: cells.map(cell => ({
          text: cell.textContent?.trim(),
          hasLink: !!cell.querySelector('a'),
          linkHref: cell.querySelector('a')?.getAttribute('href'),
          onClick: cell.getAttribute('onclick')
        }))
      };
    });

    console.log('검색 결과 분석:');
    console.log(JSON.stringify(resultCheck, null, 2));

    if (!resultCheck.hasResults) {
      console.log('\n⚠️  현재 사건번호로는 검색 결과가 없습니다.');
      console.log('하지만 그리드 구조를 보면:\n');
      console.log('✅ 결과가 있을 때는 다음과 같이 동작할 것으로 예상됩니다:');
      console.log('   1. 테이블에 결과 행이 추가됨');
      console.log('   2. 각 행을 클릭하면 일반내용 탭 화면로 이동하거나');
      console.log('   3. JavaScript로 팝업/모달이 열림\n');
      console.log('💡 고유 URL 여부는 결과가 있는 사건으로 테스트해야 확정할 수 있습니다.');
    }

    console.log('\n브라우저를 30초간 열어둡니다. 페이지를 직접 확인해보세요...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
}

checkResultStructure()
  .then(() => {
    console.log('\n✓ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
