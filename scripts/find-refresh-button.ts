/**
 * 캡챠 새로고침 버튼 찾기 스크립트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

async function main() {
  console.log('새로고침 버튼 찾기...\n');

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

  // 버튼 및 클릭 가능한 요소 찾기
  const elements = await page.evaluate(() => {
    const result: any = {};

    // 모든 버튼 요소
    const buttons = document.querySelectorAll('button');
    result.buttons = Array.from(buttons).map((el) => ({
      id: el.id || 'no-id',
      text: el.textContent?.trim().substring(0, 30),
      title: el.getAttribute('title'),
    })).slice(0, 20);

    // 클릭 가능한 이미지 (새로고침 아이콘일 수 있음)
    const clickableImages = document.querySelectorAll('img[onclick], img[role="button"]');
    result.clickableImages = Array.from(clickableImages).map((el) => ({
      id: el.id || 'no-id',
      src: (el as HTMLImageElement).src?.substring(0, 50),
      alt: el.getAttribute('alt'),
    }));

    // 캡챠 근처 요소들
    const captchaImg = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (captchaImg && captchaImg.parentElement) {
      const parent = captchaImg.parentElement;
      result.captchaParent = {
        tagName: parent.tagName,
        id: parent.id,
        className: parent.className,
      };

      // 형제 요소들
      const siblings = parent.parentElement?.children || [];
      result.captchaSiblings = Array.from(siblings).map((el) => ({
        tagName: el.tagName,
        id: el.id || 'no-id',
        className: el.className?.substring(0, 50),
      }));
    }

    // refresh 관련 요소
    const refreshElements = document.querySelectorAll('[id*="refresh"], [id*="Refresh"]');
    result.refreshElements = Array.from(refreshElements).map((el) => ({
      id: el.id,
      tagName: el.tagName,
    }));

    // btn_ 접두사 버튼들
    const btnElements = document.querySelectorAll('[id^="mf_"][id*="_btn_"]');
    result.btnElements = Array.from(btnElements).map((el) => ({
      id: el.id,
      tagName: el.tagName,
      text: el.textContent?.trim().substring(0, 20),
    }));

    return result;
  });

  console.log('=== 버튼 요소들 ===');
  console.log(JSON.stringify(elements.buttons.slice(0, 10), null, 2));

  console.log('\n=== btn_ 요소들 ===');
  console.log(JSON.stringify(elements.btnElements, null, 2));

  console.log('\n=== refresh 관련 요소 ===');
  console.log(JSON.stringify(elements.refreshElements, null, 2));

  console.log('\n=== 캡챠 근처 요소들 ===');
  console.log(JSON.stringify(elements.captchaSiblings, null, 2));

  await new Promise((r) => setTimeout(r, 5000));
  await browser.close();
}

main().catch(console.error);
