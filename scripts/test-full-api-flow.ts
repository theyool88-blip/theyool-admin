/**
 * 대법원 API 전체 플로우 테스트
 * 검색 + 상세 정보 조회
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getScourtApiClient } from '../lib/scourt/api-client';

async function testFullFlow() {
  console.log('🧪 대법원 API 전체 플로우 테스트\n');

  const client = getScourtApiClient();

  // 테스트 사건 정보
  const testCase = {
    cortCd: '수원가정법원',
    csYr: '2024',
    csDvsCd: '드단',
    csSerial: '26718',
    btprNm: '김윤한',
  };

  console.log('📋 테스트 사건 정보:');
  console.log(`  법원: ${testCase.cortCd}`);
  console.log(`  사건: ${testCase.csYr}${testCase.csDvsCd}${testCase.csSerial}`);
  console.log(`  당사자: ${testCase.btprNm}`);
  console.log('');

  // 검색 + 상세 조회 실행
  const result = await client.searchAndGetDetail(testCase);

  console.log('\n' + '='.repeat(60));
  console.log('📊 결과');
  console.log('='.repeat(60));

  // 검색 결과
  console.log('\n[검색 결과]');
  if (result.searchResult.success) {
    console.log('  ✅ 검색 성공');
    console.log(`  시도 횟수: ${result.searchResult.captchaAttempts}`);
    console.log(`  암호화된 사건번호: ${result.searchResult.encCsNo?.substring(0, 30)}...`);

    // 검색 결과 데이터
    const csList = result.searchResult.data?.data?.dlt_csNoHistLst;
    if (csList && csList.length > 0) {
      console.log(`  검색된 사건 수: ${csList.length}`);
    }
  } else {
    console.log(`  ❌ 검색 실패: ${result.searchResult.error}`);
  }

  // 상세 조회 결과
  console.log('\n[상세 조회 결과]');
  if (result.detailResult) {
    if (result.detailResult.success) {
      console.log('  ✅ 상세 조회 성공');

      const detail = result.detailResult.data;
      if (detail) {
        console.log('\n  기본 정보:');
        console.log(`    사건번호: ${detail.csNo || '(없음)'}`);
        console.log(`    사건유형: ${detail.csDvsNm || '(없음)'}`);
        console.log(`    법원: ${detail.cortNm || '(없음)'}`);
        console.log(`    사건명: ${detail.csNm || '(없음)'}`);
        console.log(`    진행상태: ${detail.prcdStsNm || '(없음)'}`);

        if (detail.parties && detail.parties.length > 0) {
          console.log('\n  당사자 정보:');
          detail.parties.forEach((p, i) => {
            console.log(`    ${i + 1}. ${p.btprDvsNm}: ${p.btprNm}`);
          });
        }

        if (detail.hearings && detail.hearings.length > 0) {
          console.log('\n  기일 정보:');
          detail.hearings.forEach((h, i) => {
            console.log(`    ${i + 1}. ${h.trmDt} - ${h.trmNm} (${h.trmPntNm})`);
            if (h.rslt) console.log(`       결과: ${h.rslt}`);
          });
        }

        // 원본 응답 키 출력
        console.log('\n  원본 응답 키:');
        if (detail.raw?.data) {
          console.log(`    ${Object.keys(detail.raw.data).join(', ')}`);
        }
      }
    } else {
      console.log(`  ❌ 상세 조회 실패: ${result.detailResult.error}`);
    }
  } else {
    console.log('  ⚠️ 상세 조회가 실행되지 않았습니다.');
  }

  // 전체 응답 저장
  const outputPath = path.join(process.cwd(), 'temp', 'api-flow-result.json');
  const fs = await import('fs');
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n📁 전체 응답 저장: ${outputPath}`);

  console.log('\n✅ 테스트 완료');
}

testFullFlow().catch((error) => {
  console.error('❌ 테스트 실패:', error);
  process.exit(1);
});
