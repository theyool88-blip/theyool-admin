/**
 * 대법원 나의사건검색 스크래퍼
 *
 * Puppeteer를 사용하여 대법원 사이트에서 사건 정보를 조회합니다.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { getVisionCaptchaSolver } from '../google/vision-captcha-solver';

export interface CaseSearchParams {
  courtName: string;      // 법원명 (예: "수원가정법원")
  caseYear: string;       // 사건번호 년도 (예: "2024")
  caseType: string;       // 사건번호 구분 (예: "드단", "가합")
  caseNumber: string;     // 사건번호 번호 (예: "26718")
  partyName: string;      // 당사자명
}

export interface CaseSearchResult {
  success: boolean;
  data?: any;
  error?: string;
  captchaText?: string;   // 인식된 캡챠 (디버깅용)
}

export class ScourtScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  private readonly SCOURT_URL = 'https://www.scourt.go.kr/portal/information/events/search/search.jsp';
  private readonly MAX_RETRY = 3;  // 캡챠 인식 재시도 횟수

  /**
   * 브라우저 시작
   */
  async initialize(headless: boolean = true): Promise<void> {
    this.browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    // User Agent 설정 (봇 감지 우회)
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  /**
   * 사건 검색
   */
  async searchCase(params: CaseSearchParams): Promise<CaseSearchResult> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }

    try {
      console.log('📍 대법원 사건검색 페이지 접속...');
      await this.page.goto(this.SCOURT_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 동적 콘텐츠 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log('✓ 페이지 로드 완료');

      // iframe 찾기
      console.log('\n📍 iframe 찾기...');
      const frames = this.page.frames();
      const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

      if (!targetFrame) {
        throw new Error('검색 폼 iframe을 찾을 수 없습니다');
      }

      console.log('✓ iframe 발견:', targetFrame.url());

      // iframe이 완전히 로드될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 검색 폼 입력
      await this.fillSearchForm(params);

      // 캡챠 해결 및 검색 수행 (재시도 로직 포함)
      for (let attempt = 1; attempt <= this.MAX_RETRY; attempt++) {
        console.log(`\n🔄 캡챠 인식 시도 ${attempt}/${this.MAX_RETRY}...`);

        const result = await this.solveCaptchaAndSubmit();

        if (result.success) {
          // 검색 결과 파싱
          const searchResult = await this.parseSearchResult();
          return {
            success: true,
            data: searchResult,
            captchaText: result.captchaText
          };
        }

        if (attempt < this.MAX_RETRY) {
          console.log(`⚠️  캡챠 인식 실패. 재시도합니다...`);
          // 캡챠 새로고침 버튼 클릭 (있다면)
          await this.refreshCaptcha();
        }
      }

      return {
        success: false,
        error: `캡챠 인식 실패 (${this.MAX_RETRY}회 시도)`
      };

    } catch (error) {
      console.error('사건 검색 중 에러:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 에러'
      };
    }
  }

  /**
   * 검색 폼 입력
   */
  private async fillSearchForm(params: CaseSearchParams): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('\n📝 검색 폼 입력 중...');

    // TODO: 실제 필드명은 페이지 분석 후 수정 필요
    // 현재는 예상되는 필드명 사용

    // 법원명 (드롭다운일 수 있음)
    try {
      await this.page.select('select[name="court_name"]', params.courtName);
      console.log(`✓ 법원명: ${params.courtName}`);
    } catch {
      console.log('⚠️  법원명 필드 찾기 실패 (스킵)');
    }

    // 사건번호 년도
    try {
      await this.page.select('select[name="caseNumberYear"]', params.caseYear);
      console.log(`✓ 년도: ${params.caseYear}`);
    } catch {
      console.log('⚠️  년도 필드 찾기 실패 (스킵)');
    }

    // 사건번호 구분
    try {
      await this.page.select('select[name="caseNumberType"]', params.caseType);
      console.log(`✓ 구분: ${params.caseType}`);
    } catch {
      console.log('⚠️  구분 필드 찾기 실패 (스킵)');
    }

    // 사건번호
    try {
      await this.page.type('input[name="caseNumberNumber"]', params.caseNumber);
      console.log(`✓ 사건번호: ${params.caseNumber}`);
    } catch {
      console.log('⚠️  사건번호 필드 찾기 실패 (스킵)');
    }

    // 당사자명
    try {
      await this.page.type('input[name="userName"]', params.partyName);
      console.log(`✓ 당사자명: ${params.partyName}`);
    } catch {
      console.log('⚠️  당사자명 필드 찾기 실패 (스킵)');
    }
  }

  /**
   * 캡챠 해결 및 검색 제출
   */
  private async solveCaptchaAndSubmit(): Promise<{ success: boolean; captchaText?: string }> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // 1. 캡챠 이미지 찾기 및 다운로드
      const captchaBuffer = await this.getCaptchaImage();

      if (!captchaBuffer) {
        return { success: false };
      }

      // 2. Vision API로 캡챠 인식
      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(captchaBuffer);

      if (!result.success || !result.text) {
        console.log('❌ 캡챠 인식 실패:', result.error);
        return { success: false };
      }

      console.log(`✓ 캡챠 인식 성공: "${result.text}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);

      // 3. 캡챠 입력
      await this.page.type('input[name="secureNo"]', result.text);

      // 4. 검색 버튼 클릭
      await this.page.click('button[onclick*="search"], input[type="submit"]');

      // 5. 결과 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 6. 에러 메시지 확인
      const hasError = await this.page.evaluate(() => {
        const errorText = document.body.textContent || '';
        return errorText.includes('보안문자') && errorText.includes('일치하지');
      });

      if (hasError) {
        console.log('❌ 캡챠 불일치');
        return { success: false, captchaText: result.text };
      }

      return { success: true, captchaText: result.text };

    } catch (error) {
      console.error('캡챠 해결 중 에러:', error);
      return { success: false };
    }
  }

  /**
   * 캡챠 이미지 가져오기
   */
  private async getCaptchaImage(): Promise<Buffer | null> {
    if (!this.page) return null;

    try {
      // 캡챠 이미지 element 찾기
      const captchaElement = await this.page.$('img[src*="captcha"], img[src*="secure"], img[alt*="보안"]');

      if (!captchaElement) {
        console.log('⚠️  캡챠 이미지를 찾을 수 없습니다');
        return null;
      }

      // 이미지 스크린샷
      const screenshot = await captchaElement.screenshot();
      return Buffer.from(screenshot);

    } catch (error) {
      console.error('캡챠 이미지 추출 실패:', error);
      return null;
    }
  }

  /**
   * 캡챠 새로고침
   */
  private async refreshCaptcha(): Promise<void> {
    if (!this.page) return;

    try {
      // 새로고침 버튼 클릭
      const refreshButton = await this.page.$('a[onclick*="refresh"], button[onclick*="refresh"]');
      if (refreshButton) {
        await refreshButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch {
      // 새로고침 버튼이 없으면 무시
    }
  }

  /**
   * 검색 결과 파싱
   */
  private async parseSearchResult(): Promise<any> {
    if (!this.page) return null;

    try {
      // TODO: 실제 결과 페이지 구조에 따라 파싱 로직 구현
      const result = await this.page.evaluate(() => {
        // 기일 정보 추출
        const hearingRows = Array.from(document.querySelectorAll('table tr'));

        const hearings = hearingRows.map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 4) return null;

          return {
            date: cells[0]?.textContent?.trim(),
            time: cells[1]?.textContent?.trim(),
            type: cells[2]?.textContent?.trim(),
            place: cells[3]?.textContent?.trim(),
            result: cells[4]?.textContent?.trim()
          };
        }).filter(Boolean);

        return {
          hearings,
          rawHtml: document.body.innerHTML
        };
      });

      return result;

    } catch (error) {
      console.error('결과 파싱 실패:', error);
      return null;
    }
  }

  /**
   * 브라우저 종료
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
