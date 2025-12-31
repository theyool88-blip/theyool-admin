/**
 * iframe 확인 스크립트
 */

import puppeteer from 'puppeteer';

async function checkIframe() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
    waitUntil: 'networkidle2',
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  // iframe 확인
  console.log('\n📍 iframe 찾기...');
  const frames = page.frames();
  console.log(`총 ${frames.length}개의 frame 발견:`);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    console.log(`\nFrame ${i}:`);
    console.log('  Name:', frame.name());
    console.log('  URL:', frame.url());

    // 각 frame에서 input 찾기
    try {
      const inputs = await frame.$$eval('input', els =>
        els.map(el => ({
          type: el.type,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder
        }))
      );
      console.log('  Input 개수:', inputs.length);
      if (inputs.length > 5) {
        console.log('  ✅ 이 frame에 검색 폼이 있을 수 있습니다!');
        console.log('  Inputs:', JSON.stringify(inputs.slice(0, 10), null, 2));
      }
    } catch (e) {
      console.log('  (input 찾기 실패)');
    }
  }

  console.log('\n20초 대기...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  await browser.close();
}

checkIframe().catch(console.error);
