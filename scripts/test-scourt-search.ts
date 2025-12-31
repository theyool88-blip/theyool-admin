/**
 * 대법원 사건검색 테스트 스크립트
 *
 * 사용법:
 * npx tsx scripts/test-scourt-search.ts
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface CaseSearchParams {
  courtName: string;      // 예: "서울중앙지방법원"
  caseYear: string;       // 예: "2024"
  caseType: string;       // 예: "가합", "하단", "개회"
  caseNumber: string;     // 예: "123456"
  partyName: string;      // 예: "홍길동"
}

async function testScourtSearch(params: CaseSearchParams) {
  console.log('🔍 대법원 사건검색 테스트 시작...\n');
  console.log('검색 조건:', params);
  console.log('─'.repeat(50));

  const browser = await puppeteer.launch({
    headless: false, // 브라우저 창 보이기 (디버깅용)
    slowMo: 100,     // 동작을 천천히 (관찰용)
  });

  try {
    const page = await browser.newPage();

    // 화면 크기 설정
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('\n✓ 브라우저 시작됨');

    // 1. 대법원 사건검색 페이지 접속
    console.log('\n📍 Step 1: 대법원 사건검색 페이지 접속');
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('✓ 페이지 로드 완료');

    // 동적 콘텐츠 로딩 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✓ 동적 콘텐츠 로딩 대기 완료');

    // 2. 페이지 스크린샷 저장
    const screenshotDir = path.join(process.cwd(), 'temp', 'scourt-test');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(screenshotDir, '01-initial-page.png'),
      fullPage: true
    });
    console.log('✓ 초기 페이지 스크린샷 저장: temp/scourt-test/01-initial-page.png');

    // 3. 검색 폼 확인
    console.log('\n📍 Step 2: 검색 폼 확인');

    // 페이지 HTML 구조 확인
    const pageContent = await page.content();

    // 법원명 선택
    console.log('\n법원명 입력 시도...');
    const courtNameSelector = 'select[name="court_name"], select#court_name, select.court_name';
    const courtNameExists = await page.$(courtNameSelector);

    if (courtNameExists) {
      await page.select(courtNameSelector, params.courtName);
      console.log(`✓ 법원명 선택: ${params.courtName}`);
    } else {
      console.log('⚠️  법원명 선택 필드를 찾을 수 없습니다');
    }

    // 사건번호 입력
    console.log('\n사건번호 입력 시도...');

    // 년도
    const yearInput = await page.$('input[name="caseNumberYear"], input#caseNumberYear');
    if (yearInput) {
      await yearInput.type(params.caseYear);
      console.log(`✓ 년도 입력: ${params.caseYear}`);
    }

    // 구분 (가합, 하단 등)
    const typeSelect = await page.$('select[name="caseNumberType"], select#caseNumberType');
    if (typeSelect) {
      await page.select('select[name="caseNumberType"], select#caseNumberType', params.caseType);
      console.log(`✓ 구분 선택: ${params.caseType}`);
    }

    // 번호
    const numberInput = await page.$('input[name="caseNumberNumber"], input#caseNumberNumber');
    if (numberInput) {
      await numberInput.type(params.caseNumber);
      console.log(`✓ 번호 입력: ${params.caseNumber}`);
    }

    // 당사자명
    const partyInput = await page.$('input[name="userName"], input#userName');
    if (partyInput) {
      await partyInput.type(params.partyName);
      console.log(`✓ 당사자명 입력: ${params.partyName}`);
    }

    // 검색 폼 작성 후 스크린샷
    await page.screenshot({
      path: path.join(screenshotDir, '02-form-filled.png'),
      fullPage: true
    });
    console.log('✓ 폼 작성 후 스크린샷 저장: temp/scourt-test/02-form-filled.png');

    // 4. 캡챠 확인
    console.log('\n📍 Step 3: 캡챠 이미지 확인');

    // 캡챠 이미지 찾기 (여러 가능한 선택자 시도)
    const captchaSelectors = [
      'img[alt*="보안"]',
      'img[alt*="캡챠"]',
      'img[alt*="captcha"]',
      'img[src*="captcha"]',
      'img[src*="secure"]',
      '#captchaImage',
      '.captcha-image'
    ];

    let captchaElement = null;
    for (const selector of captchaSelectors) {
      captchaElement = await page.$(selector);
      if (captchaElement) {
        console.log(`✓ 캡챠 이미지 발견 (selector: ${selector})`);
        break;
      }
    }

    if (captchaElement) {
      // 캡챠 이미지만 별도 저장
      await captchaElement.screenshot({
        path: path.join(screenshotDir, '03-captcha-image.png')
      });
      console.log('✓ 캡챠 이미지 저장: temp/scourt-test/03-captcha-image.png');

      // 캡챠 이미지 URL 가져오기
      const captchaUrl = await page.evaluate((el) => (el as HTMLImageElement).src, captchaElement);
      console.log(`캡챠 이미지 URL: ${captchaUrl}`);
    } else {
      console.log('⚠️  캡챠 이미지를 찾을 수 없습니다');
      console.log('페이지의 모든 이미지 확인:');
      const allImages = await page.$$eval('img', imgs =>
        imgs.map(img => ({ src: img.src, alt: img.alt }))
      );
      console.log(allImages);
    }

    // 5. 검색 버튼 찾기
    console.log('\n📍 Step 4: 검색 버튼 확인');
    const searchButtonSelectors = [
      'button:contains("검색")',
      'input[type="submit"][value*="검색"]',
      'button[onclick*="search"]',
      'a[onclick*="search"]'
    ];

    const searchButton = await page.$('button, input[type="submit"], a[onclick*="search"]');
    if (searchButton) {
      const buttonText = await page.evaluate(el => el.textContent || (el as HTMLInputElement).value, searchButton);
      console.log(`✓ 검색 버튼 발견: "${buttonText}"`);
    } else {
      console.log('⚠️  검색 버튼을 찾을 수 없습니다');
    }

    // 6. 페이지 정보 수집
    console.log('\n📍 Step 5: 페이지 정보 수집');

    // 모든 폼 필드 확인
    const formFields = await page.$$eval('input, select, textarea', elements =>
      elements.map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: (el as HTMLInputElement).placeholder || ''
      }))
    );

    console.log('\n페이지의 모든 입력 필드:');
    console.log(JSON.stringify(formFields, null, 2));

    // 결과를 파일로 저장
    fs.writeFileSync(
      path.join(screenshotDir, 'page-analysis.json'),
      JSON.stringify({
        formFields,
        timestamp: new Date().toISOString(),
        searchParams: params
      }, null, 2)
    );
    console.log('✓ 페이지 분석 결과 저장: temp/scourt-test/page-analysis.json');

    console.log('\n─'.repeat(50));
    console.log('✅ 테스트 완료!');
    console.log('\n다음 단계:');
    console.log('1. temp/scourt-test/ 폴더의 스크린샷 확인');
    console.log('2. 캡챠 이미지 복잡도 확인');
    console.log('3. page-analysis.json에서 정확한 필드명 확인');
    console.log('\n브라우저를 10초 후 자동으로 닫습니다...');

    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('\n❌ 에러 발생:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('\n✓ 브라우저 종료됨');
  }
}

// 테스트 실행
const testParams: CaseSearchParams = {
  courtName: '수원가정법원',
  caseYear: '2024',
  caseType: '드단',
  caseNumber: '26718',
  partyName: '김윤한'  // 원고(의뢰인)
};

console.log('\n🔍 실제 사건번호로 테스트 시작\n');

testScourtSearch(testParams)
  .then(() => {
    console.log('\n🎉 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 스크립트 실행 실패:', error);
    process.exit(1);
  });
