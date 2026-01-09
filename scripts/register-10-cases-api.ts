/**
 * 10개 사건 API로 등록 및 캡챠 없이 일반내용 조회 테스트
 *
 * 1. legal_cases에서 10개 사건 조회
 * 2. 각 사건: 캡챠 해결 → csNoHistLst로 64자 encCsNo 획득
 * 3. DB에 WMONID + encCsNo 저장
 * 4. 저장된 encCsNo로 캡챠 없이 일반내용 조회 테스트
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

// 법원코드 매핑
const COURT_CODES: Record<string, string> = {
  '수원가정법원': '000302',
  '수원가정': '000302',
  '수원법원': '000302',
  '서울가정법원': '000201',
  '인천가정법원': '000401',
  '평택지원': '000305',
  '평택가정': '000305',
  '수원가정법원 평택지원': '000305',
  '성남지원': '000303',
  '여주지원': '000304',
  '안양지원': '000306',
  '안산지원': '000322',
};

// 사건유형 매핑
const CASE_TYPE_CODES: Record<string, string> = {
  '드단': '150',
  '드합': '151',
  '느단': '140',
  '느합': '141',
};

interface CaseInfo {
  id: string;
  case_number: string;
  court_name: string;
  case_year: string;
  case_type: string;
  case_serial: string;
  party_name: string;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 10개 사건 API 등록 테스트');
  console.log('='.repeat(60));

  // 1. legal_cases에서 가사 사건 10개 조회
  console.log('\n[Step 1] 등록할 사건 조회...');

  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, court_name, case_type, plaintiffs, defendants')
    .or('court_case_number.ilike.%드단%,court_case_number.ilike.%드합%,court_case_number.ilike.%느단%,court_case_number.ilike.%느합%')
    .not('court_case_number', 'is', null)
    .limit(10);

  if (error || !cases?.length) {
    console.log('❌ 사건 조회 실패:', error?.message);
    return;
  }

  console.log(`✅ ${cases.length}개 사건 조회됨`);

  // 사건 정보 파싱
  const parsedCases: CaseInfo[] = cases.map(c => {
    // 사건번호 파싱: 2024드단26718
    const match = c.court_case_number?.match(/(\d{4})([가-힣]+)(\d+)/);
    const plaintiffs = c.plaintiffs as any[] || [];
    const defendants = c.defendants as any[] || [];
    const partyName = plaintiffs?.[0]?.name?.substring(0, 1) ||
                      defendants?.[0]?.name?.substring(0, 1) || '김';

    return {
      id: c.id,
      case_number: c.court_case_number,
      court_name: c.court_name || '수원가정법원',
      case_year: match?.[1] || '2024',
      case_type: match?.[2] || '드단',
      case_serial: match?.[3] || '',
      party_name: partyName,
    };
  }).filter(c => c.case_serial);

  console.log(`\n등록 대상 ${parsedCases.length}개:`);
  parsedCases.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.case_number} (${c.court_name})`);
  });

  // 2. WMONID 발급
  console.log('\n[Step 2] WMONID 발급...');

  const initRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`);
  const setCookie = initRes.headers.get('set-cookie');
  const wmonid = setCookie?.match(/WMONID=([^;]+)/)?.[1];
  const jsessionId = setCookie?.match(/JSESSIONID=([^;]+)/)?.[1];
  const expiresMatch = setCookie?.match(/Expires=([^;]+)/);

  if (!wmonid || !jsessionId) {
    console.log('❌ 세션 생성 실패');
    return;
  }

  const issuedAt = new Date();
  const expiresAt = expiresMatch ? new Date(expiresMatch[1]) : new Date(issuedAt.getTime() + 2 * 365 * 24 * 60 * 60 * 1000);

  console.log(`✅ WMONID: ${wmonid}`);
  console.log(`   만료일: ${expiresAt.toISOString()}`);

  // WMONID를 DB에 저장 (테스트용 - user_id 없이)
  const { data: wmonidRecord, error: wmonidError } = await supabase
    .from('scourt_user_wmonid')
    .insert({
      user_id: null,  // 테스트용
      wmonid: wmonid,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .select()
    .single();

  if (wmonidError) {
    console.log('⚠️ WMONID DB 저장 실패 (계속 진행):', wmonidError.message);
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=UTF-8',
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${jsessionId}`,
    'Origin': SCOURT_BASE_URL,
    'Referer': `${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`,
  };

  // 3. 각 사건 등록
  console.log('\n[Step 3] 사건 등록 시작...');

  const registeredCases: Array<{
    case_number: string;
    wmonid: string;
    enc_cs_no: string;
    court_code: string;
    case_type_code: string;
  }> = [];

  const solver = getVisionCaptchaSolver();

  for (let i = 0; i < parsedCases.length; i++) {
    const caseInfo = parsedCases[i];
    console.log(`\n[${i + 1}/${parsedCases.length}] ${caseInfo.case_number}`);

    // csNoHistLst 형식: 연도(4)+유형코드(3)+일련번호(7) = 14자
    const caseTypeCode = CASE_TYPE_CODES[caseInfo.case_type] || '150';
    const csNoHistLst = `${caseInfo.case_year}${caseTypeCode}${caseInfo.case_serial.padStart(7, '0')}`;

    let success = false;
    let encCsNo = '';

    // 최대 5번 재시도
    for (let attempt = 1; attempt <= 5 && !success; attempt++) {
      console.log(`  시도 ${attempt}/5...`);

      // 캡챠 획득
      const captchaRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/getCaptchaInf.on`, {
        method: 'POST',
        headers,
        body: '',
      });
      const captchaData = await captchaRes.json();
      const captchaImage = captchaData?.data?.dma_captchaInf?.image;

      if (!captchaImage) {
        console.log('  ⚠️ 캡챠 획득 실패');
        continue;
      }

      // 캡챠 인식
      const imageBuffer = Buffer.from(captchaImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const captchaResult = await solver.solveCaptcha(imageBuffer);

      if (!captchaResult.text) {
        console.log('  ⚠️ 캡챠 인식 실패');
        continue;
      }

      console.log(`  캡챠: ${captchaResult.text}`);

      // 검색 (csNoHistLst 포함)
      const searchRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo10l/selectHmpgMain.on`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dma_search: {
            cortCd: caseInfo.court_name,
            cdScope: 'ALL',
            csNoHistLst: csNoHistLst,
            csDvsCd: caseInfo.case_type,
            csYr: caseInfo.case_year,
            csSerial: caseInfo.case_serial,
            btprNm: caseInfo.party_name,
            answer: captchaResult.text,
            fullCsNo: '',
          },
        }),
      });

      const searchData = await searchRes.json();

      if (searchData.errors) {
        console.log(`  ⚠️ 검색 실패: ${searchData.errors.errorMessage}`);
        continue;
      }

      encCsNo = searchData?.data?.dlt_csNoHistLst?.[0]?.encCsNo;

      if (encCsNo && encCsNo.length === 64) {
        success = true;
        console.log(`  ✅ encCsNo 획득 (${encCsNo.length}자)`);
      } else {
        console.log(`  ⚠️ encCsNo 없음 또는 짧음 (${encCsNo?.length || 0}자)`);
      }
    }

    if (success) {
      registeredCases.push({
        case_number: caseInfo.case_number,
        wmonid: wmonid,
        enc_cs_no: encCsNo,
        court_code: COURT_CODES[caseInfo.court_name] || '000302',
        case_type_code: caseTypeCode,
      });

      // DB에 저장
      const { error: insertError } = await supabase
        .from('scourt_profile_cases')
        .upsert({
          legal_case_id: caseInfo.id,
          case_number: caseInfo.case_number,
          court_name: caseInfo.court_name,
          court_code: COURT_CODES[caseInfo.court_name] || '000302',
          enc_cs_no: encCsNo,
          wmonid: wmonid,
          user_wmonid_id: wmonidRecord?.id || null,
        }, {
          onConflict: 'legal_case_id',
          ignoreDuplicates: false,
        });

      if (insertError) {
        console.log(`  ⚠️ DB 저장 실패: ${insertError.message}`);
      }
    } else {
      console.log(`  ❌ 등록 실패`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  // 4. 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log(`📊 등록 결과: ${registeredCases.length}/${parsedCases.length} 성공`);
  console.log('='.repeat(60));

  if (registeredCases.length === 0) {
    console.log('❌ 등록된 사건 없음');
    return;
  }

  // 5. 캡챠 없이 일반내용 조회 테스트
  console.log('\n[Step 4] 캡챠 없이 일반내용 조회 테스트...');

  // 새 세션 (같은 WMONID)
  const testInitRes = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`, {
    headers: { 'Cookie': `WMONID=${wmonid}` },
  });
  const testCookie = testInitRes.headers.get('set-cookie');
  const testJsession = testCookie?.match(/JSESSIONID=([^;]+)/)?.[1];

  const testHeaders = {
    ...headers,
    'Cookie': `WMONID=${wmonid}; JSESSIONID=${testJsession}`,
  };

  let successCount = 0;

  for (const rc of registeredCases) {
    console.log(`\n테스트: ${rc.case_number}`);

    // 사건번호에서 연도, 일련번호 추출
    const caseMatch = rc.case_number.match(/(\d{4})[가-힣]+(\d+)/);
    const csYear = caseMatch?.[1] || '2024';
    const csSerial = caseMatch?.[2] || '';

    const generalRes = await fetch(`${SCOURT_BASE_URL}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        dma_search: {
          cortCd: rc.court_code,
          csNo: '',
          encCsNo: rc.enc_cs_no,
          csYear: csYear,
          csDvsCd: rc.case_type_code,
          csSerial: csSerial,
          btprtNm: '',
          captchaAnswer: '',  // 캡챠 없이!
        },
      }),
    });

    const generalData = await generalRes.json();

    if (generalData.errors) {
      console.log(`  ❌ 실패: ${generalData.errors.errorMessage}`);
    } else if (generalData.data) {
      const caseName = generalData.data.dma_csBasCtt?.csNm || '성공';
      console.log(`  ✅ 성공! 사건명: ${caseName}`);
      successCount++;
    }
  }

  // 최종 결과
  console.log('\n' + '='.repeat(60));
  console.log('📋 최종 결과');
  console.log('='.repeat(60));
  console.log(`등록: ${registeredCases.length}/${parsedCases.length}`);
  console.log(`캡챠 없이 조회: ${successCount}/${registeredCases.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
