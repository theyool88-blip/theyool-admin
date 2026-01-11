/**
 * SCOURT API 응답 필드 확인
 */
import { getScourtApiClient } from '../lib/scourt/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const apiClient = getScourtApiClient();

  // 2024드단531 사건 검색
  const result = await apiClient.searchAndRegisterCase({
    cortCd: '수원가정법원 평택지원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '531',
    btprNm: '장태일',
  });

  if (result.success && result.generalData?.raw) {
    const data = result.generalData.raw.data as Record<string, unknown>;
    console.log('\n=== API 응답 필드 목록 ===');
    console.log(Object.keys(data).join('\n'));

    // 당사자 정보
    console.log('\n=== 당사자 정보 (dlt_btprtCttLst) ===');
    const parties = (data.dlt_btprtCttLst || data.dlt_btprLst || []) as Record<string, unknown>[];
    if (parties.length > 0) {
      console.log('필드:', Object.keys(parties[0]).join(', '));
      console.log('데이터:', JSON.stringify(parties, null, 2));
    }

    // 대리인 정보 찾기
    console.log('\n=== 대리인 정보 찾기 ===');
    const possibleRepFields = Object.keys(data).filter(k =>
      k.includes('Atny') || k.includes('Lawy') || k.includes('agnt') ||
      k.includes('대리') || k.includes('Rep') || k.includes('prxy')
    );
    console.log('대리인 관련 필드:', possibleRepFields);

    // 모든 dlt_ 필드 출력
    console.log('\n=== dlt_ 필드 목록 ===');
    const dltFields = Object.keys(data).filter(k => k.startsWith('dlt_'));
    for (const field of dltFields) {
      const arr = data[field];
      if (Array.isArray(arr) && arr.length > 0) {
        console.log(`\n${field} (${arr.length}건):`);
        console.log('  필드:', Object.keys(arr[0]).join(', '));
        console.log('  첫번째:', JSON.stringify(arr[0]));
      }
    }
  } else {
    console.log('검색 실패:', result.error);
  }
}

main().catch(console.error);
