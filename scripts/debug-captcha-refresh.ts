/**
 * 캡챠 새로고침 디버그 스크립트
 * - 캡챠 새로고침 버튼이 제대로 동작하는지 확인
 * - 캡챠 에러 메시지 확인
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
  console.log('=== 캡챠 새로고침 디버그 ===\n');

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

    // 캡챠 관련 요소 확인
    console.log('\n2. 캡챠 관련 요소 확인...');
    const elements = await page.evaluate(() => {
      const result: any = {};

      // 캡챠 이미지
      const captchaImg = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      result.captchaImg = captchaImg ? {
        src: (captchaImg as HTMLImageElement).src?.substring(0, 100),
        found: true,
      } : { found: false };

      // 새로고침 버튼
      const refreshBtn = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
      result.refreshBtn = refreshBtn ? {
        tagName: refreshBtn.tagName,
        id: refreshBtn.id,
        found: true,
      } : { found: false };

      // btn_ 접두사로 시작하는 모든 요소
      const btnElements = Array.from(document.querySelectorAll('[id*="btn_"]'));
      result.allBtnElements = btnElements.slice(0, 10).map((el) => ({
        id: el.id,
        tagName: el.tagName,
      }));

      // 캡챠 입력 필드
      const captchaInput = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer');
      result.captchaInput = captchaInput ? {
        value: (captchaInput as HTMLInputElement).value,
        found: true,
      } : { found: false };

      return result;
    });

    console.log('캡챠 요소:', JSON.stringify(elements, null, 2));

    // 첫 번째 캡챠 이미지 캡처
    console.log('\n3. 첫 번째 캡챠 캡처...');
    const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (captchaElement) {
      const screenshot1 = await captchaElement.screenshot();
      fs.writeFileSync('/tmp/captcha-1st.png', screenshot1);
      console.log('   저장: /tmp/captcha-1st.png');

      const solver = getVisionCaptchaSolver();
      const result1 = await solver.solveCaptcha(Buffer.from(screenshot1));
      console.log(`   인식: "${result1.text}" (신뢰도: ${(result1.confidence * 100).toFixed(1)}%)`);

      // 새로고침 클릭
      console.log('\n4. 새로고침 버튼 클릭...');

      // 버튼 찾기 시도
      const refreshBtn = await page.$('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
      if (refreshBtn) {
        await refreshBtn.click();
        console.log('   클릭 완료');
      } else {
        // 대체 방법: evaluate로 직접 클릭
        const clicked = await page.evaluate(() => {
          const btn = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
          if (btn) {
            (btn as HTMLElement).click();
            return true;
          }
          return false;
        });
        console.log(`   evaluate 클릭: ${clicked}`);
      }

      await new Promise((r) => setTimeout(r, 2000));

      // 두 번째 캡챠 이미지 캡처
      console.log('\n5. 두 번째 캡챠 캡처...');
      const screenshot2 = await captchaElement.screenshot();
      fs.writeFileSync('/tmp/captcha-2nd.png', screenshot2);
      console.log('   저장: /tmp/captcha-2nd.png');

      const result2 = await solver.solveCaptcha(Buffer.from(screenshot2));
      console.log(`   인식: "${result2.text}" (신뢰도: ${(result2.confidence * 100).toFixed(1)}%)`);

      // 비교
      console.log('\n6. 비교:');
      console.log(`   첫 번째: ${result1.text}`);
      console.log(`   두 번째: ${result2.text}`);
      console.log(`   변경됨: ${result1.text !== result2.text ? '예' : '아니오'}`);

      // 검색 폼 입력 및 캡챠 제출 테스트
      console.log('\n7. 검색 폼 입력 및 캡챠 제출 테스트...');
      await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
      await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김');

      // 저장 체크박스 확인
      const isChecked = await page.$eval(
        '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',
        (el: any) => el.checked
      );
      if (!isChecked) {
        await page.click('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0');
      }

      // 새 캡챠 캡처
      console.log('\n8. 최신 캡챠 캡처 및 입력...');
      await new Promise((r) => setTimeout(r, 1000));
      const screenshot3 = await captchaElement.screenshot();
      fs.writeFileSync('/tmp/captcha-3rd.png', screenshot3);
      const result3 = await solver.solveCaptcha(Buffer.from(screenshot3));
      console.log(`   인식: "${result3.text}"`);

      // 캡챠 입력
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result3.text!);

      // 검색 버튼 클릭
      console.log('   검색 버튼 클릭...');
      await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

      await new Promise((r) => setTimeout(r, 5000));

      // 페이지 상태 확인
      console.log('\n9. 페이지 상태 확인...');
      await page.screenshot({ path: '/tmp/after-search.png', fullPage: true });
      console.log('   스크린샷: /tmp/after-search.png');

      const pageState = await page.evaluate(() => {
        const text = document.body.textContent || '';
        const result: any = {
          bodyTextSample: text.substring(0, 500),
          hasCaptchaError: text.includes('보안문자') && text.includes('일치하지'),
          hasNoResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
        };

        // 결과 테이블
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        if (tbody) {
          const rows = tbody.querySelectorAll('tr');
          result.tableRows = rows.length;
          if (rows.length > 0) {
            const firstRow = rows[0];
            const cells = Array.from(firstRow.querySelectorAll('td'));
            result.firstRowCells = cells.map((c) => c.textContent?.trim().substring(0, 30));
          }
        }

        // 에러 모달/알림
        const alerts = document.querySelectorAll('.w2alert, .w2confirm, [class*="alert"], [class*="modal"]');
        result.alertsCount = alerts.length;
        result.alertsContent = Array.from(alerts).slice(0, 3).map((el) => el.textContent?.trim().substring(0, 100));

        return result;
      });

      console.log('페이지 상태:', JSON.stringify(pageState, null, 2));
    }

    console.log('\n완료. 30초 후 브라우저 종료...');
    await new Promise((r) => setTimeout(r, 30000));

  } catch (error) {
    console.error('에러:', error);
    await page.screenshot({ path: '/tmp/debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
