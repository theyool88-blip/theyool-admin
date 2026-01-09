/**
 * 개선된 사건 검색:
 * 1. 캡챠 재시도 로직
 * 2. 세션 유지를 통한 저장된 사건 접근
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import puppeteer, { Browser, Page, Frame } from 'puppeteer';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

interface CaseInfo {
  court: string;
  year: string;
  caseType: string;
  serialNumber: string;
  partyName: string;
}

class CourtCaseSearcher {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private maxRetries = 5;

  async initialize() {
    console.log('🚀 브라우저 초기화 중...\n');

    this.browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Alert 자동 처리
    this.page.on('dialog', async dialog => {
      console.log(`⚠️  Alert: "${dialog.message().substring(0, 50)}..."`);
      await dialog.accept();
    });

    console.log('✓ 브라우저 초기화 완료\n');
  }

  async navigateToSearchPage(): Promise<Frame> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📍 검색 페이지 접속 중...');
    await this.page.goto('https://www.scourt.go.kr/portal/information/events/search/search.jsp', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = this.page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe을 찾을 수 없습니다');

    console.log('✓ 검색 페이지 로드 완료\n');
    return targetFrame;
  }

  async searchCase(caseInfo: CaseInfo): Promise<boolean> {
    console.log('='.repeat(70));
    console.log('🔍 사건 검색 시작');
    console.log('='.repeat(70));
    console.log(`법원: ${caseInfo.court}`);
    console.log(`사건: ${caseInfo.year}${caseInfo.caseType}${caseInfo.serialNumber}`);
    console.log(`당사자: ${caseInfo.partyName}`);
    console.log('='.repeat(70));

    const targetFrame = await this.navigateToSearchPage();

    // 저장 옵션 체크
    await this.checkSaveOption(targetFrame);

    // 법원 선택
    await this.selectCourt(targetFrame, caseInfo.court);

    // 사건 정보 입력
    await this.fillCaseInfo(targetFrame, caseInfo);

    // 캡챠 해결 (재시도 포함)
    const captchaSolved = await this.solveCaptchaWithRetry(targetFrame);
    if (!captchaSolved) {
      console.log('❌ 캡챠 해결 실패\n');
      return false;
    }

    // 검색 실행
    console.log('🔎 검색 버튼 클릭...');
    await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');
    await new Promise(r => setTimeout(r, 5000));

    // 결과 확인
    const hasResults = await this.checkSearchResults(targetFrame);

    if (hasResults) {
      console.log('✅ 검색 성공!\n');
      return true;
    } else {
      console.log('⚠️  검색 결과 없음\n');
      return false;
    }
  }

  private async checkSaveOption(frame: Frame) {
    console.log('Step 1: 저장 옵션 체크...');
    await frame.evaluate(() => {
      const cb = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0') as HTMLInputElement;
      if (cb && !cb.checked) cb.click();
    });
    console.log('✓ 완료\n');
  }

  private async selectCourt(frame: Frame, courtName: string) {
    console.log(`Step 2: 법원 선택 (${courtName})...`);
    await new Promise(r => setTimeout(r, 1000));
    await frame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', courtName);
    await new Promise(r => setTimeout(r, 2000));
    console.log('✓ 완료\n');
  }

  private async fillCaseInfo(frame: Frame, caseInfo: CaseInfo) {
    console.log('Step 3: 사건 정보 입력...');

    await frame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr', caseInfo.year);
    await frame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd', caseInfo.caseType);

    await frame.click('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial');
    await new Promise(r => setTimeout(r, 500));
    await frame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial', caseInfo.serialNumber);
    await frame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', caseInfo.partyName);

    console.log('✓ 완료\n');
  }

  private async solveCaptchaWithRetry(frame: Frame): Promise<boolean> {
    console.log(`Step 4: 캡챠 해결 (최대 ${this.maxRetries}회 시도)...\n`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`시도 ${attempt}/${this.maxRetries}:`);

      try {
        // 캡챠 이미지 캡처
        const captchaImg = await frame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');
        if (!captchaImg) {
          console.log('  ❌ 캡챠 이미지를 찾을 수 없습니다');
          continue;
        }

        const screenshot = await captchaImg.screenshot();
        const solver = getVisionCaptchaSolver();
        const result = await solver.solveCaptcha(screenshot);

        console.log(`  인식된 캡챠: "${result.text}" (신뢰도: ${(result.confidence! * 100).toFixed(1)}%)`);

        // 기존 입력 지우기
        await frame.evaluate(() => {
          const input = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer') as HTMLInputElement;
          if (input) input.value = '';
        });

        // 캡챠 입력
        await frame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text!);

        // 신뢰도가 높으면 바로 성공으로 간주
        if (result.confidence && result.confidence > 0.95) {
          console.log('  ✅ 높은 신뢰도 - 캡챠 해결 완료\n');
          return true;
        }

        // 테스트 제출 (실제로는 검색 버튼을 클릭하지 않고 확인만)
        console.log('  ✓ 캡챠 입력 완료\n');
        return true;

      } catch (error) {
        console.log(`  ❌ 에러 발생: ${error}`);

        if (attempt < this.maxRetries) {
          console.log('  🔄 캡챠 새로고침 중...\n');

          // 페이지 새로고침하지 않고 캡챠만 새로고침
          await frame.evaluate(() => {
            const img = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_img_captcha') as HTMLImageElement;
            if (img) {
              // 캡챠 이미지 URL에 타임스탬프 추가하여 새로고침
              const src = img.src.split('?')[0];
              img.src = src + '?t=' + new Date().getTime();
            }
          });

          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.log(`❌ ${this.maxRetries}회 시도 후 실패\n`);
    return false;
  }

  private async checkSearchResults(frame: Frame): Promise<boolean> {
    const result = await frame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      return rows && rows.length > 0;
    });

    return result || false;
  }

  async accessSavedCases(): Promise<any[]> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('\n='.repeat(70));
    console.log('💾 저장된 사건 목록 접근 (캡챠 불필요!)');
    console.log('='.repeat(70));

    // 같은 세션에서 페이지 새로고침
    console.log('페이지 새로고침 중...');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));

    const targetFrame = this.page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe을 찾을 수 없습니다');

    console.log('✓ 새로고침 완료\n');

    // 저장된 사건 목록 추출
    const savedCases = await targetFrame.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length === 0) {
        return [];
      }

      return Array.from(rows).map((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          index: idx,
          법원: cells[2]?.textContent?.trim(),
          사건번호: cells[3]?.textContent?.trim(),
          사건명: cells[4]?.textContent?.trim(),
          rowId: row.id
        };
      });
    });

    console.log(`📋 저장된 사건: ${savedCases.length}건\n`);

    savedCases.forEach((c, idx) => {
      console.log(`[${idx + 1}] ${c.법원} | ${c.사건번호} | ${c.사건명}`);
    });
    console.log();

    return savedCases;
  }

  async clickSavedCase(index: number = 0): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`\n🖱️  저장된 사건 #${index + 1} 클릭 (캡챠 불필요!)\n`);

    const targetFrame = this.page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) throw new Error('iframe을 찾을 수 없습니다');

    // 사건 클릭
    const clicked = await targetFrame.evaluate((idx) => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');

      if (!rows || rows.length <= idx) {
        return false;
      }

      const targetRow = rows[idx] as HTMLElement;
      targetRow.click();
      return true;
    }, index);

    if (!clicked) {
      console.log('❌ 사건 클릭 실패\n');
      return false;
    }

    await new Promise(r => setTimeout(r, 5000));

    // 사건 일반내용 확인
    const hasGeneral = await targetFrame.evaluate(() => {
      const generalTable = document.querySelector('.tbl_type01');
      return !!generalTable;
    });

    if (hasGeneral) {
      console.log('✅ 사건 일반내용 로드 성공! (캡챠 입력 없이!)\n');
      return true;
    } else {
      console.log('⚠️  사건 일반내용을 찾을 수 없습니다\n');
      return false;
    }
  }

  async takeScreenshot(filename: string) {
    if (!this.page) return;

    const outputDir = path.join(process.cwd(), 'temp', 'improved-search');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await this.page.screenshot({
      path: path.join(outputDir, filename),
      fullPage: true
    });
    console.log(`📸 스크린샷: ${filename}\n`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async keepAlive(seconds: number) {
    console.log(`\n⏰ 브라우저를 ${seconds}초간 열어둡니다...\n`);
    await new Promise(r => setTimeout(r, seconds * 1000));
  }
}

// 메인 실행
async function main() {
  const searcher = new CourtCaseSearcher();

  try {
    await searcher.initialize();

    // 1단계: 사건 검색 (캡챠 필요)
    const caseInfo: CaseInfo = {
      court: '수원가정법원',
      year: '2024',
      caseType: '드단',
      serialNumber: '26718',
      partyName: '김윤한'
    };

    const searchSuccess = await searcher.searchCase(caseInfo);
    await searcher.takeScreenshot('1-after-search.png');

    if (!searchSuccess) {
      console.log('검색 실패. 종료합니다.');
      return;
    }

    // 2단계: 저장된 사건 목록 접근 (캡챠 불필요!)
    const savedCases = await searcher.accessSavedCases();
    await searcher.takeScreenshot('2-saved-cases.png');

    if (savedCases.length === 0) {
      console.log('저장된 사건이 없습니다.');
      return;
    }

    // 3단계: 저장된 사건 클릭 (캡챠 불필요!)
    const clickSuccess = await searcher.clickSavedCase(0);
    await searcher.takeScreenshot('3-case-general.png');

    if (clickSuccess) {
      console.log('='.repeat(70));
      console.log('🎉 성공!');
      console.log('='.repeat(70));
      console.log('✅ 초기 검색: 캡챠 1회 사용');
      console.log('✅ 저장된 목록 접근: 캡챠 불필요');
      console.log('✅ 사건 일반내용 보기: 캡챠 불필요');
      console.log('='.repeat(70));
    }

    // 브라우저 유지
    await searcher.keepAlive(120);

  } finally {
    await searcher.close();
  }
}

main()
  .then(() => {
    console.log('\n✅ 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 에러:', error);
    process.exit(1);
  });
