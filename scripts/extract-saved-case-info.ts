/**
 * 저장된 사건의 onclick 이벤트 및 HTML 추출
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

async function extractInfo() {
  console.log('🔍 저장된 사건 정보 추출\n');

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

    console.log('✓ iframe 발견\n');
    console.log('저장된 사건 목록을 확인합니다...\n');

    // 저장된 사건 테이블 정보 추출
    const savedCases = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return { hasCases: false, cases: [] };
      }

      return {
        hasCases: true,
        cases: Array.from(rows).map((row, idx) => {
          const cells = Array.from(row.querySelectorAll('td'));

          return {
            index: idx,
            rowId: row.id,
            onclick: row.getAttribute('onclick'),
            onmouseover: row.getAttribute('onmouseover'),
            onmouseout: row.getAttribute('onmouseout'),
            className: row.className,
            법원: cells[2]?.textContent?.trim(),
            사건번호: cells[3]?.textContent?.trim(),
            사건명: cells[4]?.textContent?.trim(),
            outerHTML: row.outerHTML,
            cells: cells.map((cell, cellIdx) => ({
              index: cellIdx,
              text: cell.textContent?.trim(),
              innerHTML: cell.innerHTML,
              onclick: cell.getAttribute('onclick'),
              id: cell.id
            }))
          };
        })
      };
    });

    if (!savedCases.hasCases) {
      console.log('❌ 저장된 사건이 없습니다.');
      console.log('\n먼저 사건을 검색하고 저장해야 합니다.');
      console.log('이전 스크립트로 검색을 완료한 후 이 스크립트를 실행하세요.\n');

      console.log('브라우저를 30초간 열어둡니다...');
      await new Promise(r => setTimeout(r, 30000));
      return;
    }

    console.log(`✅ ${savedCases.cases.length}건의 저장된 사건 발견!\n`);
    console.log('='.repeat(80));

    savedCases.cases.forEach((caseInfo, idx) => {
      console.log(`\n[${ idx + 1}] ${caseInfo.사건번호} - ${caseInfo.사건명}`);
      console.log('─'.repeat(80));
      console.log(`법원: ${caseInfo.법원}`);
      console.log(`Row ID: ${caseInfo.rowId}`);
      console.log(`Class: ${caseInfo.className || '(없음)'}`);
      console.log(`\n🔍 onclick 이벤트:`);
      console.log(caseInfo.onclick || '(없음)');

      if (caseInfo.onmouseover) {
        console.log(`\n🖱️  onmouseover: ${caseInfo.onmouseover.substring(0, 200)}...`);
      }

      console.log(`\n📋 각 셀 정보:`);
      caseInfo.cells.forEach(cell => {
        if (cell.text) {
          console.log(`  셀 ${cell.index}: "${cell.text}"`);
          if (cell.onclick) console.log(`    → onclick: ${cell.onclick}`);
          if (cell.id) console.log(`    → id: ${cell.id}`);
        }
      });
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('📄 첫 번째 사건의 전체 HTML:');
    console.log('='.repeat(80));
    console.log(savedCases.cases[0].outerHTML);
    console.log('='.repeat(80));

    // JSON 저장
    const outputDir = path.join(process.cwd(), 'temp', 'saved-case-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'saved-cases-info.json'),
      JSON.stringify(savedCases, null, 2)
    );

    console.log(`\n✅ 일반내용 저장: temp/saved-case-analysis/saved-cases-info.json\n`);

    // Network 요청 모니터링 시작
    console.log('\n🌐 이제 저장된 사건을 클릭합니다. Network 요청을 모니터링합니다...\n');

    const requests: any[] = [];
    page.on('request', req => {
      requests.push({
        time: new Date().toISOString(),
        method: req.method(),
        url: req.url(),
        headers: req.headers(),
        postData: req.postData()
      });
    });

    const responses: any[] = [];
    page.on('response', async res => {
      const contentType = res.headers()['content-type'] || '';
      let body = null;

      try {
        if (contentType.includes('json') || contentType.includes('text') || contentType.includes('html')) {
          body = await res.text();
        }
      } catch (e) {
        // ignore
      }

      responses.push({
        time: new Date().toISOString(),
        status: res.status(),
        url: res.url(),
        contentType,
        body: body ? body.substring(0, 1000) : null
      });
    });

    await new Promise(r => setTimeout(r, 2000));
    requests.length = 0;
    responses.length = 0;

    console.log('클릭 실행...\n');

    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        firstRow.click();
      }
    });

    await new Promise(r => setTimeout(r, 5000));

    console.log('='.repeat(80));
    console.log('📡 클릭 후 발생한 Network 요청:');
    console.log('='.repeat(80));

    const relevantRequests = requests.filter(r =>
      !r.url.includes('.png') &&
      !r.url.includes('.css') &&
      !r.url.includes('.js') &&
      !r.url.includes('google')
    );

    if (relevantRequests.length > 0) {
      relevantRequests.forEach((req, idx) => {
        console.log(`\n[${idx + 1}] ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`POST 데이터:\n${req.postData.substring(0, 500)}`);
        }
      });
    } else {
      console.log('(관련 네트워크 요청 없음)');
    }

    fs.writeFileSync(
      path.join(outputDir, 'network-requests.json'),
      JSON.stringify({ requests: relevantRequests, responses }, null, 2)
    );

    console.log('\n\n브라우저를 2분간 열어둡니다...');
    await new Promise(r => setTimeout(r, 120000));

  } finally {
    await browser.close();
  }
}

extractInfo()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
