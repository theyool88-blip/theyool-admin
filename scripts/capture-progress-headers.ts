/**
 * Puppeteer로 진행내용 API 요청 헤더/바디 캡처
 */
import puppeteer from 'puppeteer';
import * as path from 'path';

async function main() {
  console.log('🚀 브라우저 시작...');

  // 저장된 프로필 사용
  const profileDir = path.join(process.cwd(), 'data/scourt-profiles/profile_1767095937486');

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 네트워크 요청 인터셉트
  await page.setRequestInterception(true);

  const capturedRequests: any[] = [];

  page.on('request', async (req) => {
    const url = req.url();

    // 진행내용 API 요청 캡처
    if (url.includes('selectHmpgFmlyCsProgCtt')) {
      console.log('\n' + '='.repeat(60));
      console.log('📡 진행내용 API 요청 캡처!');
      console.log('='.repeat(60));
      console.log('URL:', url);
      console.log('Method:', req.method());
      console.log('\n헤더:');
      const headers = req.headers();
      Object.entries(headers).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      console.log('\n바디:');
      console.log(req.postData());

      capturedRequests.push({
        url,
        method: req.method(),
        headers,
        body: req.postData()
      });
    }

    req.continue();
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('selectHmpgFmlyCsProgCtt')) {
      console.log('\n📥 진행내용 API 응답:');
      console.log('Status:', res.status());
      try {
        const json = await res.json();
        if (json.data) {
          console.log('데이터 키:', Object.keys(json.data).join(', '));
          const progList = json.data.dlt_csProgCttLst || [];
          console.log('진행내용:', progList.length, '건');
          if (progList.length > 0) {
            console.log('첫번째:', JSON.stringify(progList[0]).substring(0, 200));
          }
        } else if (json.errors) {
          console.log('에러:', json.errors.errorMessage);
        }
      } catch (e) {}
    }
  });

  page.on('dialog', async dialog => await dialog.accept());

  // 나의사건검색 페이지로 이동
  console.log('\n📍 나의사건검색 페이지로 이동...');
  await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 8000));

  // iframe 찾기
  let targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
  if (!targetFrame) {
    console.log('❌ iframe 없음');
    await browser.close();
    return;
  }

  console.log('✅ iframe 발견');

  // 저장된 사건 확인
  const savedCases = await targetFrame.evaluate(() => {
    const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
    const rows = tbody?.querySelectorAll('tr');
    if (!rows || rows.length === 0) return [];
    return Array.from(rows).map((row, idx) => {
      const cells = Array.from(row.querySelectorAll('td'));
      return {
        index: idx,
        사건번호: cells[3]?.textContent?.trim(),
      };
    });
  });

  console.log('저장된 사건:', savedCases.length, '건');

  if (savedCases.length === 0) {
    console.log('⚠️ 저장된 사건 없음');
    await new Promise(r => setTimeout(r, 60000));
    await browser.close();
    return;
  }

  // 첫 번째 사건 클릭
  console.log('\n🖱️ 첫 번째 사건 클릭...');
  await targetFrame.evaluate(() => {
    const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
    const firstRow = tbody?.querySelector('tr') as HTMLElement;
    if (firstRow) firstRow.click();
  });

  await new Promise(r => setTimeout(r, 5000));

  // 진행내용 탭 클릭
  console.log('\n🖱️ 진행내용 탭 클릭...');
  await targetFrame.evaluate(() => {
    const tabs = document.querySelectorAll('[role="tab"], [class*="tab"] a');
    for (const tab of tabs) {
      if (tab.textContent?.trim() === '진행내용') {
        (tab as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  await new Promise(r => setTimeout(r, 5000));

  // 캡처 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 캡처 결과');
  console.log('='.repeat(60));

  if (capturedRequests.length > 0) {
    const req = capturedRequests[0];
    console.log('\n📦 요청 데이터 (복사해서 사용):');
    console.log(JSON.stringify({
      headers: req.headers,
      body: req.body
    }, null, 2));
  } else {
    console.log('⚠️ 요청 캡처 안됨 (캐시된 데이터 사용 중일 수 있음)');

    // 일반내용 탭 클릭 후 다시 진행내용 탭 클릭
    console.log('\n🔄 탭 전환 시도...');
    await targetFrame.evaluate(() => {
      const tabs = document.querySelectorAll('[role="tab"], [class*="tab"] a');
      for (const tab of tabs) {
        if (tab.textContent?.trim() === '일반내용') {
          (tab as HTMLElement).click();
          return;
        }
      }
    });

    await new Promise(r => setTimeout(r, 2000));

    await targetFrame.evaluate(() => {
      const tabs = document.querySelectorAll('[role="tab"], [class*="tab"] a');
      for (const tab of tabs) {
        if (tab.textContent?.trim() === '진행내용') {
          (tab as HTMLElement).click();
          return;
        }
      }
    });

    await new Promise(r => setTimeout(r, 3000));
  }

  // 최종 캡처 결과
  if (capturedRequests.length > 0) {
    console.log('\n✅ 최종 캡처 성공!');
    console.log('요청 수:', capturedRequests.length);
  }

  console.log('\n브라우저를 30초간 열어둡니다...');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
}

main().catch(console.error);
