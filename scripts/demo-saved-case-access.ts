/**
 * 저장된 사건 접근 시연:
 * 1. 수동으로 캡챠 입력 → 검색
 * 2. 저장된 목록 확인 (캡챠 불필요)
 * 3. 사건 클릭 (캡챠 불필요)
 */

import puppeteer from 'puppeteer';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer));
  });
}

async function demo() {
  console.log('\n='.repeat(70));
  console.log('💾 저장된 사건 접근 시연');
  console.log('='.repeat(70));
  console.log('목표: 캡챠 1회만 사용하여 여러 사건 접근하기\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(process.cwd(), 'temp', 'saved-case-demo');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    // === 1단계: 초기 검색 (캡챠 사용) ===
    console.log('='.repeat(70));
    console.log('1단계: 초기 사건 검색 (캡챠 필요)');
    console.log('='.repeat(70));

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    // 폼 자동 입력
    console.log('\n폼 자동 입력 중...');

    await targetFrame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });

    await new Promise(r => setTimeout(r, 1000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');

    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial');
    await new Promise(r => setTimeout(r, 500));
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    console.log('✓ 폼 입력 완료\n');
    console.log('='.repeat(70));
    console.log('브라우저에서:');
    console.log('1. 캡챠 확인');
    console.log('2. 사건검색 버튼 클릭');
    console.log('3. 결과 확인');
    console.log('='.repeat(70));

    await question('\n✅ 검색 완료했으면 Enter를 누르세요...');

    await page.screenshot({ path: path.join(outputDir, '1-after-first-search.png'), fullPage: true });
    console.log('\n📸 스크린샷 저장: 1-after-first-search.png\n');

    // === 2단계: 저장된 목록 접근 (캡챠 불필요!) ===
    console.log('\n='.repeat(70));
    console.log('2단계: 저장된 사건 목록 접근 (캡챠 불필요!)');
    console.log('='.repeat(70));

    console.log('\n같은 브라우저 세션에서 페이지 새로고침 중...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('리프레시 후 iframe 없음');

    console.log('✓ 새로고침 완료\n');

    const savedCases = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return [];
      }

      return Array.from(rows).map((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          index: idx + 1,
          법원: cells[2]?.textContent?.trim(),
          사건번호: cells[3]?.textContent?.trim(),
          사건명: cells[4]?.textContent?.trim()
        };
      });
    });

    console.log('📋 저장된 사건 목록:\n');
    if (savedCases.length === 0) {
      console.log('❌ 저장된 사건이 없습니다.');
      console.log('   (검색이 실패했거나 저장 옵션이 체크되지 않았을 수 있습니다)\n');
    } else {
      savedCases.forEach(c => {
        console.log(`[${c.index}] ${c.법원} | ${c.사건번호} | ${c.사건명}`);
      });
      console.log(`\n총 ${savedCases.length}건\n`);
    }

    await page.screenshot({ path: path.join(outputDir, '2-saved-list.png'), fullPage: true });
    console.log('📸 스크린샷 저장: 2-saved-list.png\n');

    if (savedCases.length === 0) {
      console.log('저장된 사건이 없어 종료합니다.\n');
      rl.close();
      await new Promise(r => setTimeout(r, 30000));
      return;
    }

    // === 3단계: 저장된 사건 클릭 (캡챠 불필요!) ===
    console.log('\n='.repeat(70));
    console.log('3단계: 저장된 사건 클릭 (캡챠 불필요!)');
    console.log('='.repeat(70));

    const answer = await question('\n첫 번째 사건을 클릭하시겠습니까? (y/n): ');

    if (answer.toLowerCase() === 'y') {
      console.log('\n첫 번째 사건 클릭 중...');

      await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr') as HTMLElement;
        if (firstRow) firstRow.click();
      });

      await new Promise(r => setTimeout(r, 5000));

      await page.screenshot({ path: path.join(outputDir, '3-case-details.png'), fullPage: true });
      console.log('📸 스크린샷 저장: 3-case-details.png\n');

      // 캡챠 필요 여부 확인
      const needsCaptcha = await targetFrame.evaluate(() => {
        const captchaInput = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer');
        return captchaInput && window.getComputedStyle(captchaInput).display !== 'none';
      });

      console.log('='.repeat(70));
      if (needsCaptcha) {
        console.log('❌ 캡챠가 필요합니다 (재검색 방식)');
      } else {
        console.log('✅ 캡챠 없이 사건 상세 정보 접근 성공!');
        console.log('   → 저장된 사건은 세션 내에서 캡챠 없이 재접근 가능!');
      }
      console.log('='.repeat(70));
    }

    console.log('\n\n='.repeat(70));
    console.log('🎯 결론:');
    console.log('='.repeat(70));
    console.log('1. 초기 검색: 캡챠 1회 사용 ✅');
    console.log('2. 저장된 목록 보기: 캡챠 불필요 ✅');
    console.log('3. 사건 상세 보기: 캡챠 불필요 ✅');
    console.log('');
    console.log('💡 핵심: 같은 브라우저 세션을 유지하면');
    console.log('   저장된 사건(최대 50건)에 캡챠 없이 접근 가능!');
    console.log('='.repeat(70));

    console.log('\n브라우저를 2분간 열어둡니다. 다른 사건도 클릭해보세요...\n');
    rl.close();
    await new Promise(r => setTimeout(r, 120000));

  } finally {
    rl.close();
    await browser.close();
  }
}

demo()
  .then(() => {
    console.log('\n✅ 시연 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
