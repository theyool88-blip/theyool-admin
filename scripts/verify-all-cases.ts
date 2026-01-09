/**
 * 전체 테스트 사건 검증 스크립트
 */

import { getScourtApiClient } from '../lib/scourt/api-client';
import * as fs from 'fs';

interface TestCase {
  type: string;
  desc: string;
  court: string;
  caseNo: string;
  party: string;
  verified: boolean;
}

interface VerificationResult {
  type: string;
  desc: string;
  court: string;
  caseNo: string;
  success: boolean;
  basicFields: number;
  progressCount: number;
  error?: string;
}

async function main() {
  // 로그 억제
  const originalLog = console.log;
  let suppressLog = true;
  console.log = (...args: any[]) => {
    if (!suppressLog) originalLog(...args);
  };

  const client = getScourtApiClient();

  // 테스트 사건 로드
  const testData = JSON.parse(fs.readFileSync('data/scourt-test-cases.json', 'utf-8'));
  const testCases: TestCase[] = testData.cases;

  originalLog('='.repeat(80));
  originalLog(`SCOURT 전체 사건 검증 (${testCases.length}개)`);
  originalLog('='.repeat(80));
  originalLog('');

  const results: VerificationResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const match = tc.caseNo.match(/^(\d{4})([가-힣]+)(\d+)$/);
    if (!match) {
      originalLog(`[${i+1}/${testCases.length}] ${tc.type} - 잘못된 사건번호: ${tc.caseNo}`);
      continue;
    }

    const [, year, type, serial] = match;
    originalLog(`[${i+1}/${testCases.length}] ${tc.type} (${tc.desc}) - ${tc.court} ${tc.caseNo}`);

    try {
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: year,
        csDvsCd: type,
        csSerial: serial,
        btprNm: tc.party,
      });

      if (result.success && result.generalData?.raw?.data) {
        const caseInfo = result.generalData.raw.data.dma_csBasCtt || {};
        const fields = Object.keys(caseInfo).filter(k => caseInfo[k] !== null && caseInfo[k] !== '');
        const progressCount = result.progressData?.length || 0;

        results.push({
          type: tc.type,
          desc: tc.desc,
          court: tc.court,
          caseNo: tc.caseNo,
          success: true,
          basicFields: fields.length,
          progressCount,
        });
        originalLog(`  ✅ 일반: ${fields.length}필드, 진행: ${progressCount}건`);
      } else {
        results.push({
          type: tc.type,
          desc: tc.desc,
          court: tc.court,
          caseNo: tc.caseNo,
          success: false,
          basicFields: 0,
          progressCount: 0,
          error: result.error || 'No data',
        });
        originalLog(`  ❌ 실패: ${result.error || 'No data'}`);
      }
    } catch (e: any) {
      results.push({
        type: tc.type,
        desc: tc.desc,
        court: tc.court,
        caseNo: tc.caseNo,
        success: false,
        basicFields: 0,
        progressCount: 0,
        error: e.message,
      });
      originalLog(`  ❌ 에러: ${e.message}`);
    }

    // API 호출 간격
    await new Promise(r => setTimeout(r, 1500));
  }

  // 결과 요약
  originalLog('\n' + '='.repeat(80));
  originalLog('검증 결과 요약');
  originalLog('='.repeat(80));

  const success = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  originalLog(`\n총 ${results.length}개 중 ✅ 성공: ${success.length}개, ❌ 실패: ${failed.length}개`);

  // 성공한 사건 목록
  originalLog('\n### 성공한 사건 ###');
  originalLog('| 유형 | 설명 | 일반필드 | 진행내용 |');
  originalLog('|------|------|:-------:|:-------:|');
  for (const r of success) {
    originalLog(`| ${r.type} | ${r.desc} | ${r.basicFields} | ${r.progressCount} |`);
  }

  // 실패한 사건 목록
  if (failed.length > 0) {
    originalLog('\n### 실패한 사건 ###');
    for (const r of failed) {
      originalLog(`- ${r.type} (${r.desc}): ${r.error}`);
    }
  }

  console.log = originalLog;
}

main().catch(console.error);
