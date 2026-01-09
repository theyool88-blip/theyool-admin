/**
 * 미확인 사건유형 필드 수집 스크립트
 * 전자소송포털에서 확인한 사건들의 API 필드 수집
 */

import { getScourtApiClient } from '../lib/scourt/api-client';

const testCases = [
  // 미확인 사건유형들
  { court: '청주지법', year: '2025', type: '머', serial: '51837', party: '박선희', category: 'civil', desc: '민사조정' },
  { court: '울진군법원', year: '2025', type: '가소', serial: '10226', party: '윤종철', category: 'civil', desc: '민사소액' },
  { court: '대구가정법원', year: '2025', type: '즈기', serial: '1699', party: '길정희', category: 'family', desc: '가사신청' },
  { court: '평택지원', year: '2025', type: '카기', serial: '10680', party: '이명규', category: 'application', desc: '기타신청' },
  { court: '대구가정법원 안동지원', year: '2025', type: '느단', serial: '1228', party: '김종률', category: 'family', desc: '가사비송' },
];

async function collectFields() {
  const client = getScourtApiClient();

  console.log('='.repeat(80));
  console.log('미확인 사건유형 필드 수집');
  console.log('='.repeat(80));

  for (const tc of testCases) {
    console.log(`\n[${ tc.desc }] ${tc.court} ${tc.year}${tc.type}${tc.serial}`);
    console.log('-'.repeat(60));

    try {
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: tc.year,
        csDvsCd: tc.type,
        csSerial: tc.serial,
        btprNm: tc.party,
      });

      if (result.success && result.generalData?.raw?.data) {
        const data = result.generalData.raw.data;
        const caseInfo = data.dma_csBasCtt || {};

        // 값이 있는 필드만 출력
        const fields = Object.keys(caseInfo).sort();
        console.log(`\n총 ${fields.length}개 필드:`);

        fields.forEach(key => {
          const val = caseInfo[key];
          if (val !== null && val !== undefined && val !== '') {
            const valStr = typeof val === 'string'
              ? (val.length > 50 ? val.substring(0, 50) + '...' : val)
              : String(val);
            console.log(`  ${key.padEnd(25)} = ${valStr}`);
          }
        });

        // LIST 필드 확인
        const listFields = Object.keys(data).filter(k => k.startsWith('dlt_') || k.startsWith('dma_'));
        console.log(`\nLIST 필드: ${listFields.join(', ')}`);

        console.log(`\n✅ ${tc.type} (${tc.desc}) 수집 완료`);
      } else {
        console.log(`❌ 실패: ${result.error || 'unknown'}`);
      }
    } catch (e) {
      console.log(`❌ 에러: ${e}`);
    }

    // API 호출 간격
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('수집 완료');
}

collectFields().catch(console.error);
