/**
 * 검색 API 응답 필드 확인
 * - 검색 결과에서 법원코드(cortCd)가 어떤 형식으로 오는지 확인
 */
import { getScourtApiClient } from '../lib/scourt/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const apiClient = getScourtApiClient();

  // 형사사건 검색
  console.log('=== 형사사건 검색 ===');
  const result = await (apiClient as any).searchWithCaptcha({
    cortCd: '대전지방법원 천안지원',
    csYr: '2024',
    csDvsCd: '고단',
    csSerial: '2703',
    btprNm: '김',
  });

  if (result.success && result.data?.data) {
    const csList = result.data.data.dlt_csNoHistLst || [];
    if (csList.length > 0) {
      console.log('\n📍 dlt_csNoHistLst[0] 필드:');
      console.log(JSON.stringify(csList[0], null, 2));
    }
  } else {
    console.log('❌ 검색 실패:', result.error);
  }
}

main().catch(console.error);
