/**
 * 모든 법원 목록 출력
 */

import puppeteer from 'puppeteer';

async function listCourts() {
  console.log('🔍 법원 목록 전체 조회\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    // 법원 선택 드롭다운의 모든 옵션 가져오기
    const courts = await targetFrame.evaluate(() => {
      const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd') as HTMLSelectElement;
      if (!select) return null;

      return Array.from(select.options).map((opt, idx) => ({
        index: idx,
        value: opt.value,
        text: opt.text
      }));
    });

    if (!courts) {
      console.log('❌ 법원 선택 드롭다운을 찾을 수 없습니다');
      return;
    }

    console.log(`총 ${courts.length}개 법원:\n`);
    console.log('='.repeat(70));

    courts.forEach(court => {
      console.log(`${court.index.toString().padStart(3)}. [${court.value}] ${court.text}`);
    });

    console.log('\n='.repeat(70));

    // 수원가정법원 찾기
    const suwonFamily = courts.find(c => c.text.includes('수원') && c.text.includes('가정'));

    if (suwonFamily) {
      console.log('\n✅ 수원가정법원 발견!');
      console.log(`   Index: ${suwonFamily.index}`);
      console.log(`   Value: ${suwonFamily.value}`);
      console.log(`   Text: ${suwonFamily.text}`);
    } else {
      console.log('\n❌ 수원가정법원을 찾을 수 없습니다');

      // 수원으로 시작하는 법원들 찾기
      const suwonCourts = courts.filter(c => c.text.includes('수원'));
      if (suwonCourts.length > 0) {
        console.log('\n"수원"이 포함된 법원들:');
        suwonCourts.forEach(c => {
          console.log(`   - [${c.value}] ${c.text}`);
        });
      }
    }

    console.log('\n\n브라우저를 30초간 열어둡니다...');
    await new Promise(r => setTimeout(r, 30000));

  } finally {
    await browser.close();
  }
}

listCourts()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
