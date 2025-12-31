/**
 * 사건 상세 정보 API 캡처
 * 검색 성공 후 사건 클릭 시 호출되는 API를 캡처
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

interface NetworkRequest {
  url: string;
  method: string;
  postData?: string;
  timestamp: number;
  type: string;
}

async function captureDetailApi() {
  console.log('🔍 사건 상세 API 캡처 시작...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const requests: NetworkRequest[] = [];
  const responses: Map<string, any> = new Map();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 네트워크 요청/응답 캡처
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('ssgo.scourt.go.kr') && url.includes('.on')) {
        requests.push({
          url,
          method: request.method(),
          postData: request.postData(),
          timestamp: Date.now(),
          type: request.resourceType(),
        });
        console.log(`📤 ${request.method()} ${url.split('/').pop()}`);
        if (request.postData()) {
          console.log(`   Body: ${request.postData()?.substring(0, 150)}...`);
        }
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('ssgo.scourt.go.kr') && url.includes('.on')) {
        try {
          const text = await response.text();
          responses.set(url, text);
          console.log(`📥 ${response.status()} ${url.split('/').pop()}`);
          if (text.length < 500) {
            console.log(`   Response: ${text.substring(0, 200)}`);
          }
        } catch (e) {
          // 무시
        }
      }
    });

    // Alert 처리
    page.on('dialog', async (dialog) => {
      console.log(`⚠️ Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    console.log('📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await new Promise((r) => setTimeout(r, 10000));

    const targetFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe을 찾을 수 없습니다');

    console.log('✅ iframe 발견\n');

    // 검색 조건 입력
    console.log('🔧 검색 조건 입력...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise((r) => setTimeout(r, 2000));

    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    // 캡챠 해결 (최대 5회 재시도)
    let searchSuccess = false;
    const solver = getVisionCaptchaSolver();

    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`\n🔐 캡챠 시도 ${attempt}/5...`);

      // 캡챠 입력 필드 초기화
      await targetFrame.evaluate(() => {
        const input = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer') as HTMLInputElement;
        if (input) input.value = '';
      });

      // 캡챠 이미지 캡처
      const captchaImg = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      if (!captchaImg) {
        console.log('  ❌ 캡챠 이미지를 찾을 수 없습니다');
        continue;
      }

      const screenshot = await captchaImg.screenshot();
      const result = await solver.solveCaptcha(screenshot);
      console.log(`  인식: "${result.text}" (신뢰도: ${((result.confidence || 0) * 100).toFixed(0)}%)`);

      if (!result.text || result.text.length > 6) {
        console.log('  ⚠️ 인식 결과가 이상함, 캡챠 새로고침...');
        await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

      // 검색 실행
      console.log('  🔎 검색 버튼 클릭...');
      await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
      await new Promise((r) => setTimeout(r, 5000));

      // 결과 확인
      const hasResults = await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const rows = tbody?.querySelectorAll('tr');
        return rows && rows.length > 0 && rows[0].textContent?.trim() !== '';
      });

      if (hasResults) {
        console.log('  ✅ 검색 성공!');
        searchSuccess = true;
        break;
      } else {
        console.log('  ❌ 검색 실패 (캡챠 오류 가능)');
        // 페이지 새로고침으로 새 캡챠 로드
        if (attempt < 5) {
          console.log('  🔄 페이지 새로고침...');
          await page.reload({ waitUntil: 'domcontentloaded' });
          await new Promise((r) => setTimeout(r, 10000));

          // iframe 다시 찾기
          const newFrame = page.frames().find((f) => f.url().includes('ssgo.scourt.go.kr'));
          if (newFrame) {
            // 검색 조건 다시 입력
            await newFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
            await new Promise((r) => setTimeout(r, 2000));
            await newFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
            await newFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
            await newFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
            await newFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');
          }
        }
      }
    }

    if (!searchSuccess) {
      console.log('\n❌ 5회 시도 후 검색 실패. 브라우저를 열어두니 수동으로 시도해주세요...');
      await new Promise((r) => setTimeout(r, 120000));
      return;
    }

    // 검색 결과 정보 출력
    const resultInfo = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      if (!rows || rows.length === 0) return null;

      const firstRow = rows[0];
      const cells = firstRow.querySelectorAll('td');
      return {
        count: rows.length,
        firstRow: Array.from(cells).map((c) => c.textContent?.trim()),
      };
    });

    console.log('\n📋 검색 결과:', resultInfo);

    // 요청 배열 초기화 (상세 API만 캡처하기 위해)
    requests.length = 0;
    console.log('\n' + '='.repeat(60));
    console.log('🖱️ 첫 번째 사건 클릭...');
    console.log('='.repeat(60) + '\n');

    // 사건 클릭
    await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const firstRow = tbody?.querySelector('tr') as HTMLElement;
      if (firstRow) {
        firstRow.click();
      }
    });

    // 응답 대기
    await new Promise((r) => setTimeout(r, 8000));

    // 상세 정보 탭/영역 확인
    const detailTabs = await targetFrame.evaluate(() => {
      // 탭 메뉴 확인
      const tabs = document.querySelectorAll('[class*="tab"], [id*="tab"]');
      // 상세 정보 테이블 확인
      const tables = document.querySelectorAll('table');

      return {
        tabCount: tabs.length,
        tableCount: tables.length,
        tabTexts: Array.from(tabs).slice(0, 5).map((t) => t.textContent?.trim().substring(0, 30)),
      };
    });

    console.log('\n📊 상세 화면 구조:', detailTabs);

    // 결과 저장
    const outputDir = path.join(process.cwd(), 'temp', 'detail-api-capture');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // API 요청 저장
    const apiRequests = requests.filter((r) => r.url.includes('.on'));
    fs.writeFileSync(
      path.join(outputDir, 'detail-api-requests.json'),
      JSON.stringify(apiRequests, null, 2)
    );

    // 스크린샷
    await page.screenshot({
      path: path.join(outputDir, 'detail-page.png'),
      fullPage: true,
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 캡처된 상세 API 요청');
    console.log('='.repeat(60));

    apiRequests.forEach((req, idx) => {
      console.log(`\n[${idx + 1}] ${req.method} ${req.url}`);
      if (req.postData) {
        try {
          const parsed = JSON.parse(req.postData);
          console.log('    Body:', JSON.stringify(parsed, null, 2).substring(0, 500));
        } catch {
          console.log('    Body:', req.postData.substring(0, 300));
        }
      }
    });

    console.log('\n✅ 결과 저장: temp/detail-api-capture/');

    // 브라우저 유지
    console.log('\n브라우저를 60초간 열어둡니다. 상세 화면을 확인하세요...');
    await new Promise((r) => setTimeout(r, 60000));

  } finally {
    await browser.close();
  }
}

captureDetailApi()
  .then(() => {
    console.log('\n✅ 캡처 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
