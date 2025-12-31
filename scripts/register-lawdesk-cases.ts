/**
 * 로데스크에서 추출한 사건을 대법원 나의사건검색에 등록
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

// 로데스크에서 추출한 사건 목록
const lawdeskCases = [
  { court: '천안가정', year: '2024', type: '드단', serial: '16575', party: '이진산' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20538', party: '김근령' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20540', party: '한영미' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10057', party: '한영미' },
  { court: '안성시법원', year: '2025', type: '가소', serial: '6582', party: '임승태' },
  { court: '청주지법', year: '2025', type: '가단', serial: '55301', party: '최하윤' },
  { court: '평택지원', year: '2025', type: '카기', serial: '10680', party: '이명규' },
  { court: '수원고법', year: '2025', type: '르', serial: '10717', party: '장원석' },
  { court: '수원고법', year: '2025', type: '르', serial: '10433', party: '조유경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20908', party: '조주성' },
  { court: '평택지원', year: '2025', type: '가단', serial: '55158', party: '이명규' },
  { court: '평택가정', year: '2025', type: '드단', serial: '61', party: '이미옥' },
  { court: '천안지원', year: '2025', type: '카불', serial: '6034', party: '강호현' },
  { court: '평택지원', year: '2025', type: '카확', serial: '1339', party: '엄규철' },
  { court: '서울가정법원', year: '2025', type: '드단', serial: '57177', party: '박세원' },
  { court: '천안지원', year: '2025', type: '카기', serial: '5747', party: '이명규' },
  { court: '수원가정법원', year: '2024', type: '드단', serial: '26718', party: '김윤한' },
  { court: '평택지원', year: '2025', type: '가소', serial: '75559', party: '윤승연' },
  { court: '평택가정', year: '2025', type: '너', serial: '2110', party: '권순영' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20932', party: '권순영' },
  { court: '의정부지법', year: '2024', type: '가단', serial: '109296', party: '린유지' },
  { court: '평택가정', year: '2024', type: '드단', serial: '22722', party: '이대경' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20433', party: '김요한' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20513', party: '장은서' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20616', party: '정정희' },
  { court: '서산가정', year: '2025', type: '드단', serial: '50218', party: '김동원' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20704', party: '박유경' },
  { court: '평택지원', year: '2025', type: '가단', serial: '53626', party: '편수지' },
  { court: '평택가정', year: '2025', type: '드단', serial: '20629', party: '김동구' },
  { court: '수원가정법원', year: '2025', type: '드단', serial: '1488', party: '명미정' },
];

// 법원명 매핑 (로데스크 -> 대법원)
function mapCourtName(court: string): string {
  const mapping: Record<string, string> = {
    '천안가정': '천안지원',
    '평택가정': '수원가정법원 평택지원',
    '안성시법원': '수원지방법원 안성시법원',
    '청주지법': '청주지방법원',
    '평택지원': '수원지방법원 평택지원',
    '수원고법': '수원고등법원',
    '서울가정법원': '서울가정법원',
    '천안지원': '대전지방법원 천안지원',
    '의정부지법': '의정부지방법원',
    '서산가정': '대전가정법원 서산지원',
    '수원가정법원': '수원가정법원',
  };
  return mapping[court] || court;
}

async function main() {
  console.log('=== 로데스크 사건 대법원 등록 ===\n');
  console.log(`총 ${lawdeskCases.length}건의 사건을 등록합니다.\n`);

  const client = getScourtApiClient();
  const results: Array<{ case: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < Math.min(lawdeskCases.length, 10); i++) {  // 테스트용으로 10건만
    const c = lawdeskCases[i];
    const caseNumber = `${c.court}${c.year}${c.type}${c.serial}`;
    const courtName = mapCourtName(c.court);

    console.log(`\n[${i + 1}/${lawdeskCases.length}] ${caseNumber}`);
    console.log(`  법원: ${courtName}, 당사자: ${c.party}`);

    try {
      const result = await client.searchWithCaptcha({
        cortCd: courtName,
        csYr: c.year,
        csDvsCd: c.type,
        csSerial: c.serial,
        btprNm: c.party,
      });

      if (result.success) {
        console.log(`  ✅ 등록 성공! (시도: ${result.captchaAttempts}회)`);
        results.push({ case: caseNumber, success: true });
      } else {
        console.log(`  ❌ 등록 실패: ${result.error}`);
        results.push({ case: caseNumber, success: false, error: result.error });
      }
    } catch (error) {
      console.log(`  ❌ 에러: ${error}`);
      results.push({ case: caseNumber, success: false, error: String(error) });
    }

    // API 부하 방지를 위한 대기
    await new Promise(r => setTimeout(r, 2000));
  }

  // 결과 요약
  console.log('\n\n=== 등록 결과 요약 ===');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${failCount}건`);

  if (failCount > 0) {
    console.log('\n실패한 사건:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.case}: ${r.error}`);
    });
  }
}

main().catch(console.error);
