/**
 * 대법원 페이지 디버그 스크립트
 * 브라우저를 headless: false로 열어서 실제 페이지 구조 확인
 *
 * 실행: npx tsx scripts/debug-scourt-page.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

async function main() {
  console.log('대법원 페이지 디버그 시작...\n');

  // 기존 프로필 디렉토리 사용
  const profiles = fs.readdirSync(PROFILES_DIR).filter((f) => f.startsWith('profile_'));
  const profileDir = profiles.length > 0
    ? path.join(PROFILES_DIR, profiles[0])
    : path.join(PROFILES_DIR, `profile_${Date.now()}`);

  console.log(`프로필 디렉토리: ${profileDir}\n`);

  const browser = await puppeteer.launch({
    headless: false, // 브라우저 보이게
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log('1. 페이지 로딩 중...');
  await page.goto(SCOURT_URL, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  console.log('2. 페이지 로드 완료, 3초 대기...');
  await new Promise((r) => setTimeout(r, 3000));

  // 페이지 구조 분석
  console.log('\n3. 페이지 구조 분석...\n');

  const elements = await page.evaluate(() => {
    const result: Record<string, string | null> = {};

    // 주요 요소들 확인
    const selectors = [
      '#mf_ssgoTopMainTab_contents_content1_body_tbx_captchaImg',
      '#mf_ssgoTopMainTab_contents_content1_body_tbx_captchaImg img',
      '#mf_ssgoTopMainTab_contents_content1_body_ibx_answer',
      '#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr',
      '#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd',
      '#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial',
      '#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      result[sel] = el ? 'EXISTS' : 'NOT FOUND';
    }

    // iframe 확인
    const iframes = document.querySelectorAll('iframe');
    result['iframes_count'] = String(iframes.length);

    // 캡챠 관련 요소 찾기
    const captchaElements = document.querySelectorAll('[id*="captcha"]');
    result['captcha_elements_count'] = String(captchaElements.length);

    const captchaIds: string[] = [];
    captchaElements.forEach((el) => {
      if (el.id) captchaIds.push(el.id);
    });
    result['captcha_ids'] = captchaIds.join(', ') || 'none';

    return result;
  });

  console.log('페이지 요소 확인 결과:');
  for (const [key, value] of Object.entries(elements)) {
    console.log(`  ${key}: ${value}`);
  }

  // 스크린샷 저장
  const screenshotPath = '/tmp/scourt-debug.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n스크린샷 저장됨: ${screenshotPath}`);

  console.log('\n브라우저를 열어둡니다. 수동으로 확인 후 Ctrl+C로 종료하세요.');
  console.log('검색 폼을 채우고 캡챠가 나타나는지 확인해보세요.');

  // 30초 대기 후 자동 종료 (옵션)
  // await new Promise((r) => setTimeout(r, 30000));
  // await browser.close();
}

main().catch(console.error);
