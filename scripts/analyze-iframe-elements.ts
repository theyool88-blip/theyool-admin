/**
 * iframe 내부 요소 분석 스크립트
 * 검색 폼의 실제 선택자를 찾습니다
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

async function analyzeIframe() {
  console.log('🔍 iframe 내부 요소 분석 시작...\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 50,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📍 페이지 접속 중...');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('⏳ 페이지 로딩 대기 중 (3초)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // iframe 찾기
    console.log('\n📍 iframe 찾기...');
    const frames = page.frames();
    const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      console.log('❌ iframe을 찾을 수 없습니다');
      return;
    }

    console.log('✓ iframe 발견:', targetFrame.url());
    await new Promise(resolve => setTimeout(resolve, 2000));

    // iframe 내부 모든 input 요소 분석
    console.log('\n📋 iframe 내부 INPUT 필드:');
    const inputs = await targetFrame.$$eval('input', elements =>
      elements.map(el => ({
        type: el.type,
        name: el.name,
        id: el.id,
        className: el.className,
        placeholder: el.placeholder,
        value: el.value
      }))
    );
    console.log(JSON.stringify(inputs, null, 2));

    // iframe 내부 모든 select 요소 분석
    console.log('\n📋 iframe 내부 SELECT 필드:');
    const selects = await targetFrame.$$eval('select', elements =>
      elements.map(el => ({
        name: el.name,
        id: el.id,
        className: el.className,
        options: Array.from(el.options).map(opt => opt.value).slice(0, 5)
      }))
    );
    console.log(JSON.stringify(selects, null, 2));

    // iframe 내부 모든 이미지 분석 (캡챠 찾기)
    console.log('\n📋 iframe 내부 IMAGE 요소:');
    const images = await targetFrame.$$eval('img', elements =>
      elements.map(el => ({
        src: el.src,
        alt: el.alt,
        id: el.id,
        className: el.className,
        width: el.width,
        height: el.height
      }))
    );
    console.log(JSON.stringify(images, null, 2));

    // iframe 내부 버튼 찾기
    console.log('\n📋 iframe 내부 BUTTON/Submit:');
    const buttons = await targetFrame.$$eval('button, input[type="submit"], input[type="button"], a[role="button"]', elements =>
      elements.map(el => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type || 'N/A',
        value: (el as HTMLInputElement).value,
        textContent: el.textContent?.trim().substring(0, 30),
        id: el.id,
        className: el.className,
        onclick: el.getAttribute('onclick')?.substring(0, 50)
      }))
    );
    console.log(JSON.stringify(buttons, null, 2));

    // iframe 내부의 모든 클릭 가능한 요소
    console.log('\n📋 iframe 내부 클릭 가능한 요소 (onclick 속성 있는 것들):');
    const clickables = await targetFrame.$$eval('[onclick], [role="button"]', elements =>
      elements.map(el => ({
        tag: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.trim().substring(0, 30),
        onclick: el.getAttribute('onclick')?.substring(0, 100)
      }))
    );
    console.log(JSON.stringify(clickables, null, 2));

    // 스크린샷 저장
    const outputDir = path.join(process.cwd(), 'temp', 'iframe-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(outputDir, 'full-page-with-iframe.png'),
      fullPage: true
    });
    console.log('\n✓ 스크린샷 저장: temp/iframe-analysis/full-page-with-iframe.png');

    // 분석 결과 저장
    const analysis = {
      iframeUrl: targetFrame.url(),
      inputs,
      selects,
      images,
      buttons,
      clickables,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(outputDir, 'iframe-elements.json'),
      JSON.stringify(analysis, null, 2)
    );
    console.log('✓ 분석 결과 저장: temp/iframe-analysis/iframe-elements.json');

    console.log('\n브라우저를 30초간 열어둡니다. iframe을 직접 확인하세요...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await browser.close();
  }
}

analyzeIframe()
  .then(() => {
    console.log('\n✓ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 실패:', error);
    process.exit(1);
  });
