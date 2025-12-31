/**
 * 공개된 사건 찾기 및 결과 구조 분석
 * 여러 케이스를 시도해서 실제 검색 결과가 나오는 사건을 찾습니다
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

interface TestCase {
  name: string;
  courtName: string;
  caseYear: string;
  caseType: string;
  caseNumber: string;
  partyName: string;
}

const testCases: TestCase[] = [
  // 일반적인 민사 사건 (공개 가능성 높음)
  {
    name: '서울중앙지방법원 2020년 민사',
    courtName: '서울중앙지방법원',
    caseYear: '2020',
    caseType: '가합',
    caseNumber: '10000',
    partyName: '김철수'
  },
  {
    name: '서울중앙지방법원 2019년 민사',
    courtName: '서울중앙지방법원',
    caseYear: '2019',
    caseType: '가단',
    caseNumber: '50000',
    partyName: '홍길동'
  },
  {
    name: '서울중앙지방법원 2021년 민사',
    courtName: '서울중앙지방법원',
    caseYear: '2021',
    caseType: '가합',
    caseNumber: '1',
    partyName: '이순신'
  }
];

async function searchCase(browser: any, testCase: TestCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 테스트: ${testCase.name}`);
  console.log(`   법원: ${testCase.courtName}`);
  console.log(`   사건번호: ${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`);
  console.log(`   당사자: ${testCase.partyName}`);
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  );

  try {
    await page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const frames = page.frames();
    const targetFrame = frames.find((f: any) => f.url().includes('ssgo.scourt.go.kr'));

    if (!targetFrame) {
      console.log('❌ iframe을 찾을 수 없습니다');
      await page.close();
      return null;
    }

    // 법원 선택
    try {
      await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', testCase.courtName);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.log('⚠️  법원 선택 실패');
    }

    // 사건번호 입력
    const fullCaseNo = `${testCase.caseYear}${testCase.caseType}${testCase.caseNumber}`;
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);
    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', testCase.partyName);

    // 캡챠 해결
    const captchaImage = await targetFrame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
    if (!captchaImage) {
      console.log('❌ 캡챠 이미지를 찾을 수 없습니다');
      await page.close();
      return null;
    }

    const screenshot = await captchaImage.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    if (!result.success || !result.text) {
      console.log('❌ 캡챠 인식 실패');
      await page.close();
      return null;
    }

    console.log(`✓ 캡챠 인식: "${result.text}"`);

    await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

    // 결과 대기
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 결과 확인
    const hasResults = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      return rows ? rows.length : 0;
    });

    console.log(`\n📊 결과: ${hasResults}건`);

    if (hasResults > 0) {
      // 결과가 있으면 상세 분석
      console.log('✅ 결과 발견! 상세 분석 중...\n');

      // 결과 행의 HTML 구조 추출
      const resultStructure = await targetFrame.evaluate(() => {
        const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
        const firstRow = tbody?.querySelector('tr');

        if (!firstRow) return null;

        const cells = Array.from(firstRow.querySelectorAll('td'));

        return {
          rowHTML: firstRow.innerHTML,
          cellCount: cells.length,
          cells: cells.map((cell, idx) => ({
            index: idx,
            innerHTML: cell.innerHTML.substring(0, 200),
            textContent: cell.textContent?.trim(),
            hasLink: !!cell.querySelector('a'),
            linkHref: cell.querySelector('a')?.getAttribute('href'),
            onClick: cell.getAttribute('onclick') || cell.querySelector('a')?.getAttribute('onclick')
          }))
        };
      });

      console.log('📋 결과 행 구조:');
      console.log(JSON.stringify(resultStructure, null, 2));

      // 스크린샷 저장
      const outputDir = path.join(process.cwd(), 'temp', 'public-case-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await page.screenshot({
        path: path.join(outputDir, `${testCase.name.replace(/\s+/g, '_')}.png`),
        fullPage: true
      });

      // 결과 구조 저장
      fs.writeFileSync(
        path.join(outputDir, `${testCase.name.replace(/\s+/g, '_')}.json`),
        JSON.stringify(resultStructure, null, 2)
      );

      console.log(`\n✓ 스크린샷 저장: temp/public-case-results/`);

      await page.close();
      return resultStructure;
    } else {
      console.log('❌ 결과 없음');
      await page.close();
      return null;
    }

  } catch (error) {
    console.error('❌ 에러:', error);
    await page.close();
    return null;
  }
}

async function main() {
  console.log('🚀 공개 사건 검색 및 URL 구조 분석\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const testCase of testCases) {
      const result = await searchCase(browser, testCase);

      if (result) {
        console.log('\n' + '='.repeat(60));
        console.log('🎉 결과를 찾았습니다!');
        console.log('='.repeat(60));

        // 결과 분석
        const hasClickableLink = result.cells.some((cell: { hasLink?: boolean; onClick?: string | null }) => cell.hasLink || cell.onClick);
        console.log(`\n📍 클릭 가능한 링크: ${hasClickableLink ? '✅ 있음' : '❌ 없음'}`);

        if (hasClickableLink) {
          console.log('\n🔗 링크 정보:');
          result.cells.forEach((cell: { index: number; textContent?: string; hasLink?: boolean; linkHref?: string | null; onClick?: string | null }) => {
            if (cell.hasLink || cell.onClick) {
              console.log(`  - Cell ${cell.index}: ${cell.textContent}`);
              if (cell.linkHref) console.log(`    URL: ${cell.linkHref}`);
              if (cell.onClick) console.log(`    onClick: ${cell.onClick.substring(0, 100)}`);
            }
          });
        }

        break; // 결과를 찾으면 중단
      }

      // 다음 테스트 전 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } finally {
    await browser.close();
  }
}

main()
  .then(() => {
    console.log('\n✓ 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
