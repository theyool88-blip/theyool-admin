/**
 * 형사사건 API 디버깅 스크립트
 *
 * 검색은 성공하지만 상세 조회가 실패하는 원인 분석
 */
import { getScourtApiClient } from '../lib/scourt/api-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const apiClient = getScourtApiClient();

  // 형사사건 테스트 (2024고단2703)
  console.log('='.repeat(60));
  console.log('🔍 형사사건 API 디버깅');
  console.log('='.repeat(60));

  // Step 1: 세션 초기화
  console.log('\n📍 Step 1: 세션 초기화');
  const session = await (apiClient as any).initSession();
  console.log('  세션:', session ? '성공' : '실패');

  // Step 2: 캡챠 + 검색
  console.log('\n📍 Step 2: 사건 검색 (캡챠 포함)');
  const searchResult = await (apiClient as any).searchWithCaptcha({
    cortCd: '대전지방법원 천안지원',
    csYr: '2024',
    csDvsCd: '고단',
    csSerial: '2703',
    btprNm: '김',
  });

  if (!searchResult.success) {
    console.log('❌ 검색 실패:', searchResult.error);
    return;
  }

  console.log('✅ 검색 성공');
  console.log('  encCsNo:', searchResult.encCsNo?.substring(0, 40) + '...');
  console.log('  encCsNo 길이:', searchResult.encCsNo?.length);

  // Step 3: 검색 결과 원본 데이터 확인
  console.log('\n📍 Step 3: 검색 결과 분석');
  const searchData = searchResult.data?.data;
  if (searchData) {
    console.log('  응답 필드:', Object.keys(searchData).join(', '));

    // dlt_csNoHistLst에서 사건 정보 추출
    const csList = searchData.dlt_csNoHistLst || [];
    if (csList.length > 0) {
      console.log('  사건 정보 필드:', Object.keys(csList[0]).join(', '));
      console.log('  사건 정보:', JSON.stringify(csList[0], null, 2));
    }
  }

  // Step 4: 상세 조회 시도 (다양한 파라미터 조합)
  console.log('\n📍 Step 4: 상세 조회 테스트');

  const wmonid = (apiClient as any).getWmonid();
  const jsessionId = (apiClient as any).session?.jsessionId;

  // 법원코드/사건유형코드 확인
  const courtCode = (apiClient as any).getCourtCode('대전지방법원 천안지원');
  const caseTypeCode = (apiClient as any).getCaseTypeCode('고단');
  console.log('  법원코드:', courtCode);
  console.log('  사건유형코드:', caseTypeCode);

  // 다양한 요청 형식 시도
  const testConfigs = [
    {
      name: '기본 형식',
      body: {
        dma_search: {
          cortCd: courtCode,
          csNo: '',
          encCsNo: searchResult.encCsNo,
          csYear: '2024',
          csDvsCd: caseTypeCode,
          csSerial: '2703',
          btprtNm: '김',
          captchaAnswer: '',
        },
      },
    },
    {
      name: 'csNo 포함',
      body: {
        dma_search: {
          cortCd: courtCode,
          csNo: '20243120002703',  // 연도+유형코드+일련번호
          encCsNo: searchResult.encCsNo,
          csYear: '2024',
          csDvsCd: caseTypeCode,
          csSerial: '0002703',  // 7자리 패딩
          btprtNm: '김',
          captchaAnswer: '',
        },
      },
    },
    {
      name: 'srchDvs 추가',
      body: {
        dma_search: {
          cortCd: courtCode,
          csNo: '',
          encCsNo: searchResult.encCsNo,
          csYear: '2024',
          csDvsCd: caseTypeCode,
          csSerial: '2703',
          btprtNm: '김',
          captchaAnswer: '',
          srchDvs: '01',  // 검색구분
        },
      },
    },
  ];

  const baseUrl = 'https://ssgo.scourt.go.kr';
  const criminalEndpoint = '/ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsGnrlCtt.on';

  for (const config of testConfigs) {
    console.log(`\n  📤 테스트: ${config.name}`);
    console.log('    요청:', JSON.stringify(config.body, null, 2));

    try {
      const response = await fetch(`${baseUrl}${criminalEndpoint}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
          'Origin': 'https://ssgo.scourt.go.kr',
          'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
        },
        body: JSON.stringify(config.body),
      });

      const data = await response.json();
      console.log('    응답:', JSON.stringify(data).substring(0, 500));

      if (data.data && !data.errors) {
        console.log('    ✅ 성공! 필드:', Object.keys(data.data).join(', '));
      } else {
        console.log('    ❌ 실패:', data.errors?.errorMessage || '알 수 없는 오류');
      }
    } catch (e) {
      console.log('    ❌ 에러:', e);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  // Step 5: 민사 엔드포인트로도 시도
  console.log('\n📍 Step 5: 다른 API 엔드포인트 시도');

  const endpoints = [
    { name: '민사', path: '/ssgo/ssgo101/selectHmpgCvlCsGnrlCtt.on' },
    { name: '형사(공판)', path: '/ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsGnrlCtt.on' },
    { name: '형사(약식)', path: '/ssgo/ssgo10h/selectHmpgCrmcsSmlCsGnrlCtt.on' },
  ];

  for (const ep of endpoints) {
    console.log(`\n  📤 엔드포인트: ${ep.name} (${ep.path})`);

    try {
      const response = await fetch(`${baseUrl}${ep.path}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
          'Origin': 'https://ssgo.scourt.go.kr',
          'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
        },
        body: JSON.stringify({
          dma_search: {
            cortCd: courtCode,
            encCsNo: searchResult.encCsNo,
            csYear: '2024',
            csDvsCd: caseTypeCode,
            csSerial: '2703',
          },
        }),
      });

      const data = await response.json();

      if (data.data && !data.errors) {
        console.log('    ✅ 성공! 필드:', Object.keys(data.data).join(', '));
        console.log('    기본정보:', JSON.stringify(data.data.dma_csBasCtt || {}).substring(0, 300));
      } else {
        console.log('    ❌ 실패:', data.errors?.errorMessage || JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log('    ❌ 에러:', e);
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
