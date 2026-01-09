/**
 * 여러 사건을 한 번에 csNoHistLst로 등록
 *
 * 핵심: 모든 사건번호를 csNoHistLst에 쉼표로 구분해서 한 번에 전송
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SCOURT_BASE_URL = 'https://ssgo.scourt.go.kr';

// 사건유형 코드 매핑
const CASE_TYPE_CODES: Record<string, string> = {
  '드단': '150', '드합': '151', '느단': '140', '느합': '141',
};

// 법원코드 매핑
const COURT_CODES: Record<string, string> = {
  '수원가정법원': '000302', '수원가정': '000302', '수원법원': '000302',
  '평택지원': '000305', '평택가정': '000305',
  '성남지원': '000303', '여주지원': '000304',
  '안양지원': '000306', '안산지원': '000322',
};

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 일괄 사건 등록 (csNoHistLst 방식)');
  console.log('='.repeat(60));

  // 1. legal_cases에서 가사 사건 조회
  console.log('\n[1] 사건 조회...');

  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, court_name, plaintiffs, defendants')
    .or('court_case_number.ilike.%드단%,court_case_number.ilike.%드합%,court_case_number.ilike.%느단%,court_case_number.ilike.%느합%')
    .not('court_case_number', 'is', null)
    .limit(10);

  if (error || !cases?.length) {
    console.log('❌ 조회 실패:', error?.message);
    return;
  }

  // 사건 정보 파싱
  const parsedCases = cases.map(c => {
    const match = c.court_case_number?.match(/(\d{4})([가-힣]+)(\d+)/);
    if (!match) return null;

    const caseTypeCode = CASE_TYPE_CODES[match[2]];
    if (!caseTypeCode) return null;

    const plaintiffs = c.plaintiffs as any[] || [];
    const defendants = c.defendants as any[] || [];

    return {
      id: c.id,
      case_number: c.court_case_number,
      court_name: c.court_name,
      case_year: match[1],
      case_type: match[2],
      case_type_code: caseTypeCode,
      case_serial: match[3],
      // csNoHistLst 형식: 연도(4) + 유형코드(3) + 7자리 일련번호 = 14자
      csNoHistFormat: `${match[1]}${caseTypeCode}${match[3].padStart(7, '0')}`,
      party_name: plaintiffs?.[0]?.name?.substring(0, 1) ||
                  defendants?.[0]?.name?.substring(0, 1) || '김',
    };
  }).filter(Boolean) as any[];

  console.log(`${parsedCases.length}개 사건 파싱 완료`);
  parsedCases.forEach((c, i) => console.log(`  ${i + 1}. ${c.case_number}`));

  // csNoHistLst 생성 (쉼표 구분)
  const csNoHistLst = parsedCases.map(c => c.csNoHistFormat).join(',');
  console.log(`\ncsNoHistLst: ${csNoHistLst}`);

  // 2. 세션 생성
  console.log('\n[2] 세션 생성...');
  const initRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`);
  const setCookie = initRes.headers.get('set-cookie');
  const wmonid = setCookie?.match(/WMONID=([^;]+)/)?.[1];
  const jsessionId = setCookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  console.log(`WMONID: ${wmonid}`);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
    'Origin': SCOURT_BASE_URL,
    'Referer': `${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`,
  };

  // 3. 캡챠 해결 및 검색
  console.log('\n[3] 캡챠 해결 및 검색...');

  const solver = getVisionCaptchaSolver();
  let encCsNoList: any[] = [];

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`  시도 ${attempt}/5...`);

    // 캡챠 획득
    const captchaRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
      method: 'POST', headers, body: '',
    });
    const captchaData = await captchaRes.json();
    const captchaImage = captchaData?.data?.dma_captchaInf?.image;

    if (!captchaImage) continue;

    const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const captchaResult = await solver.solveCaptcha(imageBuffer);

    if (!captchaResult.text) continue;
    console.log(`  캡챠: ${captchaResult.text}`);

    // 검색 - 첫 번째 사건 정보로 검색하되 csNoHistLst에 모든 사건 포함
    const firstCase = parsedCases[0];
    const searchRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dma_search: {
          cortCd: firstCase.court_name?.includes('평택') ? '평택지원' :
                  firstCase.court_name?.includes('수원') ? '수원가정법원' : '수원가정법원',
          cdScope: 'ALL',
          csNoHistLst: csNoHistLst,  // 모든 사건번호 포함
          csDvsCd: firstCase.case_type,
          csYr: firstCase.case_year,
          csSerial: firstCase.case_serial,
          btprNm: firstCase.party_name,
          answer: captchaResult.text,
          fullCsNo: '',
        },
      }),
    });

    const searchData = await searchRes.json();

    if (searchData.errors) {
      console.log(`  ❌ 검색 실패: ${searchData.errors.errorMessage}`);
      continue;
    }

    encCsNoList = searchData?.data?.dlt_csNoHistLst || [];
    console.log(`  ✅ ${encCsNoList.length}개 encCsNo 획득`);

    if (encCsNoList.length > 0) break;
  }

  if (encCsNoList.length === 0) {
    console.log('❌ encCsNo 획득 실패');
    return;
  }

  // encCsNo 확인
  console.log('\n획득된 encCsNo:');
  encCsNoList.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.encCsNo?.substring(0, 30)}... (${item.encCsNo?.length}자)`);
  });

  // 4. 새 세션에서 캡챠 없이 일반내용 조회 테스트
  console.log('\n[4] 새 세션에서 캡챠 없이 일반내용 조회...');

  const testInitRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`, {
    headers: { 'Cookie': `WMONID=${wmonid}` },
  });
  const testCookie = testInitRes.headers.get('set-cookie');
  const testJsession = testCookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  console.log(`새 JSESSIONID: ${testJsession?.substring(0, 20)}...`);

  // 첫 번째 사건으로 테스트
  const testCase = parsedCases[0];
  const testEncCsNo = encCsNoList[0]?.encCsNo;

  if (!testEncCsNo) {
    console.log('❌ 테스트할 encCsNo 없음');
    return;
  }

  const courtCode = COURT_CODES[testCase.court_name] ||
                    (testCase.court_name?.includes('평택') ? '000305' : '000302');

  console.log(`\n테스트: ${testCase.case_number}`);
  console.log(`  법원코드: ${courtCode}`);
  console.log(`  encCsNo: ${testEncCsNo.substring(0, 30)}...`);

  const generalRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
    method: 'POST',
    headers: {
      ...headers,
      'Cookie': `WMONID=${wmonid}; JSESSIONID=${testJsession}`,
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: courtCode,
        csNo: '',
        encCsNo: testEncCsNo,
        csYear: testCase.case_year,
        csDvsCd: testCase.case_type_code,
        csSerial: testCase.case_serial,
        btprtNm: '',
        captchaAnswer: '',
      },
    }),
  });

  const generalData = await generalRes.json();

  if (generalData.errors) {
    console.log(`  ❌ 실패: ${generalData.errors.errorMessage}`);
  } else if (generalData.data) {
    console.log(`  ✅ 성공! 사건명: ${generalData.data.dma_csBasCtt?.csNm}`);
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
