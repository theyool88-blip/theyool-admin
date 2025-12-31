/**
 * 법원 선택 필드 찾기
 */

import puppeteer from 'puppeteer';

async function findCourtSelector() {
  console.log('🔍 법원 선택 필드 찾기\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 경고창 자동 닫기
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    console.log('페이지 접속...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✓ iframe 발견\n');

    // 모든 select, input 요소 찾기
    const formElements = await targetFrame.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select')).map(el => ({
        type: 'select',
        id: el.id,
        name: el.getAttribute('name'),
        options: Array.from(el.options).slice(0, 5).map(opt => opt.text) // 처음 5개만
      }));

      const inputs = Array.from(document.querySelectorAll('input[type="text"]')).map(el => ({
        type: 'input',
        id: el.id,
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder')
      }));

      return { selects, inputs };
    });

    console.log('=== SELECT 요소들 ===\n');
    formElements.selects.forEach((sel, idx) => {
      console.log(`${idx + 1}. ID: ${sel.id}`);
      console.log(`   Name: ${sel.name}`);
      console.log(`   Options: ${sel.options.join(', ')}`);
      console.log();
    });

    console.log('\n=== INPUT 요소들 ===\n');
    formElements.inputs.forEach((inp, idx) => {
      console.log(`${idx + 1}. ID: ${inp.id}`);
      console.log(`   Name: ${inp.name}`);
      console.log(`   Placeholder: ${inp.placeholder}`);
      console.log();
    });

    console.log('브라우저를 1분간 열어둡니다...');
    await new Promise(r => setTimeout(r, 60000));

  } finally {
    await browser.close();
  }
}

findCourtSelector()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
