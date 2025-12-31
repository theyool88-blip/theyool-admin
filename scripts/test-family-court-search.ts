/**
 * 가정법원 선택 후 사건 구분 확인
 * - 법원을 먼저 선택하면 사건 구분 옵션이 변경됨
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
  console.log('=== 가정법원 선택 후 검색 테스트 ===\n');

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
    await new Promise((r) => setTimeout(r, 3000));

    // 저장 체크박스
    const isChecked = await page.$eval(
      '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',
      (el: any) => el.checked
    );
    if (!isChecked) {
      await page.click('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0');
      console.log('   - 사건 저장 체크');
    }

    // 1. 먼저 법원 선택 (서울가정법원)
    console.log('\n2. 서울가정법원 선택...');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '서울가정법원');
    await new Promise((r) => setTimeout(r, 2000));  // 옵션 로드 대기

    // 사건 구분 옵션 다시 확인
    console.log('\n3. 가정법원 선택 후 사건 구분 옵션...');
    const caseTypeOptions = await page.evaluate(() => {
      const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
      if (!select) return [];
      return Array.from(select.options).map((opt) => ({
        value: opt.value,
        text: opt.text,
      }));
    });

    // "드" 관련 옵션 찾기
    const drOptions = caseTypeOptions.filter((opt) =>
      opt.value.startsWith('드') || opt.text.startsWith('드')
    );
    console.log('"드" 관련 옵션:');
    drOptions.forEach((opt) => console.log(`  ${opt.value}: ${opt.text}`));

    // 모든 옵션 출력
    console.log('\n모든 사건 구분 옵션:');
    caseTypeOptions.slice(0, 30).forEach((opt) => console.log(`  ${opt.value}: ${opt.text}`));
    if (caseTypeOptions.length > 30) {
      console.log(`  ... 외 ${caseTypeOptions.length - 30}개`);
    }

    // 드단 찾기
    const ddanOption = caseTypeOptions.find((opt) =>
      opt.value === '드단' || opt.text === '드단'
    );

    if (ddanOption) {
      console.log(`\n✅ 드단 옵션 발견: ${JSON.stringify(ddanOption)}`);

      // 검색 폼 입력
      console.log('\n4. 검색 폼 입력...');
      await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
      await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', ddanOption.value);
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김');

      console.log('   - 법원: 서울가정법원');
      console.log('   - 연도: 2024');
      console.log(`   - 사건구분: ${ddanOption.value}`);
      console.log('   - 일련번호: 26718');
      console.log('   - 당사자: 김');

      await new Promise((r) => setTimeout(r, 1000));

      // 캡챠 인식
      console.log('\n5. 캡챠 인식...');
      const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      if (captchaElement) {
        const screenshot = await captchaElement.screenshot();
        const solver = getVisionCaptchaSolver();
        const result = await solver.solveCaptcha(Buffer.from(screenshot));
        console.log(`   - Vision API: "${result.text}" (${(result.confidence * 100).toFixed(1)}%)`);

        if (result.text) {
          await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

          console.log('\n6. 검색 실행...');
          await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
          await new Promise((r) => setTimeout(r, 5000));

          // 스크린샷 저장
          await page.screenshot({ path: '/tmp/family-court-result.png', fullPage: true });
          console.log('   스크린샷: /tmp/family-court-result.png');

          // 결과 확인
          const searchResult = await page.evaluate(() => {
            const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
            if (!tbody) return { found: false };

            const rows = Array.from(tbody.querySelectorAll('tr'));
            return {
              found: true,
              rowCount: rows.length,
              rows: rows.slice(0, 5).map((row) => {
                const cells = Array.from(row.querySelectorAll('td'));
                return cells.map((c) => c.textContent?.trim());
              }),
            };
          });

          console.log('\n검색 결과:', JSON.stringify(searchResult, null, 2));

          // 에러 확인
          const errors = await page.evaluate(() => {
            const text = document.body.textContent || '';
            return {
              captchaError: text.includes('보안문자') && text.includes('일치하지'),
              noResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
            };
          });
          console.log('에러:', errors);
        }
      }
    } else {
      console.log('\n❌ 드단 옵션을 찾을 수 없습니다.');
      console.log('   다른 사건 유형으로 테스트해보세요.');
    }

    console.log('\n30초 후 종료...');
    await new Promise((r) => setTimeout(r, 30000));

  } catch (error) {
    console.error('에러:', error);
    await page.screenshot({ path: '/tmp/family-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
