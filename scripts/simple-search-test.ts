/**
 * 간단한 검색 테스트
 * - 네비게이션 처리 포함
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

async function main() {
  console.log('=== 간단한 검색 테스트 ===\n');

  const profiles = fs.readdirSync(PROFILES_DIR).filter((f) => f.startsWith('profile_'));
  const profileDir = profiles.length > 0
    ? path.join(PROFILES_DIR, profiles[0])
    : path.join(PROFILES_DIR, `profile_${Date.now()}`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('1. 페이지 접속...');
    await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // 저장 체크박스
    await page.click('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0');
    console.log('   - 사건 저장 체크');

    // 법원 선택
    console.log('2. 서울가정법원 선택...');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '서울가정법원');
    await sleep(2000);

    // 검색 폼 입력
    console.log('3. 검색 폼 입력...');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '홍길동');  // 2글자 이상
    console.log('   - 2024드단26718, 당사자: 홍길동');
    await sleep(1000);

    // 캡챠 인식
    console.log('\n4. 캡챠 인식...');
    const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (!captchaElement) {
      console.log('   - 캡챠 이미지 없음');
      return;
    }

    const screenshot = await captchaElement.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(Buffer.from(screenshot));
    console.log(`   - Vision API: "${result.text}" (${(result.confidence * 100).toFixed(1)}%)`);

    if (!result.text) {
      console.log('   - 인식 실패');
      return;
    }

    // 캡챠 입력
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);
    console.log('   - 캡챠 입력 완료');

    // 검색 버튼 클릭 (네비게이션 대기 포함)
    console.log('\n5. 검색 실행...');

    // 네비게이션 감지 설정
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null);

    await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    console.log('   - 검색 버튼 클릭됨');

    // 네비게이션 또는 타임아웃 대기
    await Promise.race([
      navigationPromise,
      sleep(5000),
    ]);

    console.log('   - 대기 완료');

    // 현재 URL 확인
    const currentUrl = page.url();
    console.log(`   - 현재 URL: ${currentUrl}`);

    // 스크린샷 저장
    await page.screenshot({ path: '/tmp/simple-search-result.png', fullPage: true });
    console.log('   - 스크린샷: /tmp/simple-search-result.png');

    // 페이지 내용 확인
    const pageContent = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return {
        hasResult: text.includes('검색결과') || text.includes('사건명'),
        hasError: text.includes('보안문자') && text.includes('일치하지'),
        hasNoResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
        bodyPreview: text.substring(0, 500),
      };
    });

    console.log('\n6. 결과 확인:');
    console.log(`   - 결과 있음: ${pageContent.hasResult}`);
    console.log(`   - 캡챠 에러: ${pageContent.hasError}`);
    console.log(`   - 검색결과 없음: ${pageContent.hasNoResult}`);

    // 결과 테이블 확인
    const tableResult = await page.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      if (!tbody) return { found: false };

      const rows = Array.from(tbody.querySelectorAll('tr'));
      return {
        found: true,
        rowCount: rows.length,
        firstRowText: rows[0] ? rows[0].textContent?.trim().substring(0, 100) : null,
      };
    });

    console.log('\n7. 테이블 결과:');
    console.log(JSON.stringify(tableResult, null, 2));

    console.log('\n브라우저를 열어둡니다. 60초 후 종료...');
    await sleep(60000);

  } catch (error) {
    console.error('에러:', error);
    try {
      await page.screenshot({ path: '/tmp/simple-search-error.png', fullPage: true });
    } catch (e) {
      console.log('스크린샷 저장 실패');
    }
  } finally {
    await browser.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(console.error);
