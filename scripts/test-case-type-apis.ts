/**
 * 다른 사건 유형 API 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BROWSER_WMONID = 'gJ99-qJO04s';

async function test() {
  // 세션 생성
  const init = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: { 'Cookie': `WMONID=${BROWSER_WMONID}` }
  });
  const cookie = init.headers.get('set-cookie');
  const jsession = cookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${BROWSER_WMONID}; JSESSIONID=${jsession}`,
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
  };

  // 형사 사건으로 테스트 (2023노2410)
  const encCsNo = 'kMQhgOsZ3OtaWu1oONT8mIkZxb6vr8wYq0jZgVOUEO/a5E951qGMRorRE5i4Lj16';

  console.log('=== 형사 사건 (2023노2410) API 테스트 ===\n');

  // 형사 상세 조회 API
  const endpoints = [
    { name: '형사', url: '/ssgo/ssgo103/selectHmpgCrmCsGnrlCtt.on' },
  ];

  for (const ep of endpoints) {
    const res = await fetch(`https://ssgo.scourt.go.kr${ep.url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dma_search: {
          cortCd: '000079',  // 수원지방법원
          csNo: '',
          encCsNo: encCsNo,
          csYear: '2023',
          csDvsCd: '110',    // 형사
          csSerial: '2410',
          btprtNm: '',
          captchaAnswer: '',
        },
      }),
    });
    const data = await res.json();

    if (data.errors) {
      console.log(`${ep.name}: ❌ ${data.errors.errorMessage}`);
    } else if (data.data) {
      const caseName = data.data.dma_csBasCtt?.csNm || data.data.dma_gnrlCtt?.csNm || '성공';
      console.log(`${ep.name}: ✅ 성공! 사건명: ${caseName}`);
    } else {
      console.log(`${ep.name}: ⚠️ 응답 형식 이상`);
    }
  }
}

test().catch(console.error);
