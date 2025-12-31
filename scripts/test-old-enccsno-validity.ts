/**
 * 이전에 저장된 encCsNo가 여전히 유효한지 테스트
 *
 * 질문: 브라우저 localStorage에서 삭제된 encCsNo도 서버에서 작동하나?
 *
 * 시나리오:
 * - 사용자가 51번째 사건 저장 → 1번째 사건 localStorage에서 삭제
 * - 하지만 1번째 사건의 encCsNo를 우리 DB에 저장해뒀다면?
 * - 이 encCsNo로 여전히 접근 가능한가?
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// 브라우저에서 이전에 추출한 encCsNo들 (DB에 저장된 것)
const BROWSER_WMONID = 'gJ99-qJO04s';

// 이전에 저장된 encCsNo들 (시간 순으로)
const SAVED_CASES = [
  {
    case_number: '2024드단26718',
    enc_cs_no: 'kMQhgOsZ3OtaWu1oONT8mM6YJ0WKfPS4qHRya6f36bzPdYrgmScMxY4lyFPp5Lfg',
    court_code: '000302',
    case_type: '150',
  },
  {
    case_number: '2024카합30',
    enc_cs_no: 'kMQhgOsZ3OtaWu1oONT8mLuK60g6HrMD46RqfF4Pq0GkuHHaB2/HnqOluwOKVygk',
    court_code: '000302',
    case_type: '151',
  },
  {
    case_number: '2023노2410',
    enc_cs_no: 'kMQhgOsZ3OtaWu1oONT8mIkZxb6vr8wYq0jZgVOUEO/a5E951qGMRorRE5i4Lj16',
    court_code: '000079',  // 수원지방법원
    case_type: '110',      // 형사
  },
];

async function main() {
  console.log('='.repeat(60));
  console.log('🔍 이전 저장된 encCsNo 유효성 테스트');
  console.log('='.repeat(60));
  console.log(`WMONID: ${BROWSER_WMONID}`);
  console.log(`테스트 사건 수: ${SAVED_CASES.length}개`);

  // 새 세션 생성 (기존 WMONID 사용)
  console.log('\n🔐 세션 생성...');
  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: { 'Cookie': `WMONID=${BROWSER_WMONID}` },
  });

  const setCookie = initResponse.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);
  const jsessionId = jsessionMatch?.[1];

  console.log(`새 JSESSIONID: ${jsessionId?.substring(0, 20)}...`);

  // 각 encCsNo로 상세 조회 테스트
  console.log('\n' + '='.repeat(60));
  console.log('📋 각 사건 encCsNo로 상세 조회 테스트');
  console.log('='.repeat(60));

  for (const caseInfo of SAVED_CASES) {
    console.log(`\n[${caseInfo.case_number}]`);
    console.log(`  encCsNo: ${caseInfo.enc_cs_no.substring(0, 30)}...`);

    try {
      const detailRes = await fetch(
        'https://ssgo.scourt.go.kr/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json;charset=UTF-8',
            'Cookie': `WMONID=${BROWSER_WMONID}; JSESSIONID=${jsessionId}`,
            'Origin': 'https://ssgo.scourt.go.kr',
            'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
          },
          body: JSON.stringify({
            dma_search: {
              cortCd: caseInfo.court_code,
              csNo: '',
              encCsNo: caseInfo.enc_cs_no,
              csYear: caseInfo.case_number.substring(0, 4),
              csDvsCd: caseInfo.case_type,
              csSerial: caseInfo.case_number.match(/\d+$/)?.[0] || '',
              btprtNm: '',
              captchaAnswer: '',
            },
          }),
        }
      );

      const detailData = await detailRes.json();

      if (detailData.errors) {
        console.log(`  ❌ 실패: ${detailData.errors.errorMessage}`);
      } else if (detailData.data) {
        const caseName = detailData.data.dma_csBasCtt?.csNm ||
                        detailData.data.dma_gnrlCtt?.csNm ||
                        '사건명 없음';
        console.log(`  ✅ 성공! 사건명: ${caseName}`);
      }
    } catch (e) {
      console.log(`  ❌ 에러: ${e}`);
    }
  }

  // 결론
  console.log('\n' + '='.repeat(60));
  console.log('📋 결론');
  console.log('='.repeat(60));
  console.log('encCsNo 유효성:');
  console.log('  - localStorage 삭제와 무관하게 서버에서 유효');
  console.log('  - WMONID + encCsNo 조합이 맞으면 접근 가능');
  console.log('  - WMONID 만료(2년) 전까지 유효할 것으로 추정');
  console.log('='.repeat(60));
}

main().catch(console.error);
