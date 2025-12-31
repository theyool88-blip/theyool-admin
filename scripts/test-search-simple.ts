/**
 * 대법원 사건 검색 간단 테스트
 *
 * npx tsx scripts/test-search-simple.ts [연도] [구분] [일련번호] [당사자명]
 * 예: npx tsx scripts/test-search-simple.ts 2024 드단 26718 김
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');
const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';

const SELECTORS = {
  courtSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd',
  yearSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr',
  typeSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd',
  serialInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial',
  partyInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm',
  saveCheckbox: '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',
  captchaImg: '#mf_ssgoTopMainTab_contents_content1_body_tbx_captchaImg img',
  captchaInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_answer',
  captchaRefresh: '#mf_ssgoTopMainTab_contents_content1_body_btn_refreshCaptcha',
  searchButton: '#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs',
  savedCasesTable: '#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody',
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getOrCreateProfile() {
  // 프로필 디렉토리 생성
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }

  // 기존 프로필 조회
  const { data: existingProfile } = await supabase
    .from('scourt_profiles')
    .select('*')
    .eq('status', 'active')
    .order('case_count', { ascending: true })
    .limit(1)
    .single();

  if (existingProfile && existingProfile.case_count < existingProfile.max_cases) {
    return {
      id: existingProfile.id,
      profileName: existingProfile.profile_name,
      userDataDir: path.join(PROFILES_DIR, existingProfile.profile_name),
      caseCount: existingProfile.case_count,
      maxCases: existingProfile.max_cases,
    };
  }

  // 새 프로필 생성
  const profileName = `profile_${Date.now()}`;
  const { data: newProfile, error } = await supabase
    .from('scourt_profiles')
    .insert({
      profile_name: profileName,
      case_count: 0,
      max_cases: 50,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`프로필 생성 실패: ${error.message}`);
  }

  return {
    id: newProfile.id,
    profileName: newProfile.profile_name,
    userDataDir: path.join(PROFILES_DIR, newProfile.profile_name),
    caseCount: newProfile.case_count,
    maxCases: newProfile.max_cases,
  };
}

async function solveCaptchaWithVision(imageBuffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.log('   ⚠️  GOOGLE_AI_API_KEY 없음');
    return null;
  }

  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: '이 이미지에서 6자리 숫자만 추출해주세요. 숫자만 응답하세요.'
              },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: base64Image
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\d{6}/);
    return match ? match[0] : null;
  } catch (error) {
    console.error('Vision API 에러:', error);
    return null;
  }
}

async function testSearch() {
  const args = process.argv.slice(2);

  const caseYear = args[0] || '2024';
  const caseType = args[1] || '드단';
  const caseSerial = args[2] || '26718';
  const partyName = args[3] || '김';

  console.log('🧪 대법원 사건 검색 테스트\n');
  console.log(`📋 검색 조건: ${caseYear}${caseType}${caseSerial} (당사자: ${partyName})\n`);

  let browser: Browser | null = null;

  try {
    // 1. 프로필 조회/생성
    console.log('1️⃣ 프로필 조회/생성...');
    const profile = await getOrCreateProfile();
    console.log(`   ✅ 프로필: ${profile.profileName}`);
    console.log(`   📊 사용량: ${profile.caseCount}/${profile.maxCases}건`);
    console.log(`   📁 경로: ${profile.userDataDir}\n`);

    // 2. 브라우저 시작
    console.log('2️⃣ 브라우저 시작...');
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir: profile.userDataDir,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    console.log('   ✅ 브라우저 시작됨\n');

    // 3. 대법원 사이트 접속
    console.log('3️⃣ 대법원 사이트 접속...');
    await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    console.log('   ✅ 사이트 로드됨\n');

    // 4. 검색 폼 입력
    console.log('4️⃣ 검색 폼 입력...');

    // 저장 체크박스 확인
    const isChecked = await page.$eval(SELECTORS.saveCheckbox, (el: any) => el.checked).catch(() => false);
    if (!isChecked) {
      await page.click(SELECTORS.saveCheckbox).catch(() => {});
    }

    // 연도 선택
    await page.select(SELECTORS.yearSelect, caseYear).catch(() => {
      console.log('   ⚠️  연도 선택 실패, 직접 입력 시도...');
    });
    await wait(300);

    // 사건 구분 선택
    await page.select(SELECTORS.typeSelect, caseType).catch(() => {
      console.log('   ⚠️  구분 선택 실패');
    });
    await wait(300);

    // 일련번호 입력
    await page.type(SELECTORS.serialInput, caseSerial);

    // 당사자명 입력
    await page.type(SELECTORS.partyInput, partyName);

    console.log('   ✅ 폼 입력 완료\n');

    // 5. 캡챠 인식 및 검색
    console.log('5️⃣ 캡챠 인식 시도...');

    for (let attempt = 1; attempt <= 10; attempt++) {
      console.log(`   🔄 시도 ${attempt}/10...`);

      // 캡챠 이미지 캡처
      const captchaElement = await page.$(SELECTORS.captchaImg);
      if (!captchaElement) {
        console.log('   ❌ 캡챠 이미지를 찾을 수 없습니다');
        break;
      }

      const screenshot = await captchaElement.screenshot();
      const imageBuffer = Buffer.from(screenshot);

      // Vision API로 인식
      const captchaText = await solveCaptchaWithVision(imageBuffer);

      if (!captchaText) {
        console.log('   ❌ 캡챠 인식 실패');
        // 새로고침
        await page.click(SELECTORS.captchaRefresh).catch(() => {});
        await wait(1500);
        continue;
      }

      console.log(`   👁️ 인식 결과: "${captchaText}"`);

      // 캡챠 입력 필드 초기화 및 입력
      await page.$eval(SELECTORS.captchaInput, (el: any) => el.value = '');
      await page.type(SELECTORS.captchaInput, captchaText);

      // 검색 버튼 클릭
      await page.click(SELECTORS.searchButton);
      await wait(3000);

      // 에러 확인
      const hasError = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('보안문자') && text.includes('일치하지');
      });

      if (hasError) {
        console.log('   ❌ 캡챠 불일치, 재시도...');
        await page.$eval(SELECTORS.captchaInput, (el: any) => el.value = '');
        await page.click(SELECTORS.captchaRefresh).catch(() => {});
        await wait(1500);
        continue;
      }

      // 성공 확인 - 테이블에 결과가 있는지
      const result = await page.evaluate((selector) => {
        const tbody = document.querySelector(selector);
        if (!tbody) return null;
        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return null;
        const cells = Array.from(firstRow.querySelectorAll('td'));
        return {
          court: cells[2]?.textContent?.trim() || '',
          caseNumber: cells[3]?.textContent?.trim() || '',
          caseName: cells[4]?.textContent?.trim() || '',
        };
      }, SELECTORS.savedCasesTable);

      if (result && result.caseNumber) {
        console.log('\n✅ 검색 성공!');
        console.log(`   법원: ${result.court}`);
        console.log(`   사건번호: ${result.caseNumber}`);
        console.log(`   사건명: ${result.caseName}`);
        console.log(`   캡챠 시도: ${attempt}회`);

        // DB에 저장
        await supabase.from('scourt_profile_cases').upsert({
          profile_id: profile.id,
          court_name: result.court,
          case_number: result.caseNumber,
          case_name: result.caseName,
          last_accessed_at: new Date().toISOString(),
        }, { onConflict: 'profile_id,case_number' });

        console.log('\n   📁 DB에 저장됨');
        break;
      }

      console.log('   ⚠️  결과 없음, 재시도...');
      await page.click(SELECTORS.captchaRefresh).catch(() => {});
      await wait(1500);
    }

    // 30초 대기
    console.log('\n⏳ 30초 후 브라우저 종료 (결과 확인용)...');
    await wait(30000);

  } catch (error) {
    console.error('\n❌ 에러:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('✅ 브라우저 종료됨');
    }
  }
}

testSearch();
