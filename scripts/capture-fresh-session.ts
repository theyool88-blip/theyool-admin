/**
 * 새 세션에서 진행내용 API 요청 캡처
 */
import puppeteer from 'puppeteer';

async function main() {
  console.log('🚀 새 브라우저 세션 시작 (시크릿 모드)...');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--incognito']
  });

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // 네트워크 요청 캡처
  await page.setRequestInterception(true);

  page.on('request', async (req) => {
    const url = req.url();

    // 진행내용 API 요청 캡처
    if (url.includes('selectHmpgFmlyCsProgCtt')) {
      console.log('\n' + '='.repeat(70));
      console.log('🎯 진행내용 API 요청 캡처됨!');
      console.log('='.repeat(70));

      const headers = req.headers();
      const body = req.postData();

      console.log('\n📤 요청 헤더:');
      Object.entries(headers).forEach(([k, v]) => {
        if (!['accept-language', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
              'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'upgrade-insecure-requests'].includes(k)) {
          console.log(`  ${k}: ${v}`);
        }
      });

      console.log('\n📦 요청 바디:');
      try {
        const parsed = JSON.parse(body || '{}');
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log(body);
      }
    }

    req.continue();
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('selectHmpgFmlyCsProgCtt')) {
      console.log('\n📥 진행내용 API 응답:', res.status());
      try {
        const json = await res.json();
        if (json.data) {
          const progList = json.data.dlt_csProgCttLst || [];
          console.log('✅ 성공! 진행내용:', progList.length, '건');
          if (progList.length > 0) {
            console.log('첫 5건:');
            progList.slice(0, 5).forEach((p: any, i: number) => {
              console.log(`  ${i+1}. ${p.progDt || p.prgrYmd} - ${p.progCtt || p.prgrCtt}`);
            });
          }
        } else if (json.errors) {
          console.log('❌ 에러:', json.errors.errorMessage);
        }
      } catch (e) {
        console.log('응답 파싱 실패');
      }
    }
  });

  page.on('dialog', async dialog => await dialog.accept());

  // 직접 SCOURT 페이지로 이동
  console.log('\n📍 SCOURT 페이지로 이동...');
  await page.goto('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 3000));

  // 저장 결과 체크박스 체크
  console.log('\n📋 검색 폼 입력...');

  await page.evaluate(() => {
    const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
    if (cb && !cb.checked) cb.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // 법원 선택
  await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원 평택지원');
  await new Promise(r => setTimeout(r, 2000));

  // 연도, 사건유형
  await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2025');
  await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');

  // 사건번호
  await page.click('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial');
  await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '20513');

  // 당사자명
  await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '권');

  console.log('✅ 폼 입력 완료');
  console.log('\n⚠️ 브라우저에서 캡챠를 입력하고 검색 버튼을 클릭하세요!');
  console.log('   검색 후 사건을 클릭하고 진행내용 탭을 클릭하면 요청이 캡처됩니다.');

  // 브라우저 열어두기
  console.log('\n브라우저를 2분간 열어둡니다...');
  await new Promise(r => setTimeout(r, 120000));

  await browser.close();
}

main().catch(console.error);
