/**
 * 전체 검색 플로우 테스트
 * - Vision API를 우선 사용하는 캡챠 인식
 * - 검색 결과 추출
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

const SELECTORS = {
  yearSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr',
  typeSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd',
  serialInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial',
  partyInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm',
  saveCheckbox: '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',
  captchaImg: '#mf_ssgoTopMainTab_contents_content1_body_img_captcha',
  captchaInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_answer',
  captchaRefresh: '#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha',
  searchButton: '#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs',
  resultTable: '#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody',
};

async function main() {
  console.log('=== 전체 검색 플로우 테스트 ===\n');

  // 프로필 디렉토리
  const profiles = fs.readdirSync(PROFILES_DIR).filter((f) => f.startsWith('profile_'));
  const profileDir = profiles.length > 0
    ? path.join(PROFILES_DIR, profiles[0])
    : path.join(PROFILES_DIR, `profile_${Date.now()}`);

  console.log(`프로필: ${profileDir}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // 1. 페이지 접속
    console.log('1. 대법원 사이트 접속...');
    await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // 2. 검색 폼 입력
    console.log('2. 검색 폼 입력...');
    await page.select(SELECTORS.yearSelect, '2024');
    await page.select(SELECTORS.typeSelect, '드단');
    await page.type(SELECTORS.serialInput, '26718');
    await page.type(SELECTORS.partyInput, '김');

    // 저장 체크박스 확인
    const isChecked = await page.$eval(SELECTORS.saveCheckbox, (el: any) => el.checked);
    if (!isChecked) {
      await page.click(SELECTORS.saveCheckbox);
      console.log('   - 사건 저장 체크박스 선택');
    }

    await new Promise((r) => setTimeout(r, 1000));

    // 3. 캡챠 처리
    console.log('3. 캡챠 인식 및 제출...');
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n   시도 ${attempt}/${maxRetries}:`);

      // 캡챠 이미지 캡처
      const captchaElement = await page.$(SELECTORS.captchaImg);
      if (!captchaElement) {
        console.log('   - 캡챠 이미지를 찾을 수 없음');
        break;
      }

      const screenshot = await captchaElement.screenshot();
      fs.writeFileSync(`/tmp/captcha-attempt-${attempt}.png`, screenshot);
      console.log(`   - 캡챠 이미지 저장: /tmp/captcha-attempt-${attempt}.png`);

      // Vision API로 인식
      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(Buffer.from(screenshot));

      if (!result.success || !result.text) {
        console.log('   - Vision API 인식 실패');
        await page.click(SELECTORS.captchaRefresh);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      console.log(`   - Vision API 인식: "${result.text}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);

      // 캡챠 입력
      await page.$eval(SELECTORS.captchaInput, (el: any) => (el.value = ''));
      await page.type(SELECTORS.captchaInput, result.text);

      // 검색 버튼 클릭
      console.log('   - 검색 버튼 클릭...');
      await page.click(SELECTORS.searchButton);
      await new Promise((r) => setTimeout(r, 3000));

      // 에러 확인
      const pageState = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return {
          hasCaptchaError: text.includes('보안문자') && text.includes('일치하지'),
          hasNoResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
          alertText: document.querySelector('.alert, [role="alert"]')?.textContent?.trim(),
        };
      });

      if (pageState.hasCaptchaError) {
        console.log('   - 캡챠 불일치, 재시도...');
        await page.$eval(SELECTORS.captchaInput, (el: any) => (el.value = ''));
        await page.click(SELECTORS.captchaRefresh);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      // 검색 결과 확인
      console.log('\n4. 검색 결과 확인...');

      // 결과 테이블 대기
      try {
        await page.waitForSelector(SELECTORS.resultTable + ' tr', { timeout: 5000 });
      } catch (e) {
        console.log('   - 결과 테이블 행 없음 (타임아웃)');
      }

      const tableInfo = await page.evaluate((selector) => {
        const tbody = document.querySelector(selector);
        if (!tbody) return { found: false };

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const rowsData = rows.map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          return cells.map((cell) => cell.textContent?.trim().substring(0, 50));
        });

        return {
          found: true,
          rowCount: rows.length,
          rowsData: rowsData.slice(0, 5),
        };
      }, SELECTORS.resultTable);

      console.log('   결과 테이블:', JSON.stringify(tableInfo, null, 2));

      if (tableInfo.found && (tableInfo.rowCount ?? 0) > 0) {
        console.log('\n✅ 검색 성공!');

        // 스크린샷 저장
        await page.screenshot({ path: '/tmp/search-success.png', fullPage: true });
        console.log('   스크린샷 저장: /tmp/search-success.png');

        // 첫 번째 결과 클릭
        console.log('\n5. 첫 번째 결과 클릭하여 일반내용 조회...');
        const clicked = await page.evaluate((selector) => {
          const tbody = document.querySelector(selector);
          if (!tbody) return false;

          const firstRow = tbody.querySelector('tr');
          if (!firstRow) return false;

          const link = firstRow.querySelector('a');
          if (link) {
            link.click();
            return true;
          }

          (firstRow as HTMLElement).click();
          return true;
        }, SELECTORS.resultTable);

        if (clicked) {
          await new Promise((r) => setTimeout(r, 5000));
          await page.screenshot({ path: '/tmp/case-general.png', fullPage: true });
          console.log('   일반내용 탭 화면 스크린샷: /tmp/case-general.png');
        }

        break;
      } else {
        console.log('   - 결과 없음');
        if (pageState.hasNoResult) {
          console.log('   - "검색결과가 없습니다" 메시지');
        }
      }
    }

    console.log('\n테스트 완료. 30초 후 브라우저 종료...');
    await new Promise((r) => setTimeout(r, 30000));

  } catch (error) {
    console.error('에러:', error);
    await page.screenshot({ path: '/tmp/test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
