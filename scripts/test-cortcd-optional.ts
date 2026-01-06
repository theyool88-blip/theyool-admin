/**
 * 상세 API에서 cortCd가 필수인지 테스트
 * - 잘못된 cortCd로 호출해도 encCsNo가 있으면 동작하는지 확인
 */
import { getScourtApiClient } from '../lib/scourt/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const apiClient = getScourtApiClient() as any;

  console.log('=== cortCd 필수 여부 테스트 ===\n');

  // 1. 검색으로 encCsNo 획득
  console.log('📍 Step 1: 형사사건 검색');
  const searchResult = await apiClient.searchWithCaptcha({
    cortCd: '대전지방법원 천안지원',
    csYr: '2024',
    csDvsCd: '고단',
    csSerial: '2703',
    btprNm: '김',
  });

  if (!searchResult.success || !searchResult.encCsNo) {
    console.log('❌ 검색 실패');
    return;
  }

  console.log(`✅ encCsNo 획득: ${searchResult.encCsNo.substring(0, 30)}...`);

  const wmonid = apiClient.getWmonid();
  const jsessionId = apiClient.session?.jsessionId;
  const baseUrl = 'https://ssgo.scourt.go.kr';
  const endpoint = '/ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsGnrlCtt.on';

  // 2. 다양한 cortCd로 상세 조회 테스트
  const testCases = [
    { name: '올바른 코드 (000283)', cortCd: '000283' },
    { name: '잘못된 코드 (000305)', cortCd: '000305' },
    { name: '빈 문자열', cortCd: '' },
    { name: '한글 법원명', cortCd: '대전지방법원 천안지원' },
  ];

  for (const test of testCases) {
    console.log(`\n📤 테스트: ${test.name} (cortCd: "${test.cortCd}")`);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
          'Origin': 'https://ssgo.scourt.go.kr',
          'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
        },
        body: JSON.stringify({
          dma_search: {
            cortCd: test.cortCd,
            csNo: '',
            encCsNo: searchResult.encCsNo,
            csYear: '2024',
            csDvsCd: '077',
            csSerial: '2703',
            btprtNm: '',
            captchaAnswer: '',
          },
        }),
      });

      const data = await response.json();

      if (data.data && !data.errors) {
        console.log(`  ✅ 성공! 사건명: ${data.data.dma_csBasCtt?.csNm || '알 수 없음'}`);
      } else {
        console.log(`  ❌ 실패: ${data.errors?.errorMessage || JSON.stringify(data).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`  ❌ 에러: ${e}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
