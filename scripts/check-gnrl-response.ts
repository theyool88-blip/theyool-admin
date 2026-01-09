/**
 * 일반내용 API 응답 전체 필드 확인
 * - dlt_prcdRslt가 있는지, 어떤 데이터인지 확인
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin 클라이언트 (서비스 롤 키 사용)
const supabaseUrl = 'https://kqqyipnlkmmprfgygauk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcXlpcG5sa21tcHJmZ3lnYXVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMyNDQyOSwiZXhwIjoyMDc3OTAwNDI5fQ.nmE-asCNpDnxix4ZxyNlEyocJdG8kPEunx9MHOTnXS0';
const createAdminClient = () => createClient(supabaseUrl, supabaseKey);

const BASE_URL = 'https://ssgo.scourt.go.kr';

const defaultHeaders = {
  'Accept': 'application/json',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json;charset=UTF-8',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://ssgo.scourt.go.kr',
  'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
};

async function main() {
  const legalCaseId = 'eb6110f1-4ee4-4f46-996a-49bff500401c';
  const caseNumber = '2025드단20513';

  console.log('='.repeat(60));
  console.log('일반내용 API 응답 전체 필드 확인');
  console.log('='.repeat(60));

  const supabase = createAdminClient();

  const { data: legalCase, error } = await supabase
    .from('legal_cases')
    .select('*, enc_cs_no, scourt_wmonid, court_name')
    .eq('id', legalCaseId)
    .single();

  if (error || !legalCase || !legalCase.enc_cs_no || !legalCase.scourt_wmonid) {
    console.error('사건 조회 실패');
    return;
  }

  const match = caseNumber.match(/(\d{4})([가-힣]+)(\d+)/);
  if (!match) return;
  const [, csYear, csDvsNm, csSerial] = match;

  const courtCodes: Record<string, string> = {
    '수원가정법원': '000302', '수원가정': '000302',
    '수원가정법원 평택지원': '000305', '평택가정': '000305',
  };
  const caseTypeCodes: Record<string, string> = {
    '드단': '150', '드합': '151', '느단': '140', '르': '160',
  };

  const cortCd = courtCodes[legalCase.court_name] || legalCase.court_name;
  const csDvsCd = caseTypeCodes[csDvsNm] || csDvsNm;

  console.log(`\n사건: ${caseNumber}, 법원: ${cortCd}, 유형: ${csDvsCd}`);
  console.log(`encCsNo: ${legalCase.enc_cs_no.substring(0, 30)}...`);
  console.log(`wmonid: ${legalCase.scourt_wmonid}`);

  // 1. 세션 초기화
  console.log('\n🔐 세션 초기화...');
  const initRes = await fetch(`${BASE_URL}/ssgo/index.on?cortId=www`, {
    method: 'GET',
    headers: {
      'Accept': 'text/html',
      'User-Agent': defaultHeaders['User-Agent'],
      'Cookie': `WMONID=${legalCase.scourt_wmonid}`,
    },
    redirect: 'follow',
  });

  const setCookie = initRes.headers.get('set-cookie');
  const jsessionMatch = setCookie?.match(/JSESSIONID=([^;]+)/);
  if (!jsessionMatch) {
    console.error('세션 획득 실패');
    return;
  }
  const jsessionId = jsessionMatch[1];
  const cookieHeader = `WMONID=${legalCase.scourt_wmonid}; JSESSIONID=${jsessionId}`;

  // 2. 일반내용 API 호출
  console.log('\n📋 일반내용 API 호출...');
  const gnrlRes = await fetch(`${BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Cookie': cookieHeader,
      'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
    },
    body: JSON.stringify({
      dma_search: {
        cortCd: cortCd,
        csNo: '',
        encCsNo: legalCase.enc_cs_no,
        csYear,
        csDvsCd,
        csSerial,
        btprtNm: '',
        captchaAnswer: '',
      },
    }),
  });

  const gnrlData = await gnrlRes.json();

  if (gnrlData.error || gnrlData.errors?.errorMessage) {
    console.log('❌ 일반내용 실패:', gnrlData.error || gnrlData.errors?.errorMessage);
    return;
  }

  // 3. 응답 전체 필드 출력
  console.log('\n✅ 일반내용 API 성공');
  console.log('\n' + '='.repeat(60));
  console.log('📦 응답 필드 목록:');
  console.log('='.repeat(60));

  const dataKeys = Object.keys(gnrlData.data || {});
  console.log(dataKeys.join('\n'));

  // 4. 각 필드 구조 확인
  console.log('\n' + '='.repeat(60));
  console.log('📋 각 필드 구조:');
  console.log('='.repeat(60));

  for (const key of dataKeys) {
    const value = gnrlData.data[key];
    if (Array.isArray(value)) {
      console.log(`\n${key}: (배열, ${value.length}건)`);
      if (value.length > 0) {
        console.log(`  첫번째 항목 키: ${Object.keys(value[0]).join(', ')}`);
        // 첫 2개만 출력
        value.slice(0, 2).forEach((item: any, i: number) => {
          console.log(`  [${i}] ${JSON.stringify(item).substring(0, 200)}`);
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      console.log(`\n${key}: (객체)`);
      console.log(`  키: ${Object.keys(value).join(', ')}`);
      console.log(`  값: ${JSON.stringify(value).substring(0, 300)}`);
    } else {
      console.log(`\n${key}: ${value}`);
    }
  }

  // 5. 특히 진행 관련 필드 찾기
  console.log('\n' + '='.repeat(60));
  console.log('🔍 진행/결과 관련 필드 검색:');
  console.log('='.repeat(60));

  const progressKeys = dataKeys.filter(k =>
    k.includes('prcd') || k.includes('prgr') || k.includes('prog') ||
    k.includes('rslt') || k.includes('Rslt') || k.includes('evnt')
  );

  if (progressKeys.length > 0) {
    console.log('발견된 키:', progressKeys.join(', '));
    for (const key of progressKeys) {
      console.log(`\n${key}:`);
      console.log(JSON.stringify(gnrlData.data[key], null, 2).substring(0, 1000));
    }
  } else {
    console.log('진행/결과 관련 필드 없음');
  }
}

main().catch(console.error);
