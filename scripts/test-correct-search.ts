/**
 * 올바른 검색 파라미터로 테스트
 * - 법원 선택
 * - 사건 구분 확인
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
  console.log('=== 올바른 검색 파라미터 테스트 ===\n');

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

    // 사건 구분 옵션 확인
    console.log('\n2. 사건 구분 옵션 확인...');
    const caseTypeOptions = await page.evaluate(() => {
      const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
      if (!select) return [];
      return Array.from(select.options).map((opt) => ({
        value: opt.value,
        text: opt.text,
      }));
    });
    console.log('사건 구분 옵션들:');
    caseTypeOptions.forEach((opt) => {
      console.log(`  ${opt.value}: ${opt.text}`);
    });

    // 드단 찾기
    const ddanOption = caseTypeOptions.find((opt) => opt.text.includes('드단') || opt.value === '드단');
    console.log(`\n드단 옵션: ${ddanOption ? JSON.stringify(ddanOption) : '없음'}`);

    // 법원 옵션 확인
    console.log('\n3. 법원 옵션 확인...');
    const courtOptions = await page.evaluate(() => {
      const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd') as HTMLSelectElement;
      if (!select) return [];
      return Array.from(select.options).slice(0, 20).map((opt) => ({
        value: opt.value,
        text: opt.text,
      }));
    });
    console.log('법원 옵션 (일부):');
    courtOptions.forEach((opt) => {
      console.log(`  ${opt.value}: ${opt.text}`);
    });

    // 서울가정법원 찾기
    const familyCourtOption = courtOptions.find((opt) =>
      opt.text.includes('가정법원') || opt.text.includes('서울가정')
    );
    console.log(`\n서울가정법원 옵션: ${familyCourtOption ? JSON.stringify(familyCourtOption) : '없음'}`);

    // 검색 폼 입력 (올바른 값으로)
    console.log('\n4. 검색 폼 입력...');

    // 저장 체크박스
    const isChecked = await page.$eval(
      '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',
      (el: any) => el.checked
    );
    if (!isChecked) {
      await page.click('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0');
      console.log('   - 사건 저장 체크');
    }

    // 연도 선택
    await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2024');
    console.log('   - 연도: 2024');
    await new Promise((r) => setTimeout(r, 500));

    // 사건 구분 선택 - value로 선택
    if (ddanOption) {
      await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', ddanOption.value);
      console.log(`   - 사건구분: ${ddanOption.value} (${ddanOption.text})`);
    } else {
      // 드단이 없으면 다른 방식으로 시도
      console.log('   - 드단 옵션이 없음. 직접 입력 시도...');
      await page.evaluate(() => {
        const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
        if (select) {
          // 모든 옵션 중에서 "드단" 포함된 것 찾기
          for (const opt of Array.from(select.options)) {
            if (opt.text.includes('드단')) {
              select.value = opt.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      });
    }
    await new Promise((r) => setTimeout(r, 500));

    // 현재 선택된 값 확인
    const selectedType = await page.$eval(
      '#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd',
      (el: any) => ({ value: el.value, text: el.options[el.selectedIndex]?.text })
    );
    console.log(`   - 실제 선택된 값: ${selectedType.value} (${selectedType.text})`);

    // 일련번호
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '26718');
    console.log('   - 일련번호: 26718');

    // 당사자명
    await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김');
    console.log('   - 당사자명: 김');

    await new Promise((r) => setTimeout(r, 1000));

    // 캡챠 인식 및 제출
    console.log('\n5. 캡챠 인식...');
    const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (captchaElement) {
      const screenshot = await captchaElement.screenshot();
      fs.writeFileSync('/tmp/captcha-correct.png', screenshot);

      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(Buffer.from(screenshot));
      console.log(`   - Vision API: "${result.text}" (${(result.confidence * 100).toFixed(1)}%)`);

      if (result.text) {
        await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

        console.log('\n6. 검색 실행...');
        await page.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
        await new Promise((r) => setTimeout(r, 5000));

        // 결과 확인
        await page.screenshot({ path: '/tmp/search-correct-result.png', fullPage: true });
        console.log('   스크린샷: /tmp/search-correct-result.png');

        const result2 = await page.evaluate(() => {
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

        console.log('\n검색 결과:', JSON.stringify(result2, null, 2));

        // 에러 메시지 확인
        const hasError = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return {
            captchaError: text.includes('보안문자') && text.includes('일치하지'),
            noResult: text.includes('검색결과가 없습니다') || text.includes('조회결과가 없습니다'),
          };
        });
        console.log('에러 상태:', hasError);
      }
    }

    console.log('\n완료. 30초 후 종료...');
    await new Promise((r) => setTimeout(r, 30000));

  } catch (error) {
    console.error('에러:', error);
    await page.screenshot({ path: '/tmp/correct-search-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
