/**
 * 건너뛴 법인/회사 사건 14건 등록
 * 회사명 전체를 당사자명으로 사용
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getScourtApiClient } from '../lib/scourt/api-client';

// 건너뛴 14건 (회사명 포함)
const companyCases = [
  // 법무법인 더율 사건들
  { court: '순천지원', year: '2025', type: '카불', serial: '10526', party: '법무법인' },  // 법무법인 더율
  { court: '천안지원', year: '2025', type: '카불', serial: '5736', party: '법무법인' },   // 법무법인 더율
  { court: '평택지원', year: '2024', type: '가소', serial: '104535', party: '법무법인' }, // 법무법인 더율
  { court: '평택지원', year: '2024', type: '차전', serial: '8467', party: '법무법인' },   // 법무법인 더율
  { court: '평택지원', year: '2024', type: '차전', serial: '8427', party: '법무법인' },   // 법무법인 더율
  { court: '아산시법원', year: '2024', type: '차전', serial: '4011', party: '법무법인' }, // 법무법인 더율

  // 주식회사 제일케미칼 사건들
  { court: '평택지원', year: '2025', type: '카단', serial: '10332', party: '제일케미칼' },  // 주식회사 제일케미칼
  { court: '평택지원', year: '2024', type: '가소', serial: '71284', party: '제일케미칼' },  // 주식회사 제일케미칼
  { court: '평택지원', year: '2022', type: '차전', serial: '937', party: '제일케미칼' },    // 주식회사 제일케미칼

  // 주식회사 한일전력공사 사건들
  { court: '광주지법', year: '2025', type: '카단', serial: '51793', party: '한일전력' },    // 주식회사 한일전력공사
  { court: '광주지법', year: '2025', type: '차전', serial: '107692', party: '한일전력' },   // 주식회사 한일전력공사
  { court: '광주지법', year: '2025', type: '카담', serial: '50323', party: '한일전력' },    // 주식회사 한일전력공사

  // 주식회사 한성일렉트릭 사건들
  { court: '의정부지법', year: '2024', type: '가단', serial: '107023', party: '한성일렉' },  // 주식회사 한성일렉트릭
  { court: '광주지법', year: '2025', type: '카단', serial: '51631', party: '한성일렉' },     // 주식회사 한성일렉트릭
];

// 법원명 매핑
function mapCourtName(court: string): string {
  const mapping: Record<string, string> = {
    '순천지원': '광주지방법원 순천지원',
    '천안지원': '대전지방법원 천안지원',
    '평택지원': '수원지방법원 평택지원',
    '아산시법원': '대전지방법원 천안지원 아산시법원',
    '광주지법': '광주지방법원',
    '의정부지법': '의정부지방법원',
  };
  return mapping[court] || court;
}

async function main() {
  console.log('=== 법인/회사 사건 등록 (14건) ===\n');

  const client = getScourtApiClient();
  const results: Array<{ case: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < companyCases.length; i++) {
    const c = companyCases[i];
    const caseNumber = `${c.court}${c.year}${c.type}${c.serial}`;
    const courtName = mapCourtName(c.court);

    console.log(`\n[${i + 1}/${companyCases.length}] ${caseNumber}`);
    console.log(`  법원: ${courtName}, 당사자: ${c.party}`);

    try {
      const result = await client.searchWithCaptcha({
        cortCd: courtName,
        csYr: c.year,
        csDvsCd: c.type,
        csSerial: c.serial,
        btprNm: c.party.substring(0, 4),  // 회사명 4글자 사용
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

    // API 부하 방지
    await new Promise(r => setTimeout(r, 1500));
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
