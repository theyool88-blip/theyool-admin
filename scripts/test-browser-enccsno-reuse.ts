/**
 * 브라우저에서 추출한 64자 encCsNo로 재사용 테스트
 *
 * API encCsNo: 44자 → 세션 내에서만 유효
 * 브라우저 encCsNo: 64자 → 세션 간 재사용 가능 (WMONID 바인딩)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// 브라우저에서 추출한 값 (이전 테스트에서 성공한 값)
const BROWSER_WMONID = 'gJ99-qJO04s';
const BROWSER_ENCCSNO = 'kMQhgOsZ3OtaWu1oONT8mM6YJ0WKfPS4qHRya6f36bzPdYrgmScMxY4lyFPp5Lfg';

async function main() {
  console.log('='.repeat(60));
  console.log('🔐 브라우저 encCsNo (64자) 재사용 테스트');
  console.log('='.repeat(60));
  console.log(`WMONID: ${BROWSER_WMONID}`);
  console.log(`encCsNo: ${BROWSER_ENCCSNO} (${BROWSER_ENCCSNO.length}자)`);
  console.log('='.repeat(60));

  // 새 세션 생성 (브라우저의 WMONID 사용)
  console.log('\n🔐 브라우저 WMONID로 새 세션 생성...');

  const initResponse = await fetch('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
    headers: {
      'Cookie': `WMONID=${BROWSER_WMONID}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  const setCookie = initResponse.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);
  const jsessionId = jsessionMatch?.[1];

  console.log(`새 JSESSIONID: ${jsessionId?.substring(0, 20)}...`);

  // 상세 조회 (캡챠 없이)
  console.log('\n📋 캡챠 없이 상세 조회...');

  const detailResponse = await fetch(
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
          cortCd: '000302',  // 수원가정법원
          csNo: '',
          encCsNo: BROWSER_ENCCSNO,
          csYear: '2024',
          csDvsCd: '150',    // 드단
          csSerial: '26718',
          btprtNm: '',       // 당사자명 없이
          captchaAnswer: '', // 캡챠 없이
        },
      }),
    }
  );

  const detailData = await detailResponse.json();

  if (detailData.errors) {
    console.log('❌ 실패:', detailData.errors.errorMessage);
    console.log('응답:', JSON.stringify(detailData, null, 2));
  } else if (detailData.data) {
    console.log('✅ 성공! 브라우저 encCsNo로 캡챠 없이 접근 가능!');
    console.log('사건명:', detailData.data.dma_csBasCtt?.csNm);
    console.log('진행상태:', detailData.data.dma_csBasCtt?.prcdStsNm);

    // 기일 정보
    const hearings = detailData.data.dlt_trmInfLst || [];
    if (hearings.length > 0) {
      console.log('\n기일 정보:');
      hearings.forEach((h: any, i: number) => {
        console.log(`  ${i + 1}. ${h.trmDt} ${h.trmNm} (${h.rslt || '예정'})`);
      });
    }
  }

  // 결론
  console.log('\n' + '='.repeat(60));
  console.log('📋 분석 결론');
  console.log('='.repeat(60));
  console.log('1. API encCsNo (44자): 세션 내에서만 유효');
  console.log('2. 브라우저 encCsNo (64자): WMONID에 바인딩되어 재사용 가능');
  console.log('3. 64자 encCsNo는 브라우저에서만 생성됨');
  console.log('   → localStorage의 dlt_csSrchHistList에서 추출');
  console.log('4. API만으로는 64자 encCsNo 획득 불가 확인 필요');
  console.log('='.repeat(60));
}

main().catch(console.error);
