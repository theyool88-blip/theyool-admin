/**
 * 최종 검색 테스트
 * - 당사자명 2글자 이상 필수
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
  console.log('=== 최종 검색 테스트 ===\n');

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
    }

    // 1. 법원 선택 (서울가정법원)
    console.log('2. 서울가정법원 선택...');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', '서울가정법원');
    await new Promise((r) => setTimeout(r, 2000));

    // 2. 검색 폼 입력
    console.log('3. 검색 폼 입력...');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    // 당사자명은 2글자 이상 필수!
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김철');

    console.log('   - 법원: 서울가정법원');
    console.log('   - 연도: 2024');
    console.log('   - 사건구분: 드단');
    console.log('   - 일련번호: 26718');
    console.log('   - 당사자: 김철 (2글자)');

    await new Promise((r) => setTimeout(r, 1000));

    // 3. 캡챠 처리 및 검색 (최대 5회 시도)
    const maxRetries = 5;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
      console.log(`\n4. 캡챠 시도 ${attempt}/${maxRetries}...`);

      // 캡챠 입력 필드 초기화
      await page.$eval('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', (el: any) => el.value = '');

      // 캡챠 인식
      const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
      if (!captchaElement) {
        console.log('   - 캡챠 이미지 없음');
        break;
      }

      const screenshot = await captchaElement.screenshot();
      fs.writeFileSync(`/tmp/final-captcha-${attempt}.png`, screenshot);

      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(Buffer.from(screenshot));
      console.log(`   - Vision API: "${result.text}" (${(result.confidence * 100).toFixed(1)}%)`);

      if (!result.text) {
        console.log('   - 인식 실패, 재시도');
        await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      // 캡챠 입력
      await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

      // 검색 실행
      console.log('   - 검색 실행...');
      await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
      await new Promise((r) => setTimeout(r, 3000));

      // 모달/알림 확인 및 닫기
      const modalClosed = await page.evaluate(() => {
        const confirmBtn = document.querySelector('.w2confirm button, .w2alert button, [class*="modal"] button');
        if (confirmBtn) {
          (confirmBtn as HTMLElement).click();
          return true;
        }
        return false;
      });
      if (modalClosed) {
        console.log('   - 모달 닫음');
        await new Promise((r) => setTimeout(r, 1000));
      }

      // 에러 확인
      const pageState = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return {
          captchaError: text.includes('보안문자') && text.includes('일치하지'),
          noResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
          partyNameError: text.includes('당사자명') && text.includes('2자이상'),
        };
      });

      if (pageState.captchaError) {
        console.log('   - 캡챠 불일치, 재시도');
        await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      if (pageState.partyNameError) {
        console.log('   - 당사자명 오류');
        break;
      }

      // 결과 테이블 확인
      await new Promise((r) => setTimeout(r, 2000));
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

      console.log('   검색 결과:', JSON.stringify(searchResult, null, 2));

      if (searchResult.found && (searchResult.rowCount ?? 0) > 0) {
        console.log('\n✅ 검색 성공!');
        success = true;

        await page.screenshot({ path: '/tmp/search-success-final.png', fullPage: true });
        console.log('   스크린샷: /tmp/search-success-final.png');

        // 첫 번째 결과 클릭하여 상세 보기
        console.log('\n5. 첫 번째 결과 클릭...');
        const clicked = await page.evaluate(() => {
          const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
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
        });

        if (clicked) {
          await new Promise((r) => setTimeout(r, 5000));
          await page.screenshot({ path: '/tmp/case-detail-final.png', fullPage: true });
          console.log('   상세 스크린샷: /tmp/case-detail-final.png');
        }
      } else if (pageState.noResult) {
        console.log('   - 검색 결과 없음 (해당 사건 없음)');
        success = true;  // 캡챠는 성공했으므로 루프 종료
      } else {
        // 결과 확인이 필요할 수 있음
        await page.screenshot({ path: `/tmp/search-attempt-${attempt}.png`, fullPage: true });
        console.log(`   - 스크린샷 저장: /tmp/search-attempt-${attempt}.png`);
      }
    }

    console.log('\n완료. 30초 후 종료...');
    await new Promise((r) => setTimeout(r, 30000));

  } catch (error) {
    console.error('에러:', error);
    await page.screenshot({ path: '/tmp/final-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
