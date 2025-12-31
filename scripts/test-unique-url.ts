/**
 * URL 테스트: 고유 URL이 존재하는지 확인
 * 1. 검색 후 URL 확인
 * 2. 사건 클릭 후 URL 확인
 * 3. 새 브라우저에서 URL 직접 접근 시도
 */

import puppeteer from 'puppeteer';

async function test() {
  console.log('\n='.repeat(70));
  console.log('🔍 고유 URL 존재 여부 테스트');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.on('dialog', async dialog => await dialog.accept());

    console.log('\n📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const initialUrl = page.url();
    console.log(`초기 URL: ${initialUrl}\n`);

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    const initialFrameUrl = targetFrame.url();
    console.log(`초기 iframe URL: ${initialFrameUrl}\n`);

    // 폼 입력
    console.log('폼 입력 중...');
    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
    console.log('✓ 완료\n');

    console.log('='.repeat(70));
    console.log('👉 브라우저에서: 캡챠 입력 → 검색 버튼 클릭');
    console.log('='.repeat(70));
    console.log('\n⏰ 120초 대기 중...\n');

    await new Promise(r => setTimeout(r, 120000));

    // 검색 후 URL 확인
    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    const afterSearchUrl = page.url();
    const afterSearchFrameUrl = targetFrame?.url() || '';

    console.log('\n='.repeat(70));
    console.log('📍 검색 후 URL:');
    console.log('='.repeat(70));
    console.log(`페이지 URL: ${afterSearchUrl}`);
    console.log(`iframe URL: ${afterSearchFrameUrl}`);
    console.log(`URL 변경 여부: ${initialUrl !== afterSearchUrl ? '✅ 변경됨' : '❌ 동일함'}\n`);

    // 사건 클릭
    console.log('첫 번째 사건 클릭 중...');
    await targetFrame?.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) firstRow.click();
    });

    await new Promise(r => setTimeout(r, 5000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    const afterClickUrl = page.url();
    const afterClickFrameUrl = targetFrame?.url() || '';

    console.log('\n='.repeat(70));
    console.log('📍 사건 클릭 후 URL:');
    console.log('='.repeat(70));
    console.log(`페이지 URL: ${afterClickUrl}`);
    console.log(`iframe URL: ${afterClickFrameUrl}`);
    console.log(`URL 변경 여부: ${afterSearchUrl !== afterClickUrl ? '✅ 변경됨' : '❌ 동일함'}\n`);

    // 새 브라우저에서 직접 접근 시도
    console.log('='.repeat(70));
    console.log('🧪 테스트: 새 브라우저에서 URL 직접 접근');
    console.log('='.repeat(70));

    const browser2 = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page2 = await browser2.newPage();
    await page2.setViewport({ width: 1920, height: 1080 });
    page2.on('dialog', async dialog => await dialog.accept());

    console.log(`\n새 브라우저에서 접근 시도: ${afterClickUrl}\n`);
    await page2.goto(afterClickUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    // 새 브라우저에서 사건 정보가 보이는지 확인
    const targetFrame2 = page2.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));

    const hasCaseData = await targetFrame2?.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      return rows && rows.length > 0;
    });

    console.log('='.repeat(70));
    console.log('🎯 결과:');
    console.log('='.repeat(70));

    if (hasCaseData) {
      console.log('✅ 새 브라우저에서도 사건 정보 접근 가능!');
      console.log('   → 고유 URL이 존재합니다!');
    } else {
      console.log('❌ 새 브라우저에서 사건 정보 없음');
      console.log('   → 세션 기반입니다. 고유 URL 없음.');
    }
    console.log('='.repeat(70));

    console.log('\n⏰ 두 브라우저를 2분간 열어둡니다. 직접 확인하세요...\n');
    await new Promise(r => setTimeout(r, 120000));

    await browser2.close();

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 테스트 완료\n');
  }
}

test()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
