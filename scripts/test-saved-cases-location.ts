/**
 * 저장된 사건 목록이 어디에 저장되는지 검증
 *
 * 질문: WMONID가 같으면 저장된 사건 목록도 같이 보이나?
 *
 * 테스트:
 * 1. API로 "저장된 사건 목록 조회" 엔드포인트가 있는지 확인
 * 2. WMONID만으로 저장된 사건을 서버에서 조회 가능한지
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// 브라우저에서 추출한 WMONID (저장된 사건이 있는 것)
const BROWSER_WMONID = 'gJ99-qJO04s';

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 저장된 사건 목록 저장 위치 검증');
  console.log('='.repeat(60));

  // 1. 브라우저 WMONID로 세션 생성
  console.log('\n[Test 1] 브라우저 WMONID로 세션 생성...');
  console.log(`WMONID: ${BROWSER_WMONID}`);

  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: { 'Cookie': `WMONID=${BROWSER_WMONID}` },
  });

  const setCookie = initResponse.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);
  const jsessionId = jsessionMatch?.[1];

  console.log(`JSESSIONID: ${jsessionId?.substring(0, 20)}...`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${BROWSER_WMONID}; JSESSIONID=${jsessionId}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 2. 검색 API에 빈 검색어로 호출 (저장된 목록만 조회 시도)
  console.log('\n[Test 2] 빈 검색으로 저장된 목록 조회 시도...');

  const emptySearchRes = await fetch('https://ssgo.scourt.go.kr/ssgo/ssgo10l/selectHmpgMain.on', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dma_search: {
        cortCd: '',
        cdScope: 'ALL',
        csNoHistLst: '',  // 빈 값
        csDvsCd: '',
        csYr: '',
        csSerial: '',
        btprNm: '',
        answer: '',
        fullCsNo: '',
      },
    }),
  });

  const emptySearchData = await emptySearchRes.json();
  console.log('응답:', JSON.stringify(emptySearchData, null, 2).substring(0, 500));

  // 3. 저장된 사건 목록 조회 전용 API 탐색
  console.log('\n[Test 3] 저장 목록 전용 API 탐색...');

  // 가능한 엔드포인트들 시도
  const endpoints = [
    '/ssgo/ssgo10l/selectCsSrchHistList.on',
    '/ssgo/ssgo10l/selectMyCaseList.on',
    '/ssgo/ssgo10l/getSavedCases.on',
    '/ssgo/ssgo102/selectCsSrchHistList.on',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`https://ssgo.scourt.go.kr${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      console.log(`${endpoint}: ${res.status} - ${JSON.stringify(data).substring(0, 100)}`);
    } catch (e) {
      console.log(`${endpoint}: Error - ${e}`);
    }
  }

  // 4. 메인 페이지 HTML에서 초기 데이터 확인
  console.log('\n[Test 4] 메인 페이지 초기 데이터 확인...');

  const mainPageRes = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: {
      'Cookie': `WMONID=${BROWSER_WMONID}; JSESSIONID=${jsessionId}`,
      'Accept': 'text/html',
    },
  });

  const mainPageHtml = await mainPageRes.text();

  // localStorage 관련 코드 찾기
  const localStorageMatch = mainPageHtml.match(/localStorage\.[sg]et[^;]{0,200}/g);
  console.log('localStorage 사용:', localStorageMatch?.slice(0, 3) || 'Not found');

  // dlt_csSrchHistList 관련 코드 찾기
  const histListMatch = mainPageHtml.match(/csSrchHistList[^;]{0,100}/g);
  console.log('csSrchHistList 관련:', histListMatch?.slice(0, 3) || 'Not found');

  // 결론
  console.log('\n' + '='.repeat(60));
  console.log('📋 분석');
  console.log('='.repeat(60));
  console.log('저장된 사건 목록 저장 위치:');
  console.log('  - 서버(WMONID): API로 조회 가능한지 확인 필요');
  console.log('  - 클라이언트(localStorage): 브라우저에만 저장');
  console.log('');
  console.log('만약 localStorage 기반이라면:');
  console.log('  - 50건 제한은 클라이언트 측 제한');
  console.log('  - WMONID당 서버 제한은 없을 수 있음');
  console.log('  - csNoHistLst는 클라이언트에서 보내는 것');
  console.log('='.repeat(60));
}

main().catch(console.error);
