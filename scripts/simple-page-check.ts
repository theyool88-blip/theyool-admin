/**
 * 단순 페이지 오픈 및 상태 확인
 */

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

async function checkPage() {
  console.log('🔍 페이지 상태 확인\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 경고창 자동 닫기
    page.on('dialog', async dialog => {
      console.log(`경고창: "${dialog.message()}"`);
      await dialog.accept();
      console.log('경고창 닫음\n');
    });

    console.log('페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('대기 중 (10초)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 프레임 확인
    const frames = page.frames();
    console.log(`총 ${frames.length}개 프레임:\n`);
    frames.forEach((f, idx) => {
      console.log(`${idx}. ${f.url()}`);
    });

    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (targetFrame) {
      console.log('\n✓ iframe 발견!');
      console.log(`URL: ${targetFrame.url()}\n`);

      // iframe 내부 확인
      const iframeContent = await targetFrame.evaluate(() => {
        return {
          bodyText: document.body.textContent?.substring(0, 200),
          inputCount: document.querySelectorAll('input').length,
          hasSearchForm: !!document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo')
        };
      });

      console.log('iframe 내부:');
      console.log(`  - Input 개수: ${iframeContent.inputCount}`);
      console.log(`  - 검색 폼: ${iframeContent.hasSearchForm ? '✅ 있음' : '❌ 없음'}`);
      console.log(`  - 내용: ${iframeContent.bodyText}\n`);
    } else {
      console.log('\n❌ iframe 없음\n');
    }

    // 스크린샷
    const outputDir = path.join(process.cwd(), 'temp', 'page-check');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(outputDir, 'page-state.png'),
      fullPage: true
    });

    console.log('스크린샷: temp/page-check/page-state.png\n');

    console.log('브라우저를 1분간 열어둡니다...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } finally {
    await browser.close();
  }
}

checkPage()
  .then(() => {
    console.log('\n완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n에러:', error);
    process.exit(1);
  });
