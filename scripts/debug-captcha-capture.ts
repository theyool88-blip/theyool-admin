/**
 * 캡챠 이미지 캡처 디버그 스크립트
 *
 * 실행: npx tsx scripts/debug-captcha-capture.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

async function main() {
  console.log('캡챠 이미지 캡처 디버그...\n');

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
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log('1. 페이지 로딩 중...');
  await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));

  // 캡챠 관련 요소 모두 확인
  console.log('\n2. 캡챠 관련 요소 확인...');
  const captchaInfo = await page.evaluate(() => {
    const result: any = {};

    // 캡챠 이미지 요소
    const imgCaptcha = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_img_captcha') as HTMLImageElement;
    if (imgCaptcha) {
      result.imgCaptcha = {
        tagName: imgCaptcha.tagName,
        src: imgCaptcha.src?.substring(0, 100),
        width: imgCaptcha.width,
        height: imgCaptcha.height,
        naturalWidth: imgCaptcha.naturalWidth,
        naturalHeight: imgCaptcha.naturalHeight,
      };
    } else {
      result.imgCaptcha = 'NOT FOUND';
    }

    // 새로고침 버튼
    const refreshBtn = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_btn_refreshCaptcha');
    result.refreshBtn = refreshBtn ? 'EXISTS' : 'NOT FOUND';

    // 다른 캡챠 관련 요소
    const allCaptcha = document.querySelectorAll('[id*="captcha"]');
    result.allCaptchaIds = Array.from(allCaptcha).map((el) => ({
      id: el.id,
      tagName: el.tagName,
    }));

    // 버튼 요소들
    const allButtons = document.querySelectorAll('button, [role="button"], .btn');
    result.allButtonIds = Array.from(allButtons)
      .map((el) => el.id)
      .filter((id) => id)
      .slice(0, 10);

    return result;
  });

  console.log(JSON.stringify(captchaInfo, null, 2));

  // 캡챠 이미지 캡처
  console.log('\n3. 캡챠 이미지 캡처...');
  const captchaElement = await page.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
  if (captchaElement) {
    const screenshot = await captchaElement.screenshot();
    const captchaPath = '/tmp/captcha-debug.png';
    fs.writeFileSync(captchaPath, screenshot);
    console.log(`   저장됨: ${captchaPath}`);

    // 이미지 정보
    const box = await captchaElement.boundingBox();
    console.log(`   크기: ${box?.width}x${box?.height}`);
  } else {
    console.log('   캡챠 이미지 요소를 찾을 수 없습니다');
  }

  console.log('\n4. 브라우저를 열어둡니다. 30초 후 자동 종료...');
  await new Promise((r) => setTimeout(r, 30000));
  await browser.close();
}

main().catch(console.error);
