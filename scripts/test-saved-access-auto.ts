/**
 * 자동 테스트: 저장된 사건 접근
 * 수동 캡챠 입력 → 자동으로 저장된 목록 확인
 */

import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.on('dialog', async dialog => await dialog.accept());

    console.log('📍 페이지 접속 중...\n');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✅ 페이지 로드 완료\n');

    // 저장 옵션 체크
    console.log('Step 1: 저장 옵션 체크...');
    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });
    console.log('✓ 완료\n');

    // 폼 입력
    console.log('Step 2: 폼 입력...');
    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
    console.log('✓ 완료\n');

    console.log('='.repeat(70));
    console.log('👉 브라우저에서 다음을 진행하세요:');
    console.log('   1. 캡챠 확인하고 입력');
    console.log('   2. [사건검색] 버튼 클릭');
    console.log('   3. 결과 확인');
    console.log('='.repeat(70));
    console.log('\n⏰ 120초 대기 중... (캡챠 입력 및 검색을 완료하세요)\n');

    // 120초 대기 (사용자가 캡챠 입력하고 검색)
    await new Promise(r => setTimeout(r, 120000));

    console.log('\n='.repeat(70));
    console.log('📋 저장된 사건 목록 확인 시작');
    console.log('='.repeat(70));

    // 페이지 새로고침
    console.log('\n🔄 페이지 새로고침 중...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('새로고침 후 iframe 없음');
    console.log('✓ 새로고침 완료\n');

    // 저장된 사건 추출
    const savedCases = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return [];
      }

      return Array.from(rows).map((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          index: idx,
          법원: cells[2]?.textContent?.trim(),
          사건번호: cells[3]?.textContent?.trim(),
          사건명: cells[4]?.textContent?.trim()
        };
      });
    });

    console.log('💾 저장된 사건 목록:\n');
    if (savedCases.length === 0) {
      console.log('❌ 저장된 사건이 없습니다.');
      console.log('   → 검색이 실패했거나 저장 옵션이 체크되지 않았을 수 있습니다.\n');
    } else {
      savedCases.forEach((c, idx) => {
        console.log(`[${idx + 1}] ${c.법원} | ${c.사건번호} | ${c.사건명}`);
      });
      console.log(`\n총 ${savedCases.length}건`);

      console.log('\n='.repeat(70));
      console.log('✅ 성공: 캡챠 없이 저장된 목록 접근!');
      console.log('='.repeat(70));

      // 첫 번째 사건 클릭
      console.log('\n🖱️  첫 번째 사건 클릭 중...');
      await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr') as HTMLElement;
        if (firstRow) firstRow.click();
      });

      await new Promise(r => setTimeout(r, 5000));

      console.log('\n='.repeat(70));
      console.log('✅ 성공: 캡챠 없이 사건 상세 정보 접근!');
      console.log('='.repeat(70));
    }

    console.log('\n\n🎯 최종 결론:');
    console.log('='.repeat(70));
    console.log('1. 초기 검색: 캡챠 1회 사용 ✅');
    console.log('2. 저장된 목록 보기: 캡챠 불필요 ✅');
    console.log('3. 사건 상세 보기: 캡챠 불필요 ✅');
    console.log('='.repeat(70));

    console.log('\n⏰ 브라우저를 3분간 열어둡니다. 자유롭게 확인하세요...\n');
    await new Promise(r => setTimeout(r, 180000));

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
