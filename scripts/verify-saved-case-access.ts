/**
 * 사건 검색 → 저장 → 재접속 → 저장된 사건 클릭 전체 플로우 검증
 * 각 단계를 확인하고 URL/캡챠 여부를 체크
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function verifyFlow() {
  console.log('🔍 사건 검색 → 저장 → 재접속 → 클릭 전체 검증\n');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testCase = {
    courtName: '수원가정법원',
    caseYear: '2024',
    caseType: '드단',
    caseNumber: '26718',
    partyName: '김윤한'
  };

  const fullCaseNo = `${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`;

  try {
    // ========== PHASE 1: 검색 및 저장 ==========
    console.log('\n📍 PHASE 1: 사건 검색 및 저장\n');
    console.log('='.repeat(70));

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    // 경고창/팝업 자동 처리
    page.on('dialog', async dialog => {
      console.log(`⚠️  경고창 감지: "${dialog.message()}"`);
      await dialog.accept();
      console.log('✓ 경고창 자동 닫음\n');
    });

    console.log('Step 1-1: 페이지 접속...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✓ 페이지 로드 완료\n');

    // 경고창 닫힌 후 iframe 재로드 대기
    console.log('Step 1-1b: iframe 찾기 (재시도)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const frames = page.frames();
    console.log(`총 ${frames.length}개 프레임 발견`);

    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      console.log('사용 가능한 프레임 URL:');
      frames.forEach((f, idx) => console.log(`  ${idx}: ${f.url()}`));
      throw new Error('iframe을 찾을 수 없습니다');
    }

    console.log(`✓ iframe 발견: ${targetFrame.url()}\n`);

    console.log('Step 1-2: 사건검색 결과 저장 옵션 체크...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const saveCheckboxChecked = await targetFrame.evaluate(() => {
      const checkbox = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (checkbox && !checkbox.checked) {
        checkbox.click();
        return true;
      }
      return checkbox?.checked || false;
    });

    console.log(`✓ 저장 옵션: ${saveCheckboxChecked ? '체크됨' : '체크 실패'}\n`);

    console.log('Step 1-3: 검색 폼 입력...');
    console.log(`  사건번호: ${fullCaseNo}`);
    console.log(`  당사자명: ${testCase.partyName}`);

    // iframe 콘텐츠 완전히 로드될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 5000));
    await targetFrame.waitForSelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', { timeout: 20000 });

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', testCase.partyName);
    console.log('✓ 폼 입력 완료\n');

    console.log('Step 1-4: 캡챠 인식 및 제출...');
    const captchaImage = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    const screenshot = await captchaImage!.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠 인식: "${result.text}"\n`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

    console.log('Step 1-5: 검색 버튼 클릭...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

    console.log('⏳ 검색 결과 대기 (5초)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 검색 결과 확인
    console.log('Step 1-6: 검색 결과 확인...');
    const searchResult = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      const hasResults = rows && rows.length > 0;

      return {
        hasResults,
        rowCount: rows?.length || 0,
        bodyText: document.body.textContent?.substring(0, 500)
      };
    });

    console.log(`결과 여부: ${searchResult.hasResults ? '✅ 있음' : '❌ 없음'}`);
    console.log(`결과 건수: ${searchResult.rowCount}건`);

    if (!searchResult.hasResults) {
      console.log('\n⚠️  검색 결과가 없습니다.');
      console.log('페이지 내용 일부:');
      console.log(searchResult.bodyText);
    }

    // 쿠키 확인
    console.log('\nStep 1-7: 저장된 쿠키 확인...');
    const cookies = await page.cookies();
    const relevantCookies = cookies.filter(c =>
      c.name.includes('ssgo') ||
      c.name.includes('cs') ||
      c.name.includes('case') ||
      c.name === 'ssgocpk'
    );

    console.log('관련 쿠키:');
    relevantCookies.forEach(c => {
      console.log(`  - ${c.name}: ${c.value.substring(0, 50)}${c.value.length > 50 ? '...' : ''}`);
    });

    // 스크린샷 저장
    const outputDir = path.join(process.cwd(), 'temp', 'flow-verification');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(outputDir, '1-after-search.png'),
      fullPage: true
    });
    console.log('\n✓ 스크린샷: temp/flow-verification/1-after-search.png');

    // ========== PHASE 2: 페이지 리프레시 후 저장된 결과 확인 ==========
    console.log('\n\n📍 PHASE 2: 페이지 리프레시 후 저장된 검색 결과 확인\n');
    console.log('='.repeat(70));

    console.log('Step 2-1: 페이지 리프레시...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✓ 리프레시 완료\n');

    const frames2 = page.frames();
    const targetFrame2 = frames2.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame2) {
      throw new Error('리프레시 후 iframe을 찾을 수 없습니다');
    }

    console.log('Step 2-2: 저장된 검색 결과 그리드 확인...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const savedGrid = await targetFrame2.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return {
          hasSavedResults: false,
          rowCount: 0,
          message: '저장된 검색 결과가 없습니다'
        };
      }

      const results = Array.from(rows).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          rowId: row.id,
          법원명: cells[2]?.textContent?.trim(),
          사건번호: cells[3]?.textContent?.trim(),
          사건명: cells[4]?.textContent?.trim(),
          hasOnClick: !!row.getAttribute('onclick'),
          onClick: row.getAttribute('onclick')?.substring(0, 100)
        };
      });

      return {
        hasSavedResults: true,
        rowCount: rows.length,
        results
      };
    });

    console.log(`저장된 결과: ${savedGrid.hasSavedResults ? '✅ 있음' : '❌ 없음'}`);
    console.log(`저장된 건수: ${savedGrid.rowCount}건\n`);

    if (savedGrid.hasSavedResults) {
      console.log('저장된 검색 결과 목록:');
      console.log(JSON.stringify(savedGrid.results, null, 2));
    } else {
      console.log('⚠️  ' + savedGrid.message);
    }

    await page.screenshot({
      path: path.join(outputDir, '2-after-refresh-saved-list.png'),
      fullPage: true
    });
    console.log('\n✓ 스크린샷: temp/flow-verification/2-after-refresh-saved-list.png');

    // ========== PHASE 3: 저장된 사건 클릭 (캡챠 불필요 확인) ==========
    if (savedGrid.hasSavedResults) {
      console.log('\n\n📍 PHASE 3: 저장된 사건 클릭 (캡챠 필요 여부 확인)\n');
      console.log('='.repeat(70));

      // Network 모니터링 시작
      const clickRequests: any[] = [];
      page.on('request', request => {
        clickRequests.push({
          url: request.url(),
          method: request.method()
        });
      });

      const urlBeforeClick = page.url();
      console.log(`클릭 전 URL: ${urlBeforeClick}\n`);

      console.log('Step 3-1: 첫 번째 저장된 결과 클릭...');

      await targetFrame2.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr') as HTMLElement;
        if (firstRow) {
          firstRow.click();
        }
      });

      console.log('⏳ 클릭 후 대기 (5초)...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const urlAfterClick = page.url();
      console.log(`클릭 후 URL: ${urlAfterClick}`);
      console.log(`URL 변경: ${urlBeforeClick !== urlAfterClick ? '✅ YES' : '❌ NO'}\n`);

      // 캡챠 입력 필드 확인
      console.log('Step 3-2: 캡챠 입력 필드 존재 여부 확인...');
      const hasCaptcha = await targetFrame2.evaluate(() => {
        const captchaInput = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer');
        return {
          exists: !!captchaInput,
          visible: captchaInput ? window.getComputedStyle(captchaInput).display !== 'none' : false
        };
      });

      console.log(`캡챠 필드 존재: ${hasCaptcha.exists ? '✅ YES' : '❌ NO'}`);
      console.log(`캡챠 필드 보임: ${hasCaptcha.visible ? '✅ YES' : '❌ NO'}`);
      console.log(`\n💡 결론: 캡챠 ${hasCaptcha.exists && hasCaptcha.visible ? '필요함 ❌' : '불필요함 ✅'}\n`);

      // Network 요청 분석
      console.log('Step 3-3: 클릭 시 발생한 Network 요청...');
      const relevantRequests = clickRequests.filter(req =>
        !req.url.includes('.png') &&
        !req.url.includes('.css') &&
        !req.url.includes('.js') &&
        !req.url.includes('google')
      ).slice(-10); // 마지막 10개만

      if (relevantRequests.length > 0) {
        relevantRequests.forEach((req, idx) => {
          console.log(`  ${idx + 1}. ${req.method} ${req.url}`);
        });
      } else {
        console.log('  (관련 요청 없음)');
      }

      await page.screenshot({
        path: path.join(outputDir, '3-after-click-saved-result.png'),
        fullPage: true
      });
      console.log('\n✓ 스크린샷: temp/flow-verification/3-after-click-saved-result.png');

      // 최종 결과 저장
      const finalReport = {
        phase1_search: {
          hasResults: searchResult.hasResults,
          resultCount: searchResult.rowCount
        },
        phase2_saved: {
          hasSavedResults: savedGrid.hasSavedResults,
          savedCount: savedGrid.rowCount,
          savedResults: savedGrid.results
        },
        phase3_click: {
          urlChanged: urlBeforeClick !== urlAfterClick,
          urlBefore: urlBeforeClick,
          urlAfter: urlAfterClick,
          captchaRequired: hasCaptcha.exists && hasCaptcha.visible,
          networkRequests: relevantRequests
        }
      };

      fs.writeFileSync(
        path.join(outputDir, 'flow-verification-report.json'),
        JSON.stringify(finalReport, null, 2)
      );
      console.log('\n✓ 최종 리포트: temp/flow-verification/flow-verification-report.json');
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('브라우저를 30초간 열어둡니다. 직접 확인해보세요...');
    console.log('='.repeat(70));
    await new Promise(resolve => setTimeout(resolve, 30000));

  } finally {
    await browser.close();
  }
}

verifyFlow()
  .then(() => {
    console.log('\n✅ 전체 검증 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
