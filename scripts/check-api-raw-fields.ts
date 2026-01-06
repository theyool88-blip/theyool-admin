/**
 * SCOURT API 원본 응답에서 모든 필드 확인
 * 종국결과, 소가 관련 필드명 찾기
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function main() {
  console.log('=== SCOURT API 원본 응답 분석 ===\n');

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
    const result = await client.searchAndGetDetail(params);

    if (result.detailResult?.success) {
      const rawData = result.detailResult.data?.raw?.data;

      if (rawData) {
        console.log('\n=== dma_csBasCtt (기본정보) 모든 필드 ===\n');

        // 다양한 기본정보 객체 시도
        const possibleBaseCtt = [
          'dma_csBasCtt',
          'dma_csBsCtt',
          'dma_gnrlCtt',
          'dma_cvlcsCsGnrlCtt'
        ];

        for (const key of possibleBaseCtt) {
          if (rawData[key]) {
            console.log(`\n--- ${key} 필드들 ---`);
            Object.entries(rawData[key]).forEach(([k, v]) => {
              // 종국, 결과, 소가 관련 키워드 강조
              const keyLower = k.toLowerCase();
              const isImportant = keyLower.includes('ultmt') ||
                                  keyLower.includes('rslt') ||
                                  keyLower.includes('soga') ||
                                  keyLower.includes('sov') ||
                                  keyLower.includes('amt') ||
                                  keyLower.includes('prsrv') ||
                                  k.includes('소가') ||
                                  k.includes('결과');
              const prefix = isImportant ? '⭐ ' : '   ';
              if (v !== null && v !== undefined && v !== '') {
                console.log(prefix + k + ': ' + JSON.stringify(v));
              }
            });
          }
        }

        // 전체 응답의 키들
        console.log('\n=== 응답의 모든 최상위 키 ===');
        console.log(Object.keys(rawData).join(', '));
      }
    } else {
      console.log('상세 조회 실패:', result.detailResult?.error);
    }

  } catch (error) {
    console.error('에러:', error);
  }
}

main().catch(console.error);
