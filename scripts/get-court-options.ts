/**
 * 법원 드롭다운 옵션 전체 조회
 */

import puppeteer from 'puppeteer';

async function getCourtOptions() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const frames = page.frames();
    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      console.log('❌ iframe을 찾을 수 없습니다');
      return;
    }

    console.log('✓ iframe 발견\n');

    // 모든 법원 옵션 가져오기
    const options = await targetFrame.$$eval(
      '#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd option',
      opts => opts.map(opt => ({
        value: opt.value,
        text: opt.textContent?.trim()
      }))
    );

    console.log(`📋 총 ${options.length}개의 법원 옵션:\n`);
    options.forEach((opt, idx) => {
      console.log(`${idx + 1}. value="${opt.value}" text="${opt.text}"`);
    });

    // 수원가정법원 찾기
    const suwonFamily = options.find(opt =>
      opt.text?.includes('수원가정법원')
    );

    if (suwonFamily) {
      console.log('\n✅ 수원가정법원 발견:');
      console.log(`   value: "${suwonFamily.value}"`);
      console.log(`   text: "${suwonFamily.text}"`);
    } else {
      console.log('\n❌ 수원가정법원을 찾을 수 없습니다');
    }

    console.log('\n5초 대기...');
    await new Promise(resolve => setTimeout(resolve, 5000));

  } finally {
    await browser.close();
  }
}

getCourtOptions().catch(console.error);
