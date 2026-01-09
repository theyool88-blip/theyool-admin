/**
 * 사건 클릭 시 동작 확인
 * - 새 창(팝업)이 열리는지?
 * - 같은 페이지에서 내용이 바뀌는지?
 */

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function checkGeneralBehavior() {
  console.log('🔍 사건 클릭 시 동작 확인\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 모든 팝업/새창 감지
    browser.on('targetcreated', async (target) => {
      console.log(`🆕 새 타겟 생성: ${target.type()} - ${target.url()}`);
    });

    // Alert 처리
    page.on('dialog', async (dialog) => {
      console.log(`⚠️ Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    // 페이지 내 팝업 감지
    page.on('popup', async (popup) => {
      if (popup) console.log(`🆕 팝업 감지: ${popup.url()}`);
    });

    console.log('📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 10000));

    let targetFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
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

    // 캡챠 해결
    const solver = getVisionCaptchaSolver();
    let searchSuccess = false;

    for (let attempt = 1; attempt <= 10; attempt++) {
      console.log(`\n🔐 캡챠 시도 ${attempt}/10...`);

      // 캡챠 이미지가 없으면 새로고침
      targetFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
      if (!targetFrame) {
        console.log('  iframe 재탐색 필요');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await new Promise((r) => setTimeout(r, 10000));
        targetFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
        if (!targetFrame) break;

        // 검색 조건 다시 입력
        await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
        await new Promise((r) => setTimeout(r, 2000));
        await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
        await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
        await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
        await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
      }

      // 캡챠 입력 초기화
      await targetFrame.evaluate(() => {
        const input = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer') as HTMLInputElement;
        if (input) input.value = '';
      });

      const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      if (!captchaImg) {
        console.log('  ⚠️ 캡챠 이미지 없음, 새로고침 버튼 클릭');
        try {
          await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          // 버튼이 없으면 페이지 새로고침
          await page.reload({ waitUntil: 'domcontentloaded' });
          await new Promise((r) => setTimeout(r, 10000));
        }
        continue;
      }

      const screenshot = await captchaImg.screenshot();
      const result = await solver.solveCaptcha(screenshot);
      console.log(`  인식: "${result.text}"`);

      // 6자리가 아니면 다시 시도
      if (!result.text || result.text.length !== 6) {
        console.log(`  ⚠️ 유효하지 않은 캡챠 (${result.text?.length}자리, 6자리 필요)`);
        try {
          await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          // 무시
        }
        continue;
      }

      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

      console.log('  🔎 검색...');
      await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
      await new Promise((r) => setTimeout(r, 5000));

      // 결과 확인
      const hasResults = await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const rows = tbody?.querySelectorAll('tr');
        if (!rows || rows.length === 0) return false;
        const firstRow = rows[0];
        const text = firstRow.textContent?.trim() || '';
        return text.length > 10; // 실제 데이터가 있는지
      });

      if (hasResults) {
        console.log('  ✅ 검색 성공!');
        searchSuccess = true;
        break;
      } else {
        console.log('  ❌ 검색 실패');
      }
    }

    if (!searchSuccess) {
      console.log('\n❌ 검색 실패. 수동으로 확인 필요');
      await new Promise((r) => setTimeout(r, 120000));
      return;
    }

    // 검색 결과 확인
    const resultInfo = await targetFrame!.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      if (!rows) return null;
      return {
        count: rows.length,
        firstRow: rows[0]?.textContent?.trim().substring(0, 100),
      };
    });
    console.log('\n📋 검색 결과:', resultInfo);

    // 스크린샷 저장
    const outputDir = path.join(process.cwd(), 'temp', 'general-behavior');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(outputDir, '1-search-result.png'), fullPage: true });

    // ============================================
    // 사건 클릭 테스트
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('🖱️ 사건 클릭 테스트');
    console.log('='.repeat(60));

    const pagesBefore = (await browser.pages()).length;
    console.log(`  현재 페이지 수: ${pagesBefore}`);

    // 클릭 전 스크린샷
    await page.screenshot({ path: path.join(outputDir, '2-before-click.png'), fullPage: true });

    // 사건 클릭 (단일 클릭)
    console.log('\n  📌 단일 클릭 시도...');
    await targetFrame!.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        firstRow.click();
      }
    });
    await new Promise((r) => setTimeout(r, 3000));

    let pagesAfter = (await browser.pages()).length;
    console.log(`  페이지 수: ${pagesAfter}`);
    await page.screenshot({ path: path.join(outputDir, '3-after-single-click.png'), fullPage: true });

    // 더블 클릭 시도
    console.log('\n  📌 더블 클릭 시도...');
    await targetFrame!.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        const dblClickEvent = new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        firstRow.dispatchEvent(dblClickEvent);
      }
    });
    await new Promise((r) => setTimeout(r, 3000));

    pagesAfter = (await browser.pages()).length;
    console.log(`  페이지 수: ${pagesAfter}`);
    await page.screenshot({ path: path.join(outputDir, '4-after-double-click.png'), fullPage: true });

    // 페이지 변화 확인
    const allPages = await browser.pages();
    console.log(`\n  전체 페이지 목록:`);
    for (let i = 0; i < allPages.length; i++) {
      console.log(`    ${i}: ${allPages[i].url()}`);
    }

    // 현재 페이지 내용 변화 확인
    const currentContent = await targetFrame!.evaluate(() => {
      // 탭 메뉴가 있는지
      const tabs = document.querySelectorAll('[class*="tab"], [id*="tab"]');
      // 일반내용 영역이 있는지
      const generalArea = document.querySelector('[id*="detail"], [id*="gnrl"], [class*="detail"]');

      return {
        tabCount: tabs.length,
        hasGeneralArea: !!generalArea,
        bodyText: document.body?.innerText?.substring(0, 500),
      };
    });
    console.log('\n  현재 페이지 상태:');
    console.log(`    탭 수: ${currentContent.tabCount}`);
    console.log(`    일반내용 영역: ${currentContent.hasGeneralArea}`);

    console.log('\n✅ 스크린샷 저장: temp/general-behavior/');
    console.log('\n브라우저를 90초간 열어둡니다. 수동으로 확인해주세요...');
    await new Promise((r) => setTimeout(r, 90000));

  } finally {
    await browser.close();
  }
}

checkGeneralBehavior()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
