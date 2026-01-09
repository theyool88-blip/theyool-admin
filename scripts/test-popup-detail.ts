/**
 * 대법원 사건 일반내용 조회 - 팝업 방식 테스트
 * 사건 클릭 시 새 창(팝업)이 열리므로 해당 창에서 데이터 수집
 */

import puppeteer, { Page } from 'puppeteer';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function testPopupGeneral() {
  console.log('🔍 팝업 방식 일반내용 조회 테스트\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

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

    // 검색 조건 입력
    console.log('🔧 검색 조건 입력...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise((r) => setTimeout(r, 2000));

    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    // 캡챠 해결 (최대 5회 재시도)
    let searchSuccess = false;
    const solver = getVisionCaptchaSolver();

    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`\n🔐 캡챠 시도 ${attempt}/5...`);

      // 캡챠 입력 필드 초기화
      await targetFrame.evaluate(() => {
        const input = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer') as HTMLInputElement;
        if (input) input.value = '';
      });

      // 캡챠 이미지 캡처
      const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      if (!captchaImg) {
        console.log('  ❌ 캡챠 이미지를 찾을 수 없습니다');
        continue;
      }

      const screenshot = await captchaImg.screenshot();
      const result = await solver.solveCaptcha(screenshot);
      console.log(`  인식: "${result.text}" (신뢰도: ${((result.confidence || 0) * 100).toFixed(0)}%)`);

      if (!result.text || result.text.length > 6) {
        console.log('  ⚠️ 인식 결과가 이상함, 캡챠 새로고침...');
        await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

      // 검색 실행
      console.log('  🔎 검색 버튼 클릭...');
      await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
      await new Promise((r) => setTimeout(r, 5000));

      // 결과 확인
      const hasResults = await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const rows = tbody?.querySelectorAll('tr');
        return rows && rows.length > 0 && rows[0].textContent?.trim() !== '';
      });

      if (hasResults) {
        console.log('  ✅ 검색 성공!');
        searchSuccess = true;
        break;
      } else {
        console.log('  ❌ 검색 실패 (캡챠 오류 가능)');
      }
    }

    if (!searchSuccess) {
      console.log('\n❌ 5회 시도 후 검색 실패');
      await new Promise((r) => setTimeout(r, 60000));
      return;
    }

    // 검색 결과 정보 출력
    const resultInfo = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      if (!rows || rows.length === 0) return null;

      const firstRow = rows[0];
      const cells = firstRow.querySelectorAll('td');
      return {
        count: rows.length,
        firstRow: Array.from(cells).map((c) => c.textContent?.trim()),
      };
    });

    console.log('\n📋 검색 결과:', resultInfo);

    // ============================================
    // 핵심: 팝업 대기 및 처리
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('🖱️ 사건 클릭 (팝업 대기)...');
    console.log('='.repeat(60));

    // 현재 열린 페이지 수 확인
    const pagesBefore = (await browser.pages()).length;
    console.log(`  현재 페이지 수: ${pagesBefore}`);

    // 새 페이지(팝업) 열림 감지를 위한 Promise
    const newPagePromise = new Promise<Page>((resolve) => {
      browser.once('targetcreated', async (target) => {
        const newPage = await target.page();
        if (newPage) {
          console.log('  ✅ 새 페이지(팝업) 감지됨!');
          resolve(newPage);
        }
      });
    });

    // 사건 클릭 (더블클릭으로 일반내용 탭 화면 열기)
    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        // 더블클릭 이벤트 발생
        const dblClickEvent = new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        firstRow.dispatchEvent(dblClickEvent);
      }
    });

    // 팝업 대기 (최대 10초)
    console.log('  팝업 대기 중...');
    const popupPage = await Promise.race([
      newPagePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);

    if (popupPage) {
      console.log('\n📋 팝업 페이지 발견!');
      console.log(`  URL: ${popupPage.url()}`);

      // 팝업 페이지 로딩 대기
      await popupPage.waitForSelector('body', { timeout: 10000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 3000));

      // 팝업 내용 확인
      const popupContent = await popupPage.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body?.innerText?.substring(0, 500),
          tables: document.querySelectorAll('table').length,
        };
      });

      console.log('  팝업 내용:');
      console.log(`    제목: ${popupContent.title}`);
      console.log(`    테이블 수: ${popupContent.tables}`);
      console.log(`    본문 (일부): ${popupContent.bodyText?.substring(0, 200)}`);

      // 스크린샷 저장
      await popupPage.screenshot({
        path: path.join(process.cwd(), 'temp', 'popup-general.png'),
        fullPage: true,
      });
      console.log('\n  📸 스크린샷 저장: temp/popup-general.png');

    } else {
      console.log('\n⚠️ 팝업이 열리지 않음. 다른 방식 시도...');

      // 팝업이 안 열리면 단일 클릭 후 확인
      const pagesAfter = (await browser.pages()).length;
      console.log(`  페이지 수: ${pagesAfter}`);

      if (pagesAfter > pagesBefore) {
        const allPages = await browser.pages();
        const lastPage = allPages[allPages.length - 1];
        console.log(`  마지막 페이지 URL: ${lastPage.url()}`);
      }
    }

    // 브라우저 유지
    console.log('\n브라우저를 60초간 열어둡니다...');
    await new Promise((r) => setTimeout(r, 60000));

  } finally {
    await browser.close();
  }
}

testPopupGeneral()
  .then(() => {
    console.log('\n✅ 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
