/**
 * SCOURT 나의사건검색 전체 사건유형 테스트
 *
 * 테스트 대상: 민사, 가사, 형사, 신청, 집행, 전자독촉, 회생/파산
 *
 * 사용법: npx tsx scripts/test-scourt-all-types.ts
 */

import { getScourtApiClient } from '../lib/scourt/api-client';

interface TestCase {
  court: string;
  year: string;
  type: string;
  serial: string;
  party: string;
  category: string;
  description: string;
}

const testCases: TestCase[] = [
  // 민사
  { court: '평택지원', year: '2024', type: '가단', serial: '75190', party: '홍강의', category: 'civil', description: '민사 (가단)' },
  { court: '의정부지법', year: '2025', type: '머', serial: '70829', party: '린유지', category: 'civil', description: '민사조정 (머)' },

  // 가사
  { court: '평택가정', year: '2025', type: '드단', serial: '20475', party: '엄현식', category: 'family', description: '가사 (드단)' },
  { court: '대전고법', year: '2023', type: '르', serial: '1322', party: '이정귀', category: 'family', description: '가사항소 (르)' },

  // 형사
  { court: '천안지원', year: '2024', type: '고단', serial: '2703', party: '김현성', category: 'criminal', description: '형사 (고단)' },
  { court: '대전지법', year: '2025', type: '노', serial: '887', party: '김현성', category: 'criminal', description: '형사항소 (노)' },

  // 신청/보전
  { court: '평택지원', year: '2024', type: '카확', serial: '1171', party: '제일케미칼', category: 'application', description: '소송비용확정 (카확)' },
  { court: '공주지원', year: '2025', type: '카불', serial: '3033', party: '한수연', category: 'application', description: '채무불이행자명부등재 (카불)' },

  // 집행
  { court: '평택지원', year: '2024', type: '타채', serial: '33630', party: '김진성', category: 'execution', description: '채권압류/추심 (타채)' },

  // 전자독촉
  { court: '안성시법원', year: '2025', type: '차전', serial: '2850', party: '임승태', category: 'electronicOrder', description: '전자지급명령 (차전)' },

  // 회생/파산
  { court: '대전지방법원', year: '2024', type: '개회', serial: '53142', party: '박재형', category: 'insolvency', description: '개인회생 (개회)' },
];

interface TestResult {
  description: string;
  category: string;
  success: boolean;
  detail: boolean;
  progress: boolean;
  progressCount?: number;
  error?: string;
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('SCOURT 나의사건검색 전체 사건유형 테스트');
  console.log('='.repeat(70));
  console.log(`테스트 시작: ${new Date().toISOString()}\n`);

  const client = getScourtApiClient();
  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] ${tc.description}`);
    console.log(`  사건: ${tc.court} ${tc.year}${tc.type}${tc.serial}`);
    console.log('─'.repeat(50));

    try {
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: tc.year,
        csDvsCd: tc.type,
        csSerial: tc.serial,
        btprNm: tc.party,
      });

      if (result.success) {
        const hasDetail = !!result.detailData?.csNm;
        const hasProgress = (result.progressData?.length || 0) > 0;
        const progressCount = result.progressData?.length || 0;

        console.log(`  ✅ 검색 성공`);
        console.log(`  📋 상세: ${hasDetail ? '✅' : '❌'} ${result.detailData?.csNm || ''}`);
        console.log(`  📜 진행: ${hasProgress ? '✅' : '❌'} ${progressCount}건`);

        results.push({
          description: tc.description,
          category: tc.category,
          success: true,
          detail: hasDetail,
          progress: hasProgress,
          progressCount,
        });
      } else {
        console.log(`  ❌ 실패: ${result.error}`);
        results.push({
          description: tc.description,
          category: tc.category,
          success: false,
          detail: false,
          progress: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.log(`  ❌ 에러: ${error}`);
      results.push({
        description: tc.description,
        category: tc.category,
        success: false,
        detail: false,
        progress: false,
        error: String(error),
      });
    }

    // API 호출 간격
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(70));
  console.log('테스트 결과 요약');
  console.log('='.repeat(70));
  console.log('| 사건유형                    | 검색 | 상세 | 진행 |');
  console.log('|----------------------------|------|------|------|');

  for (const r of results) {
    const desc = r.description.padEnd(26);
    const search = r.success ? ' ✅ ' : ' ❌ ';
    const detail = r.detail ? ' ✅ ' : ' ❌ ';
    const progress = r.progress ? ` ✅ ` : ' ❌ ';
    console.log(`| ${desc} |${search}|${detail}|${progress}|`);
  }

  console.log('='.repeat(70));

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  console.log(`\n총 ${totalCount}건 중 ${successCount}건 성공 (${Math.round(successCount / totalCount * 100)}%)`);
  console.log(`테스트 완료: ${new Date().toISOString()}`);
}

runTests().catch(console.error);
