/**
 * 사건 유형별 API 필드 확인
 * - 가사사건 (드단): 원고/피고
 * - 신청사건 (즈기): 신청인/피신청인
 * - 형사사건 (고단): 피고인
 */
import { getScourtApiClient } from '../lib/scourt/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface CaseTest {
  name: string;
  params: {
    cortCd: string;
    csYr: string;
    csDvsCd: string;
    csSerial: string;
    btprNm: string;
  };
}

// 테스트할 사건들 (브라우저에서 확인한 실제 사건번호)
const testCases: CaseTest[] = [
  {
    name: '가사사건 (드단) - 원고/피고',
    params: {
      cortCd: '수원가정법원 평택지원',
      csYr: '2024',
      csDvsCd: '드단',
      csSerial: '531',
      btprNm: '장태일',
    },
  },
  // 형사사건 (고단) - 브라우저에서 확인: cortCd=000283, csDvsCd=077
  {
    name: '형사사건 (고단) - 피고인',
    params: {
      cortCd: '대전지방법원 천안지원',
      csYr: '2024',
      csDvsCd: '고단',
      csSerial: '2703',
      btprNm: '김',  // 피고인명 (실제: 김현성)
    },
  },
  // 신청사건 (즈단) - 브라우저에서 확인: cortCd=000305, csDvsCd=177
  {
    name: '신청사건 (즈단) - 신청인/피신청인',
    params: {
      cortCd: '수원가정법원 평택지원',
      csYr: '2025',
      csDvsCd: '즈단',
      csSerial: '10057',
      btprNm: '한영미',  // 브라우저에서 확인한 당사자명
    },
  },
];

async function main() {
  const apiClient = getScourtApiClient();

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${testCase.name}`);
    console.log(`   사건: ${testCase.params.csYr}${testCase.params.csDvsCd}${testCase.params.csSerial}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const result = await apiClient.searchAndRegisterCase(testCase.params);

      if (result.success && result.generalData?.raw) {
        const data = result.generalData.raw.data;

        // 사건 카테고리
        console.log('\n📌 사건 카테고리:', result.generalData.caseCategory || '(없음)');

        // 기본정보
        console.log('\n📌 기본정보 (dma_csBasCtt):');
        const basicInfo = data.dma_csBasCtt;
        if (basicInfo) {
          console.log('  사건명:', basicInfo.csNm);
          console.log('  원고/신청인:', basicInfo.rprsClmntNm || basicInfo.aplNm);
          console.log('  피고/피신청인:', basicInfo.rprsAcsdNm || basicInfo.rspNm);
          console.log('  재판부:', basicInfo.ultmtJdbnNm || basicInfo.jdbnNm);
          console.log('  재판부전화:', basicInfo.jdbnTelno);
          // 모든 필드 키 출력
          console.log('  [모든 필드]:', Object.keys(basicInfo).join(', '));
        }

        // 당사자 정보
        console.log('\n📌 당사자 정보 (dlt_btprtCttLst):');
        const parties = data.dlt_btprtCttLst || [];
        if (parties.length > 0) {
          console.log('  첫번째 당사자 필드:', Object.keys(parties[0]).join(', '));
          parties.forEach((p: any, i: number) => {
            console.log(`  [${i}] ${p.btprtStndngNm || p.btprtDvsNm}: ${p.btprtNm}`);
          });
        } else {
          console.log('  (없음)');
        }

        // 대리인 정보
        console.log('\n📌 대리인 정보 (dlt_agntCttLst):');
        const agents = data.dlt_agntCttLst || [];
        if (agents.length > 0) {
          console.log('  첫번째 대리인 필드:', Object.keys(agents[0]).join(', '));
          agents.forEach((a: any, i: number) => {
            console.log(`  [${i}] ${a.agntDvsNm}: ${a.agntNm}`);
          });
        } else {
          console.log('  (없음)');
        }

        // 기일 정보
        console.log('\n📌 기일 정보 (dlt_rcntDxdyLst):');
        const hearings = data.dlt_rcntDxdyLst || [];
        if (hearings.length > 0) {
          console.log('  첫번째 기일 필드:', Object.keys(hearings[0]).join(', '));
          console.log('  기일 수:', hearings.length);
        } else {
          console.log('  (없음)');
        }

        // 모든 dlt_ 필드
        console.log('\n📌 모든 리스트 필드:');
        const dltFields = Object.keys(data).filter(k => k.startsWith('dlt_'));
        for (const field of dltFields) {
          const arr = data[field];
          if (Array.isArray(arr)) {
            console.log(`  ${field}: ${arr.length}건`);
          }
        }

      } else {
        console.log('❌ 검색 실패:', result.error);
      }
    } catch (error) {
      console.log('❌ 에러:', error);
    }

    // 다음 검색 전 딜레이
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
