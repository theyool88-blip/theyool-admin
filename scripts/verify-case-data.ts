/**
 * SCOURT 사건유형별 전체 데이터 검증 스크립트
 *
 * 검증 항목:
 * 1. 일반내용 (dma_csBasCtt) - 기본 필드
 * 2. 진행내용 (dlt_csProgCtt) - 진행 이력
 * 3. LIST 필드들 - 당사자, 대리인, 기일, 관련사건 등
 */

import { getScourtApiClient } from '../lib/scourt/api-client';
import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  court: string;
  year: string;
  type: string;
  serial: string;
  party: string;
  category: string;
  desc: string;
}

interface VerificationResult {
  caseType: string;
  desc: string;
  success: boolean;
  // 테스트 사건 정보 (재테스트용)
  testCase: {
    court: string;
    year: string;
    serial: string;
    party: string;
    fullCaseNo: string;  // 예: "2025나203824"
  };
  basicInfo: {
    fieldCount: number;
    keyFields: string[];
    allFields: string[];  // 모든 필드 코드 수집
    fieldValues: Record<string, any>;  // 필드값 샘플
  };
  progress: {
    count: number;
    fields?: string[];  // 진행내용 필드 코드
  };
  lists: {
    name: string;
    count: number;
  }[];
  partyLabels?: {
    plaintiff: string;
    defendant: string;
  };
  error?: string;
}

const testCases: TestCase[] = [
  // 15차 검증: 스
  { court: '대법원', year: '2023', type: '스', serial: '794', party: '공준권', category: 'family', desc: '특별항고' },
];

async function verifyCase(client: any, tc: TestCase): Promise<VerificationResult> {
  const result: VerificationResult = {
    caseType: tc.type,
    desc: tc.desc,
    success: false,
    testCase: {
      court: tc.court,
      year: tc.year,
      serial: tc.serial,
      party: tc.party,
      fullCaseNo: `${tc.year}${tc.type}${tc.serial}`,
    },
    basicInfo: { fieldCount: 0, keyFields: [], allFields: [], fieldValues: {} },
    progress: { count: 0, fields: [] },
    lists: [],
  };

  try {
    const apiResult = await client.searchAndRegisterCase({
      cortCd: tc.court,
      csYr: tc.year,
      csDvsCd: tc.type,
      csSerial: tc.serial,
      btprNm: tc.party,
    });

    if (!apiResult.success || !apiResult.detailData?.raw?.data) {
      result.error = apiResult.error || 'No data returned';
      return result;
    }

    const data = apiResult.detailData.raw.data;

    // 1. 일반내용 검증
    const caseInfo = data.dma_csBasCtt || {};
    const fields = Object.keys(caseInfo).filter(k => {
      const v = caseInfo[k];
      return v !== null && v !== undefined && v !== '';
    });
    result.basicInfo.fieldCount = fields.length;
    result.basicInfo.allFields = fields.sort();  // 모든 필드 코드 수집

    // 필드값 샘플 저장 (값이 있는 필드만)
    for (const f of fields) {
      const val = caseInfo[f];
      // 긴 값은 잘라서 저장
      if (typeof val === 'string' && val.length > 50) {
        result.basicInfo.fieldValues[f] = val.substring(0, 50) + '...';
      } else {
        result.basicInfo.fieldValues[f] = val;
      }
    }

    // 핵심 필드 확인
    const keyFieldNames = ['cortNm', 'userCsNo', 'csNm', 'jdbnNm', 'csRcptYmd', 'titRprsPtnr', 'titRprsRqstr'];
    result.basicInfo.keyFields = keyFieldNames.filter(f => caseInfo[f]);

    // 당사자 라벨 추출
    if (caseInfo.titRprsPtnr || caseInfo.titRprsRqstr) {
      result.partyLabels = {
        plaintiff: caseInfo.titRprsPtnr || caseInfo.rprsClmntNm ? '원고' : '-',
        defendant: caseInfo.titRprsRqstr || caseInfo.rprsAcsdNm ? '피고' : '-',
      };
      if (caseInfo.titRprsPtnr) result.partyLabels.plaintiff = caseInfo.titRprsPtnr;
      if (caseInfo.titRprsRqstr) result.partyLabels.defendant = caseInfo.titRprsRqstr;
    }

    // 2. LIST 필드 검증
    const listFields = Object.keys(data).filter(k => k !== 'dma_csBasCtt');
    for (const listKey of listFields) {
      const listData = data[listKey];
      if (Array.isArray(listData)) {
        result.lists.push({ name: listKey, count: listData.length });
      }
    }

    // 3. 진행내용 확인 (별도 progressData 필드에서)
    if (apiResult.progressData && Array.isArray(apiResult.progressData)) {
      result.progress.count = apiResult.progressData.length;
      // 진행내용 필드 코드 수집 (첫번째 항목 기준)
      if (apiResult.progressData.length > 0) {
        result.progress.fields = Object.keys(apiResult.progressData[0]);
      }
    }

    result.success = result.basicInfo.fieldCount > 0;

  } catch (e: any) {
    result.error = e.message || String(e);
  }

  return result;
}

async function main() {
  // 로그 억제
  const originalLog = console.log;
  let suppressLog = false;
  console.log = (...args: any[]) => {
    if (!suppressLog) originalLog(...args);
  };

  const client = getScourtApiClient();
  const results: VerificationResult[] = [];

  originalLog('='.repeat(80));
  originalLog('SCOURT 사건유형별 전체 데이터 검증');
  originalLog('='.repeat(80));
  originalLog('');

  for (const tc of testCases) {
    originalLog(`[${ tc.type }] ${tc.desc} - ${tc.court} ${tc.year}${tc.type}${tc.serial}`);
    suppressLog = true; // API 로그 억제

    const result = await verifyCase(client, tc);
    suppressLog = false; // 로그 복원
    results.push(result);

    if (result.success) {
      originalLog(`  ✅ 일반내용: ${result.basicInfo.fieldCount}필드, 진행내용: ${result.progress.count}건`);
      if (result.partyLabels) {
        originalLog(`     당사자라벨: ${result.partyLabels.plaintiff}/${result.partyLabels.defendant}`);
      }
      // 필드 코드 출력
      originalLog(`     필드코드: ${result.basicInfo.allFields.join(', ')}`);
    } else {
      originalLog(`  ❌ 실패: ${result.error}`);
    }

    // API 호출 간격
    await new Promise(r => setTimeout(r, 2000));
  }

  // 결과 요약
  originalLog('\n' + '='.repeat(80));
  originalLog('검증 결과 요약');
  originalLog('='.repeat(80));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  originalLog(`\n총 ${results.length}개 사건유형 검증`);
  originalLog(`✅ 성공: ${successCount}개`);
  if (failCount > 0) originalLog(`❌ 실패: ${failCount}개`);

  originalLog('\n### 상세 결과 ###\n');
  originalLog('| 유형 | 설명 | 상태 | 일반내용 | 진행내용 | 당사자라벨 |');
  originalLog('|------|------|:----:|:--------:|:--------:|-----------|');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const basicInfo = r.success ? `${r.basicInfo.fieldCount}필드` : '-';
    const progress = r.success ? `${r.progress.count}건` : '-';
    const labels = r.partyLabels ? `${r.partyLabels.plaintiff}/${r.partyLabels.defendant}` : '-';
    originalLog(`| ${r.caseType} | ${r.desc} | ${status} | ${basicInfo} | ${progress} | ${labels} |`);
  }

  // 실패한 경우 상세 출력
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    originalLog('\n### 실패 상세 ###');
    for (const f of failures) {
      originalLog(`- ${f.caseType} (${f.desc}): ${f.error}`);
    }
  }

  // 로그 복원
  console.log = originalLog;
}

main().catch(console.error);
