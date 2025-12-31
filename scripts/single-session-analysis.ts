/**
 * 단일 세션 분석: 브라우저를 닫지 않고 검색 → 새로고침 → 분석
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer));
  });
}

async function singleSessionAnalysis() {
  console.log('🔍 단일 세션 분석 (브라우저를 닫지 않음)\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(process.cwd(), 'temp', 'single-session');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('dialog', async dialog => await dialog.accept());

    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe 없음');

    console.log('✓ iframe 발견\n');

    // === 폼 입력 ===
    console.log('폼 자동 입력 중...\n');

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

    console.log('✅ 폼 입력 완료\n');
    console.log('='.repeat(70));
    console.log('브라우저에서:');
    console.log('1. 캡챠 입력');
    console.log('2. 사건검색 버튼 클릭');
    console.log('3. 결과 확인 후 여기로 돌아오세요');
    console.log('='.repeat(70));

    await question('\n검색 완료했으면 Enter를 누르세요...');

    console.log('\n같은 브라우저에서 페이지 새로고침합니다...\n');

    // 같은 브라우저, 같은 세션에서 새로고침
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('리프레시 후 iframe 없음');

    console.log('✓ 새로고침 완료\n');

    // 저장된 사건 추출
    const savedCases = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return { hasCases: false, cases: [] };
      }

      return {
        hasCases: true,
        cases: Array.from(rows).map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));

          return {
            rowId: row.id,
            onclick: row.getAttribute('onclick'),
            법원: cells[2]?.textContent?.trim(),
            사건번호: cells[3]?.textContent?.trim(),
            사건명: cells[4]?.textContent?.trim(),
            outerHTML: row.outerHTML
          };
        })
      };
    });

    console.log('='.repeat(70));
    console.log('저장된 사건 목록:');
    console.log('='.repeat(70));

    if (!savedCases.hasCases) {
      console.log('❌ 저장된 사건 없음\n');
      rl.close();
      await new Promise(r => setTimeout(r, 30000));
      return;
    }

    console.log(`\n✅ ${savedCases.cases.length}건 발견!\n`);

    savedCases.cases.forEach((c, idx) => {
      console.log(`[${idx + 1}] ${c.법원} | ${c.사건번호} | ${c.사건명}`);
      console.log(`    Row ID: ${c.rowId}`);
      console.log(`    onclick: ${c.onclick || '(없음)'}`);
      console.log();
    });

    console.log('='.repeat(70));
    console.log('첫 번째 사건 전체 HTML:');
    console.log('='.repeat(70));
    console.log(savedCases.cases[0].outerHTML);
    console.log('='.repeat(70));

    // Network 모니터링
    const requests: any[] = [];
    page.on('request', req => {
      requests.push({
        method: req.method(),
        url: req.url(),
        postData: req.postData()
      });
    });

    await new Promise(r => setTimeout(r, 2000));
    requests.length = 0;

    console.log('\n저장된 사건 클릭합니다...\n');

    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) firstRow.click();
    });

    await new Promise(r => setTimeout(r, 5000));

    const relevantRequests = requests.filter(r =>
      !r.url.includes('.png') &&
      !r.url.includes('.css') &&
      !r.url.includes('.js') &&
      !r.url.includes('google')
    );

    console.log('='.repeat(70));
    console.log('클릭 시 발생한 Network 요청:');
    console.log('='.repeat(70));

    if (relevantRequests.length > 0) {
      relevantRequests.forEach((req, idx) => {
        console.log(`\n${idx + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`   POST: ${req.postData.substring(0, 300)}`);
        }
      });
    } else {
      console.log('(네트워크 요청 없음)');
    }

    // 결과 저장
    fs.writeFileSync(
      path.join(outputDir, 'result.json'),
      JSON.stringify({ savedCases, networkRequests: relevantRequests }, null, 2)
    );

    console.log(`\n\n✅ 결과 저장: temp/single-session/result.json\n`);
    console.log('브라우저를 5분간 열어둡니다...\n');

    rl.close();
    await new Promise(r => setTimeout(r, 300000));

  } finally {
    rl.close();
    await browser.close();
  }
}

singleSessionAnalysis()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    rl.close();
    process.exit(1);
  });
