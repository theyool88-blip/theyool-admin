/**
 * SCOURT API 응답 필드 분석
 * 실제 API 응답에서 어떤 필드가 오는지 확인
 */

import { getScourtApiClient } from '../lib/scourt/api-client';

const testCases = [
  { court: '평택지원', year: '2024', type: '가단', serial: '75190', party: '홍강의', desc: '민사' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20475', party: '엄현식', desc: '가사' },
  { court: '천안지원', year: '2024', type: '고단', serial: '2703', party: '김현성', desc: '형사' },
  { court: '평택지원', year: '2024', type: '타채', serial: '33630', party: '김진성', desc: '집행' },
  { court: '대전지방법원', year: '2024', type: '개회', serial: '53142', party: '박재형', desc: '회생' },
];

async function analyzeFields() {
  const client = getScourtApiClient();

  for (const tc of testCases) {
    console.log('\n' + '='.repeat(70));
    console.log('📋 ' + tc.desc + ' (' + tc.type + ') - ' + tc.court + ' ' + tc.year + tc.type + tc.serial);
    console.log('='.repeat(70));

    try {
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: tc.year,
        csDvsCd: tc.type,
        csSerial: tc.serial,
        btprNm: tc.party,
      });

      if (result.success && result.generalData?.raw?.data?.dma_csBasCtt) {
        const caseInfo = result.generalData.raw.data.dma_csBasCtt;
        const fields = Object.keys(caseInfo).sort();

        console.log('\n총 ' + fields.length + '개 필드:');
        console.log('-'.repeat(70));

        // 값이 있는 필드만 출력
        fields.forEach(key => {
          const val = caseInfo[key];
          if (val !== null && val !== undefined && val !== '') {
            const valStr = typeof val === 'string' ? val.substring(0, 50) : val;
            console.log('  ' + key.padEnd(25) + ' = ' + valStr);
          }
        });

        // 누락 가능성 있는 필드 체크
        const expectedFields = [
          'aplRslt', 'aplyYmd', 'sendYmd', 'dcsnYmd', 'trnsfYmd', 'dspsYn', 'thrdDbtrNm',
          'strtDcsnYmd', 'dschgDcsnYmd', 'prcdAbndDcsnYmd', 'crtrObjDdlnYmd',
          'rmrk', 'note'
        ];
        const foundExpected = expectedFields.filter(f => fields.includes(f));
        const missing = expectedFields.filter(f => !fields.includes(f));

        if (foundExpected.length > 0) {
          console.log('\n✅ 추가 필드 발견: ' + foundExpected.join(', '));
        }
        if (missing.length > 0) {
          console.log('⚠️ 기대 필드 중 없는 것: ' + missing.join(', '));
        }
      }
    } catch (e) {
      console.log('❌ 에러: ' + e);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

analyzeFields().catch(console.error);
