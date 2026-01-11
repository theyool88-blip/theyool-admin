/**
 * SCOURT API 응답에서 종국결과 필드 확인
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function main() {
  console.log('=== SCOURT API 응답 확인 ===\n');

  const client = getScourtApiClient();

  // 2025가소73623 수원지방법원 평택지원
  const params = {
    cortCd: '수원지방법원 평택지원',
    csYr: '2025',
    csDvsCd: '가소',
    csSerial: '73623',
    btprNm: '조',
  };

  console.log('검색 파라미터:', params);

  try {
    const result = await client.searchAndGetGeneral(params);

    if (result.generalResult?.success) {
      const rawData = result.generalResult.data?.raw?.data as Record<string, unknown> | undefined;

      if (rawData) {
        console.log('\n=== API 응답의 모든 필드 ===');

        // dma_csBasCtt (기본정보) 확인
        const caseInfo = (rawData.dma_csBasCtt || rawData.dma_csBsCtt || rawData.dma_gnrlCtt || rawData) as Record<string, unknown>;

        console.log('\n[기본정보 필드]');
        const allKeys = Object.keys(caseInfo);
        allKeys.forEach(key => {
          const value = caseInfo[key];
          if (value !== null && value !== undefined && value !== '') {
            // 종국, 결과 관련 필드 강조
            const isImportant = key.toLowerCase().includes('ultmt') ||
                               key.toLowerCase().includes('rslt') ||
                               key.toLowerCase().includes('result') ||
                               key.toLowerCase().includes('cfmt') ||
                               key.toLowerCase().includes('end');
            const prefix = isImportant ? '⭐ ' : '   ';
            console.log(`${prefix}${key}: ${JSON.stringify(value)}`);
          }
        });
      }
    } else {
      console.log('일반내용 조회 실패:', result.generalResult?.error);
    }

  } catch (error) {
    console.error('에러:', error);
  }
}

main().catch(console.error);
