/**
 * API 호출 비교 디버깅
 * 성공/실패 케이스의 상세 API 요청/응답 비교
 */

const BASE_URL = 'https://www.scourt.go.kr';

// 세션 초기화
async function initSession() {
  console.log('=== 세션 초기화 ===');

  const response = await fetch(`${BASE_URL}/ssgo/ssgo100/selectHmpgSsgoCaptcha.on`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ dma_captcha: {} }),
  });

  const cookies = response.headers.get('set-cookie') || '';
  const wmonidMatch = cookies.match(/WMONID=([^;]+)/);
  const jsessionMatch = cookies.match(/JSESSIONID=([^;]+)/);

  const wmonid = wmonidMatch?.[1] || '';
  const jsessionId = jsessionMatch?.[1] || '';

  console.log(`WMONID: ${wmonid.substring(0, 20)}...`);
  console.log(`JSESSIONID: ${jsessionId.substring(0, 20)}...`);

  return { wmonid, jsessionId };
}

// 검색 API 호출
async function searchCase(session: { wmonid: string; jsessionId: string }, params: {
  cortCd: string;
  csYr: string;
  csDvsCd: string;
  csSerial: string;
  btprNm: string;
}) {
  console.log(`\n=== 검색: ${params.csYr}${params.csDvsCd}${params.csSerial} ===`);

  const requestBody = {
    dma_search: {
      cortCd: params.cortCd,
      csYear: params.csYr,
      csDvsCd: params.csDvsCd,
      csSerial: params.csSerial,
      btprtNm: params.btprNm,
      captchaAnswer: '',
      mode: '',
      csDvsNm: params.csDvsCd,
      progCttDvs: '0',
      srchDvs: '',
    },
  };

  const response = await fetch(`${BASE_URL}/ssgo/ssgo100/selectHmpgCsSrchRsltLst.on`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      'Cookie': `WMONID=${session.wmonid}; JSESSIONID=${session.jsessionId}`,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (data.errors || data.error) {
    console.log('❌ 검색 실패:', data.errors?.errorMessage || data.error);
    return null;
  }

  const results = data.data?.dlt_csSrchRslt || [];
  if (results.length === 0) {
    console.log('❌ 검색 결과 없음');
    return null;
  }

  const result = results[0];
  console.log('✅ encCsNo 획득:', result.encCsNo?.substring(0, 30) + '...');
  console.log('   cortCd:', result.cortCd);
  console.log('   csNo:', result.csNo);
  console.log('   csNm:', result.csNm);

  return {
    encCsNo: result.encCsNo,
    cortCd: result.cortCd,
    csNo: result.csNo,
    csDvsCd: result.csDvsCd || params.csDvsCd,
  };
}

// 상세 API 호출 (다양한 엔드포인트 테스트)
async function testDetailEndpoints(
  session: { wmonid: string; jsessionId: string },
  searchResult: { encCsNo: string; cortCd: string; csNo: string; csDvsCd: string },
  params: { csYr: string; csDvsCd: string; csSerial: string; btprNm: string }
) {
  console.log('\n=== 상세조회 엔드포인트 테스트 ===');

  const endpoints = [
    { name: 'ssgo101 (민사)', path: '/ssgo/ssgo101/selectHmpgCvlcsCsGnrlCtt.on' },
    { name: 'ssgo103 (비송도산)', path: '/ssgo/ssgo103/selectHmpgDsnCsGnrlCtt.on' },
    { name: 'ssgo104 (집행)', path: '/ssgo/ssgo104/selectHmpgExcnCsGnrlCtt.on' },
    { name: 'ssgo105 (신청)', path: '/ssgo/ssgo105/selectHmpgAplyCsGnrlCtt.on' },
    { name: 'ssgo106 (독촉)', path: '/ssgo/ssgo106/selectHmpgDccsCsGnrlCtt.on' },
  ];

  // csNo 파싱
  const csYear = searchResult.csNo.substring(0, 4);
  const csDvsCode = searchResult.csNo.substring(4, 7);
  const csSerialPadded = searchResult.csNo.substring(7);

  const requestBody = {
    dma_search: {
      cortCd: searchResult.cortCd,
      csNo: searchResult.csNo,
      encCsNo: searchResult.encCsNo,
      csYear: csYear,
      csDvsCd: csDvsCode,
      csSerial: csSerialPadded,
      btprtNm: params.btprNm,
      captchaAnswer: '',
      csDvsNm: params.csDvsCd,
      progCttDvs: '0',
      srchDvs: '',
    },
  };

  console.log('요청 본문:', JSON.stringify(requestBody, null, 2));

  for (const ep of endpoints) {
    console.log(`\n[${ep.name}]`);

    try {
      const response = await fetch(`${BASE_URL}${ep.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'Cookie': `WMONID=${session.wmonid}; JSESSIONID=${session.jsessionId}`,
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.errors?.errorMessage) {
        console.log(`  ❌ 에러: ${data.errors.errorMessage}`);
      } else if (data.error) {
        console.log(`  ❌ 에러: ${data.error}`);
      } else if (data.data?.dma_csBasCtt) {
        console.log('  ✅ 성공!');
        console.log('  사건명:', data.data.dma_csBasCtt.csNm);
        console.log('  법원:', data.data.dma_csBasCtt.cortNm);
        console.log('  필드수:', Object.keys(data.data.dma_csBasCtt).length);
      } else {
        console.log('  ⚠️ 응답 구조 확인 필요');
        console.log('  응답:', JSON.stringify(data).substring(0, 300));
      }
    } catch (error) {
      console.log(`  ❌ 네트워크 에러: ${error}`);
    }

    // API 호출 간격
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function main() {
  // 테스트 케이스
  const testCases = [
    // 성공 예상: 민사
    { cortCd: '000520', csYr: '2025', csDvsCd: '가단', csSerial: '55158', btprNm: '이명규', desc: '민사 (성공 예상)' },

    // 실패 중: 차전
    { cortCd: '000555', csYr: '2025', csDvsCd: '차전', csSerial: '2850', btprNm: '임승태', desc: '차전 (실패 중)' },

    // 실패 중: 개회
    { cortCd: '000111', csYr: '2024', csDvsCd: '개회', csSerial: '53142', btprNm: '박재형', desc: '개인회생 (실패 중)' },
  ];

  for (const tc of testCases) {
    console.log('\n' + '='.repeat(60));
    console.log(`테스트: ${tc.desc}`);
    console.log('='.repeat(60));

    // 각 테스트마다 새 세션
    const session = await initSession();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const searchResult = await searchCase(session, tc);

    if (searchResult) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await testDetailEndpoints(session, searchResult, tc);
    }

    // 테스트 간격
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

main().catch(console.error);
