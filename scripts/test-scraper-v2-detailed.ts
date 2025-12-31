/**
 * 대법원 스크래퍼 V2 상세 테스트
 * 스크린샷과 HTML을 캡처하여 결과를 상세히 분석합니다
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env.local 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';
import { CaseSearchParams } from '../lib/scourt/scraper-v2';

async function testDetailedSearch() {
  console.log('🚀 대법원 스크래퍼 V2 상세 테스트\n');
  console.log('='.repeat(60));

  // 실제 사건 정보
  const testCase: CaseSearchParams = {
    courtName: '수원가정법원',
    caseYear: '2024',
    caseType: '드단',
    caseNumber: '26718',
    partyName: '김윤한'
  };

  console.log('\n📋 검색할 사건 정보:');
  console.log(`  - 법원: ${testCase.courtName}`);
  console.log(`  - 사건번호: ${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`);
  console.log(`  - 당사자: ${testCase.partyName}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 출력 디렉토리 생성
    const outputDir = path.join(process.cwd(), 'temp', 'search-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('\n📍 Step 1: 페이지 접속');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✓ 페이지 로드 완료');

    // iframe 찾기
    console.log('\n📍 Step 2: iframe 찾기');
    const frames = page.frames();
    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      throw new Error('검색 폼 iframe을 찾을 수 없습니다');
    }

    console.log('✓ iframe 발견');

    // 사건번호 입력
    console.log('\n📍 Step 3: 검색 폼 입력');
    const fullCaseNo = `${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`;
    console.log(`📝 사건번호 입력: ${fullCaseNo}`);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);

    console.log(`📝 당사자명 입력: ${testCase.partyName}`);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', testCase.partyName);

    // 폼 입력 후 스크린샷
    await page.screenshot({
      path: path.join(outputDir, '1-form-filled.png'),
      fullPage: true
    });
    console.log('✓ 스크린샷 저장: 1-form-filled.png');

    // 캡챠 해결
    console.log('\n📍 Step 4: 캡챠 인식 및 제출');
    const captchaImage = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');

    if (!captchaImage) {
      throw new Error('캡챠 이미지를 찾을 수 없습니다');
    }

    const screenshot = await captchaImage.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    if (!result.success || !result.text) {
      throw new Error('캡챠 인식 실패: ' + result.error);
    }

    console.log(`✓ 캡챠 인식 성공: "${result.text}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);

    // 캡챠 입력
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

    // 검색 버튼 클릭 전 스크린샷
    await page.screenshot({
      path: path.join(outputDir, '2-before-submit.png'),
      fullPage: true
    });
    console.log('✓ 스크린샷 저장: 2-before-submit.png');

    // 검색 버튼 클릭
    console.log('📍 검색 버튼 클릭...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

    // 결과 로딩 대기
    console.log('⏳ 결과 로딩 대기 (5초)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 결과 스크린샷
    await page.screenshot({
      path: path.join(outputDir, '3-search-results.png'),
      fullPage: true
    });
    console.log('✓ 스크린샷 저장: 3-search-results.png');

    // iframe 내부 HTML 저장
    console.log('\n📍 Step 5: 결과 분석');
    const iframeHTML = await targetFrame.evaluate(() => document.body.innerHTML);
    fs.writeFileSync(
      path.join(outputDir, 'iframe-result.html'),
      iframeHTML
    );
    console.log('✓ HTML 저장: iframe-result.html');

    // 결과 텍스트 추출
    const resultText = await targetFrame.evaluate(() => document.body.textContent);
    fs.writeFileSync(
      path.join(outputDir, 'result-text.txt'),
      resultText || ''
    );
    console.log('✓ 텍스트 저장: result-text.txt');

    // 테이블 데이터 추출
    const tableData = await targetFrame.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));

      return tables.map((table, idx) => {
        const rows = Array.from(table.querySelectorAll('tr'));

        return {
          tableIndex: idx,
          rowCount: rows.length,
          data: rows.map(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return cells.map(cell => cell.textContent?.trim());
          })
        };
      });
    });

    fs.writeFileSync(
      path.join(outputDir, 'table-data.json'),
      JSON.stringify(tableData, null, 2)
    );
    console.log('✓ 테이블 데이터 저장: table-data.json');

    console.log('\n📊 테이블 데이터 요약:');
    console.log(JSON.stringify(tableData, null, 2));

    // 에러 메시지 확인
    const hasError = await targetFrame.evaluate(() => {
      const text = document.body.textContent || '';
      return {
        hasCaptchaError: text.includes('보안문자') && text.includes('일치하지'),
        hasNoResult: text.includes('검색결과가 없습니다') || text.includes('조회된 사건이 없습니다'),
        rawText: text.substring(0, 500)
      };
    });

    console.log('\n📍 에러 체크:');
    console.log(`  캡챠 에러: ${hasError.hasCaptchaError ? '❌' : '✅'}`);
    console.log(`  결과 없음: ${hasError.hasNoResult ? '❌' : '✅'}`);

    console.log('\n브라우저를 30초간 열어둡니다. 결과를 직접 확인하세요...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('\n='.repeat(60));
    console.log('✅ 모든 파일이 temp/search-results/ 에 저장되었습니다');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
  } finally {
    await browser.close();
  }
}

// 실행
testDetailedSearch()
  .then(() => {
    console.log('\n✓ 프로그램 정상 종료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 프로그램 에러:', error);
    process.exit(1);
  });
