/**
 * 대법원 나의사건검색 스크래퍼 V2 (iframe 지원)
 */

import puppeteer, { Browser, Page, Frame } from 'puppeteer';
import { getVisionCaptchaSolver } from '../google/vision-captcha-solver';

export interface CaseSearchParams {
  courtName: string;
  caseYear: string;
  caseType: string;
  caseNumber: string;
  partyName: string;
}

export interface CaseSearchResult {
  success: boolean;
  data?: any;
  error?: string;
  captchaText?: string;
}

export class ScourtScraperV2 {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly SCOURT_URL = 'https://www.scourt.go.kr/portal/information/events/search/search.jsp';
  private readonly MAX_RETRY = 3;

  async initialize(headless: boolean = true): Promise<void> {
    this.browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async searchCase(params: CaseSearchParams): Promise<CaseSearchResult> {
    if (!this.page) {
      throw new Error('브라우저가 초기화되지 않았습니다');
    }

    try {
      console.log('📍 대법원 사건검색 페이지 접속...');
      await this.page.goto(this.SCOURT_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✓ 페이지 로드 완료');

      // iframe 찾기
      console.log('\n📍 iframe 찾기...');
      const frames = this.page.frames();
      const targetFrame = frames.find(f => f.url().includes('ssgo.scourt.go.kr'));

      if (!targetFrame) {
        throw new Error('검색 폼 iframe을 찾을 수 없습니다');
      }

      console.log('✓ iframe 발견');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 법원 선택 (드롭다운)
      if (params.courtName) {
        console.log('\n📝 법원 선택:', params.courtName);
        try {
          await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', params.courtName);
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log(`⚠️  법원 선택 실패 (스킵): ${error}`);
        }
      }

      // 사건번호 입력 (형식: "2024드단26718")
      const fullCaseNo = `${params.caseYear}${params.caseType}${params.caseNumber}`;
      console.log('📝 사건번호 입력:', fullCaseNo);

      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_fullCsNo', fullCaseNo);

      // 당사자명 입력
      console.log('📝 당사자명 입력:', params.partyName);
      await targetFrame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm', params.partyName);

      // 캡챠 해결 및 검색
      for (let attempt = 1; attempt <= this.MAX_RETRY; attempt++) {
        console.log(`\n🔄 캡챠 인식 시도 ${attempt}/${this.MAX_RETRY}...`);

        const result = await this.solveCaptchaAndSubmit(targetFrame);

        if (result.success) {
          await new Promise(resolve => setTimeout(resolve, 3000));

          // 결과 파싱
          const searchResult = await this.parseResult(targetFrame);
          return {
            success: true,
            data: searchResult,
            captchaText: result.captchaText
          };
        }

        if (attempt < this.MAX_RETRY) {
          console.log('⚠️  캡챠 인식 실패. 재시도...');
          // 캡챠 새로고침
          await targetFrame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha');
          await new Promise(resolve => setTimeout(resolve, 1000));
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

  private async solveCaptchaAndSubmit(frame: Frame): Promise<{ success: boolean; captchaText?: string }> {
    try {
      // 캡챠 이미지 찾기 (iframe 내부에서)
      const captchaImage = await frame.$('#mf_ssgoTopMainTab_contents_content1_body_img_captcha');

      if (!captchaImage) {
        console.log('❌ 캡챠 이미지를 찾을 수 없습니다');
        return { success: false };
      }

      // 캡챠 이미지 스크린샷
      const screenshot = await captchaImage.screenshot();

      // Vision API로 인식
      const solver = getVisionCaptchaSolver();
      const result = await solver.solveCaptcha(Buffer.from(screenshot));

      if (!result.success || !result.text) {
        console.log('❌ 캡챠 인식 실패:', result.error);
        return { success: false };
      }

      console.log(`✓ 캡챠 인식 성공: "${result.text}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);

      // 캡챠 입력
      await frame.type('#mf_ssgoTopMainTab_contents_content1_body_ibx_answer', result.text);

      // 검색 버튼 클릭
      await frame.click('#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs');

      // 결과 로딩 대기
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 에러 메시지 확인
      const hasError = await frame.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('보안문자') && text.includes('일치하지');
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

  private async parseResult(frame: Frame): Promise<any> {
    try {
      // 결과 테이블 파싱
      const result = await frame.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tr'));

        return {
          rawText: document.body.textContent?.substring(0, 1000),
          tableRows: rows.length,
          success: true
        };
      });

      return result;

    } catch (error) {
      console.error('결과 파싱 실패:', error);
      return { success: false, error };
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
