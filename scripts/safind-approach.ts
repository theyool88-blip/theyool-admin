/**
 * case-ing 프로젝트 방식 참고: safind.scourt.go.kr 사용
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function safindApproach() {
  console.log('🔍 safind.scourt.go.kr 방식 테스트\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const outputDir = path.join(process.cwd(), 'temp', 'safind-test');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('페이지 접속 중...');
    await page.goto('https://safind.scourt.go.kr/sf/mysafind.jsp', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✓ 페이지 로드 완료\n');

    await new Promise(r => setTimeout(r, 3000));

    // 스크린샷 - 초기 페이지
    await page.screenshot({ path: path.join(outputDir, '1-initial-page.png'), fullPage: true });
    console.log('✓ 초기 페이지 스크린샷 저장\n');

    // 폼 필드 확인
    console.log('폼 필드 확인 중...\n');
    const formFields = await page.evaluate(() => {
      return {
        courtSelect: !!document.querySelector('#sch_bub_nm'),
        yearSelect: !!document.querySelector('#sel_sa_year'),
        caseTypeSelect: !!document.querySelector('#sa_gubun'),
        serialInput: !!document.querySelector('#sa_serial'),
        partyInput: !!document.querySelector('#ds_nm'),
        captchaInput: !!document.querySelector('#answer'),
        searchBtn: !!document.querySelector('.tableVer .redBtn'),
        captchaImg: !!document.querySelector('#captcha img')
      };
    });

    console.log('='.repeat(70));
    console.log('폼 필드 존재 여부:');
    console.log('='.repeat(70));
    Object.entries(formFields).forEach(([key, exists]) => {
      console.log(`${key.padEnd(20)}: ${exists ? '✅' : '❌'}`);
    });
    console.log('='.repeat(70));

    if (!formFields.courtSelect) {
      console.log('\n⚠️  이 URL은 다른 구조를 가지고 있을 수 있습니다.');
      console.log('브라우저를 1분간 열어둡니다. 직접 확인해보세요...\n');
      await new Promise(r => setTimeout(r, 60000));
      return;
    }

    // 법원 선택 (수원가정법원 = 000302)
    console.log('\n법원 선택 중 (수원가정법원)...');
    await page.select('#sch_bub_nm', '000302');
    await new Promise(r => setTimeout(r, 1000));
    console.log('✓ 수원가정법원 선택됨\n');

    // 연도 선택
    console.log('연도 선택 (2024)...');
    await page.select('#sel_sa_year', '2024');
    console.log('✓ 완료\n');

    // 사건유형 옵션 확인
    const caseTypeOptions = await page.evaluate(() => {
      const select = document.querySelector('#sa_gubun') as HTMLSelectElement;
      return Array.from(select?.options || []).map(opt => ({
        value: opt.value,
        text: opt.text
      }));
    });

    console.log('사건유형 옵션:');
    caseTypeOptions.forEach(opt => {
      console.log(`  - ${opt.text} (${opt.value})`);
    });
    console.log();

    // 사건유형 찾기 (드단)
    const drDanOption = caseTypeOptions.find(opt => opt.text.includes('드'));
    if (drDanOption) {
      console.log(`"드" 유형 발견: ${drDanOption.text} (${drDanOption.value})`);
      await page.select('#sa_gubun', drDanOption.value);
      console.log('✓ 사건유형 선택됨\n');
    } else {
      console.log('❌ "드" 유형을 찾을 수 없습니다\n');
    }

    // 일련번호 입력
    console.log('일련번호 입력 (26718)...');
    await page.type('#sa_serial', '26718');
    console.log('✓ 완료\n');

    // 당사자명 입력
    console.log('당사자명 입력 (김윤한)...');
    await page.type('#ds_nm', '김윤한');
    console.log('✓ 완료\n');

    // 캡챠 인식
    console.log('캡챠 인식 중...');
    const captchaImg = await page.$('#captcha img');
    if (!captchaImg) {
      console.log('❌ 캡챠 이미지를 찾을 수 없습니다');
      await new Promise(r => setTimeout(r, 60000));
      return;
    }

    const screenshot = await captchaImg.screenshot();
    const solver = getVisionCaptchaSolver();
    const result = await solver.solveCaptcha(screenshot);

    console.log(`✓ 캡챠 인식: "${result.text}"\n`);

    // 캡챠 입력
    await page.type('#answer', result.text!);

    await page.screenshot({ path: path.join(outputDir, '2-before-search.png'), fullPage: true });
    console.log('✓ 검색 전 스크린샷 저장\n');

    console.log('='.repeat(70));
    console.log('📋 입력 완료:');
    console.log('='.repeat(70));
    console.log('법원: 수원가정법원 (000302)');
    console.log('연도: 2024');
    console.log(`사건유형: ${drDanOption?.text || '(선택 안됨)'}`);
    console.log('일련번호: 26718');
    console.log('당사자명: 김윤한');
    console.log(`캡챠: ${result.text}`);
    console.log('='.repeat(70));

    console.log('\n검색 버튼 클릭...\n');
    await page.click('.tableVer .redBtn');
    await new Promise(r => setTimeout(r, 5000));

    await page.screenshot({ path: path.join(outputDir, '3-after-search.png'), fullPage: true });
    console.log('✓ 검색 후 스크린샷 저장\n');

    // Alert 처리
    const hasAlert = await page.evaluate(() => {
      // Alert가 있었는지 확인하는 방법이 제한적이므로, 결과 테이블 확인
      return document.body.textContent?.includes('사건이 존재하지 않습니다');
    });

    if (hasAlert) {
      console.log('⚠️  "사건이 존재하지 않습니다" 메시지 감지\n');
    } else {
      console.log('✅ 검색 성공한 것으로 보입니다\n');
    }

    // 결과 탭 확인
    const hasTabs = await page.evaluate(() => {
      const tab2 = document.querySelector('li.subTab2');
      return !!tab2;
    });

    if (hasTabs) {
      console.log('결과 탭 발견. "기일내용" 탭 클릭...\n');
      await page.click('li.subTab2');
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(outputDir, '4-result-tab.png'), fullPage: true });
      console.log('✓ 결과 탭 스크린샷 저장\n');
    }

    console.log('\n브라우저를 2분간 열어둡니다...\n');
    await new Promise(r => setTimeout(r, 120000));

  } finally {
    await browser.close();
  }
}

safindApproach()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
