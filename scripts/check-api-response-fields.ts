/**
 * SCOURT API 응답 필드 확인 스크립트
 *
 * 각 사건 유형별로 API 호출 후 전체 응답을 JSON 파일로 저장
 * 목적: 연관사건(dlt_reltCsLst), 심급정보 등 누락 필드 확인
 *
 * 실행: npx tsx scripts/check-api-response-fields.ts
 */

import { getScourtApiClient } from '../lib/scourt/api-client';
import fs from 'fs';
import path from 'path';

// 테스트할 사건 목록 (두 CSV에서 추출)
const testCases = [
  // 가사
  { court: '평택가정', year: '2024', type: '드단', serial: '25547', party: '엄현식', category: '가사' },
  { court: '천안가정', year: '2025', type: '느단', serial: '3513', party: '김지영', category: '가사' },
  { court: '평택가정', year: '2025', type: '너', serial: '2110', party: '권순영', category: '가사' },

  // 민사
  { court: '평택지원', year: '2025', type: '가단', serial: '55158', party: '이명규', category: '민사' },
  { court: '안성시법원', year: '2025', type: '가소', serial: '6582', party: '임승태', category: '민사' },

  // 보전/신청
  { court: '평택지원', year: '2025', type: '카기', serial: '10680', party: '이명규', category: '보전' },
  { court: '평택가정', year: '2025', type: '즈단', serial: '10057', party: '한영미', category: '보전' },
  { court: '천안지원', year: '2025', type: '카불', serial: '6034', party: '강호현', category: '집행' },

  // 항소심
  { court: '수원고법', year: '2025', type: '르', serial: '10717', party: '장원석', category: '항소' },

  // 지급명령
  { court: '안성시법원', year: '2025', type: '차전', serial: '2850', party: '임승태', category: '지급명령' },

  // 개인회생 (사건목록_260105101530.csv)
  { court: '서울회생법원', year: '2024', type: '개회', serial: '53142', party: '권순영', category: '회생' },
  { court: '서울회생법원', year: '2023', type: '개회', serial: '125248', party: '김건우', category: '회생' },

  // 파산 (사건목록_260105101530.csv)
  { court: '서울회생법원', year: '2022', type: '하단', serial: '11477', party: '문미경', category: '파산' },
  { court: '서울회생법원', year: '2022', type: '하면', serial: '10353', party: '배선호', category: '파산' },
];

const OUTPUT_DIR = path.join(__dirname, '../data/scourt-api-responses');

async function main() {
  console.log('='.repeat(70));
  console.log('SCOURT API 응답 필드 확인 스크립트');
  console.log('='.repeat(70));
  console.log(`테스트 대상: ${testCases.length}개 사건\n`);

  const client = getScourtApiClient();

  // 결과 요약
  const results: Array<{
    caseNumber: string;
    category: string;
    success: boolean;
    fields: string[];
    hasRelatedCases: boolean;
    relatedCasesCount: number;
    error?: string;
  }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const caseNumber = `${tc.year}${tc.type}${tc.serial}`;

    console.log(`\n[${ i + 1}/${testCases.length}] ${tc.category} - ${tc.court} ${caseNumber} (${tc.party})`);
    console.log('-'.repeat(50));

    try {
      // API 호출
      const result = await client.searchAndRegisterCase({
        cortCd: tc.court,
        csYr: tc.year,
        csDvsCd: tc.type,
        csSerial: tc.serial,
        btprNm: tc.party,
      });

      if (result.success && result.detailData) {
        // raw 응답 저장
        const fileName = `response_${tc.category}_${tc.type}_${caseNumber}.json`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        const saveData = {
          caseInfo: {
            court: tc.court,
            caseNumber,
            party: tc.party,
            category: tc.category,
          },
          encCsNo: result.encCsNo,
          wmonid: result.wmonid,
          detailData: result.detailData,
          progressData: result.progressData,
          raw: result.caseData,
        };

        fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf-8');
        console.log(`  저장: ${fileName}`);

        // 필드 분석
        const rawData = result.detailData.raw?.data || {};
        const fields = Object.keys(rawData);
        console.log(`  필드 수: ${fields.length}`);
        console.log(`  필드 목록: ${fields.join(', ')}`);

        // 연관사건 확인
        const relatedCases = rawData.dlt_reltCsLst || rawData.dlt_relatedCsLst || [];
        const hasRelatedCases = relatedCases.length > 0;
        console.log(`  연관사건: ${hasRelatedCases ? `${relatedCases.length}건` : '없음'}`);

        if (hasRelatedCases) {
          console.log(`  연관사건 구조: ${JSON.stringify(relatedCases[0], null, 2).substring(0, 200)}`);
        }

        // 기일/진행내용 수
        console.log(`  기일: ${result.detailData.hearings?.length || 0}건`);
        console.log(`  진행내용: ${result.progressData?.length || 0}건`);
        console.log(`  당사자: ${result.detailData.parties?.length || 0}명`);
        console.log(`  대리인: ${result.detailData.representatives?.length || 0}명`);

        results.push({
          caseNumber: `${tc.court} ${caseNumber}`,
          category: tc.category,
          success: true,
          fields,
          hasRelatedCases,
          relatedCasesCount: relatedCases.length,
        });
      } else {
        console.log(`  실패: ${result.error}`);
        results.push({
          caseNumber: `${tc.court} ${caseNumber}`,
          category: tc.category,
          success: false,
          fields: [],
          hasRelatedCases: false,
          relatedCasesCount: 0,
          error: result.error,
        });
      }
    } catch (error) {
      console.log(`  에러: ${error}`);
      results.push({
        caseNumber: `${tc.court} ${caseNumber}`,
        category: tc.category,
        success: false,
        fields: [],
        hasRelatedCases: false,
        relatedCasesCount: 0,
        error: String(error),
      });
    }

    // API 호출 간격 (3초)
    if (i < testCases.length - 1) {
      console.log('  대기 3초...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 결과 요약 출력
  console.log('\n' + '='.repeat(70));
  console.log('결과 요약');
  console.log('='.repeat(70));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const withRelated = results.filter(r => r.hasRelatedCases).length;

  console.log(`\n성공: ${successCount}건, 실패: ${failCount}건`);
  console.log(`연관사건 있음: ${withRelated}건\n`);

  // 카테고리별 결과
  const categories = [...new Set(testCases.map(tc => tc.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catSuccess = catResults.filter(r => r.success);
    const catFail = catResults.filter(r => !r.success);

    console.log(`[${cat}]`);
    console.log(`  성공: ${catSuccess.length}건, 실패: ${catFail.length}건`);

    if (catFail.length > 0) {
      console.log(`  실패 사건: ${catFail.map(r => r.caseNumber).join(', ')}`);
      console.log(`  에러: ${catFail.map(r => r.error).join(', ')}`);
    }

    // 공통 필드 분석
    if (catSuccess.length > 0) {
      const allFields = catSuccess.flatMap(r => r.fields);
      const uniqueFields = [...new Set(allFields)];
      console.log(`  필드: ${uniqueFields.slice(0, 10).join(', ')}${uniqueFields.length > 10 ? '...' : ''}`);
    }

    console.log();
  }

  // 요약 파일 저장
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalCases: testCases.length,
    successCount,
    failCount,
    withRelatedCases: withRelated,
    results,
  }, null, 2), 'utf-8');

  console.log(`\n요약 파일: ${summaryPath}`);
  console.log('완료!');
}

main().catch(console.error);
