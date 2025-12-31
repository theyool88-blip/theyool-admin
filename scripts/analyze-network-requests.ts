/**
 * 나의사건검색 네트워크 요청 분석
 * 실제 검색 시 어떤 API 호출이 발생하는지 캡처
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface NetworkRequest {
  url: string;
  method: string;
  postData?: string;
  headers: Record<string, string>;
  resourceType: string;
}

async function analyzeNetworkRequests() {
  console.log('🔍 네트워크 요청 분석 시작...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const requests: NetworkRequest[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 모든 네트워크 요청 캡처
    page.on('request', (request) => {
      const url = request.url();
      // ssgo.scourt.go.kr 관련 요청만 캡처
      if (url.includes('ssgo.scourt.go.kr') && !url.includes('.css') && !url.includes('.png') && !url.includes('.jpg')) {
        requests.push({
          url: url,
          method: request.method(),
          postData: request.postData(),
          headers: request.headers(),
          resourceType: request.resourceType()
        });
      }
    });

    console.log('📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    // iframe 찾기
    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) {
      throw new Error('iframe을 찾을 수 없습니다');
    }

    console.log('✓ iframe 발견:', targetFrame.url());
    console.log('\n📋 검색 전 요청 수:', requests.length);

    // 법원 선택
    console.log('\n🔧 법원 선택...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '수원가정법원');
    await new Promise(r => setTimeout(r, 2000));

    // 사건 정보 입력
    console.log('🔧 사건 정보 입력...');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김윤한');

    // 캡챠 필드에 테스트 값 입력 (실제로는 틀린 값)
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', 'TEST123');

    console.log('✓ 입력 완료\n');

    const requestsBeforeSearch = requests.length;
    console.log('📋 검색 버튼 클릭 전 요청 수:', requestsBeforeSearch);

    // 검색 버튼 클릭
    console.log('\n🔎 검색 버튼 클릭...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

    // 응답 대기
    await new Promise(r => setTimeout(r, 5000));

    console.log('📋 검색 버튼 클릭 후 요청 수:', requests.length);
    console.log('📋 새로운 요청 수:', requests.length - requestsBeforeSearch);

    // 결과 저장
    const outputDir = path.join(process.cwd(), 'temp', 'network-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 모든 요청 분석
    console.log('\n' + '='.repeat(70));
    console.log('📊 캡처된 모든 네트워크 요청');
    console.log('='.repeat(70));

    const apiRequests = requests.filter(r =>
      r.resourceType === 'xhr' ||
      r.resourceType === 'fetch' ||
      r.url.includes('.json') ||
      r.url.includes('.do') ||
      r.url.includes('.on') ||
      r.method === 'POST'
    );

    console.log(`\n🔹 API/XHR 요청 (${apiRequests.length}건):\n`);

    apiRequests.forEach((req, idx) => {
      console.log(`[${idx + 1}] ${req.method} ${req.url}`);
      if (req.postData) {
        console.log(`    POST 데이터: ${req.postData.substring(0, 200)}...`);
      }
      console.log();
    });

    // 결과 저장
    fs.writeFileSync(
      path.join(outputDir, 'all-requests.json'),
      JSON.stringify(requests, null, 2)
    );

    fs.writeFileSync(
      path.join(outputDir, 'api-requests.json'),
      JSON.stringify(apiRequests, null, 2)
    );

    console.log('\n✓ 결과 저장 완료:');
    console.log('  - temp/network-analysis/all-requests.json');
    console.log('  - temp/network-analysis/api-requests.json');

    // 스크린샷
    await page.screenshot({
      path: path.join(outputDir, 'after-search.png'),
      fullPage: true
    });

    console.log('\n브라우저를 30초간 열어둡니다. Network 탭을 직접 확인하세요...');
    await new Promise(r => setTimeout(r, 30000));

  } finally {
    await browser.close();
  }

  return requests;
}

analyzeNetworkRequests()
  .then((requests) => {
    console.log(`\n✅ 완료 - 총 ${requests.length}개 요청 캡처됨`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
