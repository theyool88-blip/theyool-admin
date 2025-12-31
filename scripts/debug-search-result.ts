/**
 * 검색 결과 디버그 스크립트
 * 캡챠 제출 후 페이지 상태 확인
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

async function main() {
  console.log('검색 결과 디버그...\n');

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

  await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  // 검색 폼 입력
  console.log('1. 검색 폼 입력...');
  await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', '2023');
  await page.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', '드단');
  await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', '2418');
  await page.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', '김');

  console.log('2. 캡챠 확인...');
  const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
  if (captchaElement) {
    const screenshot = await captchaElement.screenshot();
    fs.writeFileSync('/tmp/captcha-before-submit.png', screenshot);
    console.log('   캡챠 이미지 저장: /tmp/captcha-before-submit.png');
  }

  console.log('3. 캡챠 수동 입력 후 Enter를 눌러주세요 (터미널에서)...');
  console.log('   또는 30초 후 자동으로 검색을 시도합니다.');

  // 30초 대기
  await new Promise((r) => setTimeout(r, 30000));

  // 검색 결과 테이블 확인
  console.log('4. 검색 결과 테이블 확인...');
  const tableInfo = await page.evaluate(() => {
    const result: any = {};

    // 검색 결과 테이블
    const resultTable = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
    result.resultTable = resultTable ? 'EXISTS' : 'NOT FOUND';
    if (resultTable) {
      const rows = resultTable.querySelectorAll('tr');
      result.rowCount = rows.length;
      if (rows.length > 0) {
        const firstRow = rows[0];
        const cells = Array.from(firstRow.querySelectorAll('td'));
        result.firstRowCells = cells.map((cell) => cell.textContent?.trim().substring(0, 30));
      }
    }

    // 에러 메시지 확인
    const bodyText = document.body.textContent || '';
    result.hasError = bodyText.includes('보안문자') && bodyText.includes('일치하지');
    result.hasNoResult = bodyText.includes('검색결과가 없습니다') || bodyText.includes('조회결과가 없습니다');

    // 알림/모달 확인
    const alerts = document.querySelectorAll('.alert, .modal, [role="alert"]');
    result.alertCount = alerts.length;

    // 결과 그리드 관련 요소들
    const gridElements = document.querySelectorAll('[id*="Grid"], [id*="grid"]');
    result.gridIds = Array.from(gridElements).map((el) => el.id).slice(0, 10);

    return result;
  });

  console.log('\n검색 결과 테이블 상태:');
  console.log(JSON.stringify(tableInfo, null, 2));

  // 스크린샷 저장
  await page.screenshot({ path: '/tmp/search-result-debug.png', fullPage: true });
  console.log('\n스크린샷 저장됨: /tmp/search-result-debug.png');

  console.log('\n브라우저를 열어둡니다. 30초 후 자동 종료...');
  await new Promise((r) => setTimeout(r, 30000));
  await browser.close();
}

main().catch(console.error);
