/**
 * 대법원 페이지 구조 분석
 * 실제 필드의 선택자를 찾습니다
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

async function analyzePage() {
  console.log('🔍 대법원 페이지 구조 분석 시작...\n');

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

    // 충분히 대기 (동적 렌더링)
    console.log('⏳ 페이지 로딩 대기 중 (3초)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // "사건번호로 검색" 탭 찾기 및 클릭
    console.log('🔍 "사건번호로 검색" 탭 찾는 중...');
    try {
      // 여러 가능한 선택자 시도
      const tabSelectors = [
        'a:has-text("사건번호로 검색")',
        'a:has-text("사건번호")',
        '[onclick*="tab"]',
        'a[href*="#"]'
      ];

      // 페이지의 모든 링크 확인
      const links = await page.$$eval('a', links =>
        links.map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          onclick: a.getAttribute('onclick')
        }))
      );

      console.log('페이지의 링크들:', links.filter(l => l.text?.includes('검색') || l.text?.includes('사건')));

      // "사건번호" 텍스트가 포함된 링크 클릭
      const tabClicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const tab = links.find(a => a.textContent?.includes('사건번호'));
        if (tab) {
          tab.click();
          return true;
        }
        return false;
      });

      if (tabClicked) {
        console.log('✓ 탭 클릭 성공');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log('⚠️  탭을 찾을 수 없습니다');
      }
    } catch (error) {
      console.log('⚠️  탭 클릭 실패:', error);
    }

    console.log('✓ 페이지 준비 완료\n');

    // 모든 input 요소 분석
    console.log('📋 모든 INPUT 필드:');
    const inputs = await page.$$eval('input', elements =>
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

    // 모든 select 요소 분석
    console.log('\n📋 모든 SELECT 필드:');
    const selects = await page.$$eval('select', elements =>
      elements.map(el => ({
        name: el.name,
        id: el.id,
        className: el.className,
        options: Array.from(el.options).map(opt => opt.value).slice(0, 5) // 처음 5개만
      }))
    );
    console.log(JSON.stringify(selects, null, 2));

    // 모든 이미지 분석 (캡챠 찾기)
    console.log('\n📋 모든 IMAGE 요소:');
    const images = await page.$$eval('img', elements =>
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

    // 버튼 찾기
    console.log('\n📋 모든 BUTTON/Submit:');
    const buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', elements =>
      elements.map(el => ({
        tag: el.tagName,
        type: el.type,
        value: el.value,
        textContent: el.textContent?.trim().substring(0, 20),
        onclick: el.getAttribute('onclick')?.substring(0, 50)
      }))
    );
    console.log(JSON.stringify(buttons, null, 2));

    // 스크린샷 저장
    const outputDir = path.join(process.cwd(), 'temp', 'page-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(outputDir, 'full-page.png'),
      fullPage: true
    });
    console.log('\n✓ 스크린샷 저장: temp/page-analysis/full-page.png');

    // 분석 결과 저장
    const analysis = {
      inputs,
      selects,
      images,
      buttons,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(outputDir, 'analysis.json'),
      JSON.stringify(analysis, null, 2)
    );
    console.log('✓ 분석 결과 저장: temp/page-analysis/analysis.json');

    console.log('\n브라우저를 20초간 열어둡니다. 페이지를 직접 확인하세요...');
    await new Promise(resolve => setTimeout(resolve, 20000));

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    await browser.close();
  }
}

analyzePage()
  .then(() => {
    console.log('\n✓ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 실패:', error);
    process.exit(1);
  });
