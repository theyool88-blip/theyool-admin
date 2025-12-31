/**
 * 법원/사건유형 코드 매핑 테스트
 * 다양한 코드 형식으로 API 호출하여 어떤 것이 작동하는지 확인
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = 'https://ssgo.scourt.go.kr';

interface TestCase {
  name: string;
  cortCd: string;
  csDvsCd: string;
}

async function getSession(): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/ssgo/index.on?cortId=www`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  const setCookie = response.headers.get('set-cookie');
  const match = setCookie?.match(/JSESSIONID=([^;]+)/);
  return match ? match[1] : null;
}

async function testSearch(sessionId: string, testCase: TestCase): Promise<any> {
  const response = await fetch(`${BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Cookie': `JSESSIONID=${sessionId}`,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
      'Accept': 'application/json',
      'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: testCase.cortCd,
        cdScope: 'ALL',
        csNoHistLst: '',
        csDvsCd: testCase.csDvsCd,
        csYr: '2024',
        csSerial: '26718',
        btprNm: '김윤한',
        answer: 'TEST', // 캡챠 없이 구조만 확인
        fullCsNo: '',
      },
    }),
  });

  return response.json();
}

async function main() {
  console.log('🧪 코드 매핑 테스트\n');

  // 세션 획득
  const sessionId = await getSession();
  if (!sessionId) {
    console.log('❌ 세션 획득 실패');
    return;
  }
  console.log('✅ 세션 획득:', sessionId.substring(0, 20) + '...\n');

  // 테스트 케이스
  const testCases: TestCase[] = [
    // 법원 코드 테스트
    { name: '법원: 수원가정법원 (이름)', cortCd: '수원가정법원', csDvsCd: '드단' },
    { name: '법원: 000302 (숫자코드)', cortCd: '000302', csDvsCd: '드단' },

    // 사건유형 코드 테스트
    { name: '사건유형: 드단 (이름)', cortCd: '수원가정법원', csDvsCd: '드단' },
    { name: '사건유형: ks (case-ing)', cortCd: '수원가정법원', csDvsCd: 'ks' },
    { name: '사건유형: 150 (내부코드)', cortCd: '수원가정법원', csDvsCd: '150' },

    // 조합 테스트
    { name: '조합: 000302 + 150', cortCd: '000302', csDvsCd: '150' },
    { name: '조합: 000302 + ks', cortCd: '000302', csDvsCd: 'ks' },
  ];

  console.log('='.repeat(70));

  for (const tc of testCases) {
    console.log(`\n테스트: ${tc.name}`);
    console.log(`  cortCd: ${tc.cortCd}, csDvsCd: ${tc.csDvsCd}`);

    try {
      const result = await testSearch(sessionId, tc);

      // 응답 분석
      const status = result.status;
      const message = result.message || '';
      const hasData = result.data && Object.keys(result.data).length > 0;
      const error = result.errors;

      console.log(`  결과: status=${status}, hasData=${hasData}`);
      if (message) console.log(`  메시지: ${message.substring(0, 50)}`);
      if (error) console.log(`  에러: ${JSON.stringify(error)}`);

    } catch (e) {
      console.log(`  ❌ 에러: ${e}`);
    }

    // Rate limit 방지
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ 테스트 완료');
}

main().catch(console.error);
