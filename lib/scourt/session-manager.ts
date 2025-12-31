/**
 * 대법원 나의사건검색 세션 매니저
 *
 * 핵심 기능:
 * 1. Puppeteer userDataDir 기반 프로필 관리
 * 2. 로컬 스토리지에 저장된 사건은 캡챠 없이 접근
 * 3. 프로필당 최대 50건 저장 (대법원 제한)
 * 4. 변호사별 프로필 격리
 */

import puppeteer, { Browser, Page, Frame } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@/lib/supabase';
import { solveCaptchaWithModel, isModelAvailable, shouldUseVisionAPI } from './captcha-solver';
import { getVisionCaptchaSolver } from '../google/vision-captcha-solver';

// 프로필 저장 위치
const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');

// URL 및 셀렉터 상수
const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
const SELECTORS = {
  // 검색 폼
  courtSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd',
  yearSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csYr',
  typeSelect: '#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd',
  serialInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_csSerial',
  partyInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_btprNm',
  saveCheckbox: '#mf_ssgoTopMainTab_contents_content1_body_cbx_saveCsRsltYn_input_0',

  // 캡챠 (2024-12 현재 셀렉터)
  captchaImg: '#mf_ssgoTopMainTab_contents_content1_body_img_captcha',
  captchaInput: '#mf_ssgoTopMainTab_contents_content1_body_ibx_answer',
  captchaRefresh: '#mf_ssgoTopMainTab_contents_content1_body_btn_reloadCaptcha',

  // 버튼
  searchButton: '#mf_ssgoTopMainTab_contents_content1_body_btn_srchCs',

  // 결과
  savedCasesTable: '#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody',
};

// 타입 정의
export interface ProfileConfig {
  id: string;
  lawyerId: string | null;
  profileName: string;
  userDataDir: string;
  caseCount: number;
  maxCases: number;
  status: 'active' | 'full' | 'corrupted';
}

export interface UserSettings {
  userId: string | null;
  maxProfiles: number;
  maxCasesPerProfile: number;
}

export interface ProfileUsage {
  userId: string | null;
  profileCount: number;
  totalCases: number;
  maxProfiles: number;
  remainingProfiles: number;
  maxTotalCases: number;
}

export interface SearchParams {
  courtCode?: string;
  caseYear: string;
  caseType: string;
  caseSerial: string;
  partyName?: string;
}

export interface SearchResult {
  success: boolean;
  caseInfo?: {
    court: string;
    caseNumber: string;
    caseName: string;
    encCsNo?: string;
  };
  captchaAttempts: number;
  error?: string;
}

export interface CaseDetail {
  caseNumber: string;
  caseName: string;
  court: string;
  plaintiffs: string[];
  defendants: string[];
  judge: string;
  filingDate: string;
  hearings: Array<{
    date: string;
    time: string;
    type: string;
    location: string;
    result?: string;
  }>;
  status?: string;
  rawData?: any;
}

export interface DetailResult {
  success: boolean;
  detail?: CaseDetail;
  page?: Page;  // 스크래퍼용 페이지 반환
  error?: string;
}

/**
 * 대법원 세션 매니저
 */
export class ScourtSessionManager {
  private activeBrowsers: Map<string, Browser> = new Map();
  private activePages: Map<string, Page> = new Map();
  private supabase = createClient();

  constructor() {
    // 프로필 디렉토리 생성
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }
  }

  /**
   * 사용자 설정 조회 (프로필 제한)
   */
  async getUserSettings(userId?: string): Promise<UserSettings> {
    // 사용자별 설정 조회
    if (userId) {
      const { data: userSettings } = await this.supabase
        .from('scourt_user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userSettings) {
        return {
          userId,
          maxProfiles: userSettings.max_profiles,
          maxCasesPerProfile: userSettings.max_cases_per_profile,
        };
      }
    }

    // 기본 설정 조회 (user_id = null)
    const { data: defaultSettings } = await this.supabase
      .from('scourt_user_settings')
      .select('*')
      .is('user_id', null)
      .single();

    return {
      userId: userId || null,
      maxProfiles: defaultSettings?.max_profiles || 6,
      maxCasesPerProfile: defaultSettings?.max_cases_per_profile || 50,
    };
  }

  /**
   * 프로필 사용량 조회
   */
  async getProfileUsage(userId?: string): Promise<ProfileUsage> {
    const settings = await this.getUserSettings(userId);

    // 해당 사용자의 프로필 목록 조회
    let query = this.supabase.from('scourt_profiles').select('*');

    if (userId) {
      query = query.eq('lawyer_id', userId);
    }

    const { data: profiles } = await query;

    const profileCount = profiles?.length || 0;
    const totalCases = profiles?.reduce((sum, p) => sum + (p.case_count || 0), 0) || 0;

    return {
      userId: userId || null,
      profileCount,
      totalCases,
      maxProfiles: settings.maxProfiles,
      remainingProfiles: settings.maxProfiles - profileCount,
      maxTotalCases: settings.maxProfiles * settings.maxCasesPerProfile,
    };
  }

  /**
   * 프로필 조회 또는 생성 (프로필 풀 제한 적용)
   */
  async getOrCreateProfile(lawyerId?: string): Promise<ProfileConfig> {
    // 1. 사용자 설정 및 현재 사용량 조회
    const settings = await this.getUserSettings(lawyerId);
    const usage = await this.getProfileUsage(lawyerId);

    // 2. 기존 활성 프로필 중 여유 있는 것 찾기
    let query = this.supabase
      .from('scourt_profiles')
      .select('*')
      .eq('status', 'active')
      .order('case_count', { ascending: true });

    if (lawyerId) {
      query = query.eq('lawyer_id', lawyerId);
    }

    const { data: activeProfiles } = await query;

    // 여유 있는 프로필이 있으면 반환
    const availableProfile = activeProfiles?.find(
      (p) => p.case_count < p.max_cases
    );

    if (availableProfile) {
      return this.toProfileConfig(availableProfile);
    }

    // 3. 새 프로필 생성이 필요한 경우, 제한 확인
    if (usage.remainingProfiles <= 0) {
      throw new Error(
        `프로필 제한 초과: 현재 ${usage.profileCount}/${settings.maxProfiles}개 프로필 사용 중. ` +
        `총 ${usage.totalCases}/${usage.maxTotalCases}건 저장 중. ` +
        `추가 프로필을 생성하려면 관리자에게 문의하세요.`
      );
    }

    // 4. 새 프로필 생성
    const profileName = `profile_${lawyerId || 'default'}_${Date.now()}`;
    const userDataDir = path.join(PROFILES_DIR, profileName);

    const { data: newProfile, error } = await this.supabase
      .from('scourt_profiles')
      .insert({
        lawyer_id: lawyerId || null,
        profile_name: profileName,
        case_count: 0,
        max_cases: settings.maxCasesPerProfile,
        status: 'active',
      })
      .select()
      .single();

    if (error || !newProfile) {
      throw new Error(`프로필 생성 실패: ${error?.message}`);
    }

    console.log(
      `📁 새 프로필 생성: ${profileName} ` +
      `(${usage.profileCount + 1}/${settings.maxProfiles}개)`
    );

    return this.toProfileConfig(newProfile);
  }

  /**
   * 브라우저 시작 (프로필 로드)
   */
  async launchBrowser(profile: ProfileConfig, headless: boolean = true): Promise<Page> {
    // 이미 활성 브라우저가 있는지 확인
    const existingPage = this.activePages.get(profile.profileName);
    if (existingPage) {
      return existingPage;
    }

    const browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir: profile.userDataDir,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    this.activeBrowsers.set(profile.profileName, browser);
    this.activePages.set(profile.profileName, page);

    return page;
  }

  /**
   * 대법원 사이트 접속
   */
  async navigateToScourt(page: Page): Promise<void> {
    await page.goto(SCOURT_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await this.wait(2000);
  }

  /**
   * 사건 검색 (캡챠 필요)
   */
  async searchCase(
    profile: ProfileConfig,
    params: SearchParams,
    maxRetries: number = 10,
    headless: boolean = false  // 테스트용 기본값 false
  ): Promise<SearchResult> {
    const startTime = Date.now();
    let captchaAttempts = 0;

    try {
      const page = await this.launchBrowser(profile, headless);
      await this.navigateToScourt(page);

      // 검색 폼 입력
      await this.fillSearchForm(page, params);

      // 캡챠 해결 및 검색
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        captchaAttempts = attempt;
        console.log(`🔄 캡챠 시도 ${attempt}/${maxRetries}...`);

        const captchaResult = await this.solveCaptchaAndSubmit(page);

        if (captchaResult.success) {
          await this.wait(2000);

          // 결과 확인
          const caseInfo = await this.extractSearchResult(page);

          if (caseInfo) {
            // DB에 저장
            await this.saveCaseToProfile(profile, caseInfo);
            await this.logSync(profile.id, null, 'search', 'success', captchaAttempts, Date.now() - startTime);

            return {
              success: true,
              caseInfo,
              captchaAttempts,
            };
          }
        }

        if (attempt < maxRetries) {
          await this.refreshCaptcha(page);
          await this.wait(1000);
        }
      }

      await this.logSync(profile.id, null, 'search', 'captcha_error', captchaAttempts, Date.now() - startTime);

      return {
        success: false,
        captchaAttempts,
        error: `캡챠 인식 실패 (${maxRetries}회 시도)`,
      };

    } catch (error) {
      await this.logSync(profile.id, null, 'search', 'failed', captchaAttempts, Date.now() - startTime, error);
      throw error;
    }
  }

  /**
   * 저장된 사건 상세 조회 (캡챠 불필요!)
   * @param returnPage - true면 페이지도 반환 (스크래퍼용)
   */
  async getCaseDetail(
    profile: ProfileConfig,
    caseNumber: string,
    returnPage: boolean = false
  ): Promise<DetailResult> {
    const startTime = Date.now();

    try {
      const page = await this.launchBrowser(profile);
      await this.navigateToScourt(page);

      // 저장된 사건 목록에서 클릭
      const clicked = await this.clickSavedCase(page, caseNumber);

      if (!clicked) {
        return {
          success: false,
          error: `저장된 사건을 찾을 수 없습니다: ${caseNumber}`,
        };
      }

      await this.wait(3000);

      // 상세 정보 추출
      const detail = await this.extractCaseDetail(page);

      if (detail) {
        await this.logSync(profile.id, null, 'detail', 'success', 0, Date.now() - startTime);

        return {
          success: true,
          detail,
          page: returnPage ? page : undefined,
        };
      }

      return {
        success: false,
        error: '상세 정보 추출 실패',
        page: returnPage ? page : undefined,
      };

    } catch (error) {
      await this.logSync(profile.id, null, 'detail', 'failed', 0, Date.now() - startTime, error);
      throw error;
    }
  }

  /**
   * 저장된 사건 목록 조회 (HTML 테이블에서)
   */
  async getSavedCases(profile: ProfileConfig): Promise<Array<{ court: string; caseNumber: string; caseName: string }>> {
    try {
      const page = await this.launchBrowser(profile);
      await this.navigateToScourt(page);

      const cases = await page.evaluate((selector) => {
        const tbody = document.querySelector(selector);
        if (!tbody) return [];

        const rows = Array.from(tbody.querySelectorAll('tr'));
        return rows.map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          return {
            court: cells[2]?.textContent?.trim() || '',
            caseNumber: cells[3]?.textContent?.trim() || '',
            caseName: cells[4]?.textContent?.trim() || '',
          };
        });
      }, SELECTORS.savedCasesTable);

      return cases;

    } catch (error) {
      console.error('저장된 사건 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 저장된 사건 목록 조회 (WebSquare DataList에서 encCsNo 포함)
   */
  async getSavedCasesWithEncCsNo(profile: ProfileConfig): Promise<Array<{
    court: string;
    courtCode: string;
    caseNumber: string;
    caseName: string;
    encCsNo: string;
    csYear: string;
    csDvsCd: string;
    csSerial: string;
  }>> {
    try {
      const page = await this.launchBrowser(profile);
      await this.navigateToScourt(page);

      // WebSquare DataList에서 데이터 추출
      const cases = await page.evaluate(() => {
        // WebSquare dlt_csSrchHistList에서 데이터 가져오기
        const histList = (window as any)['mf_ssgoTopMainTab_contents_content1_body_dlt_csSrchHistList'];

        if (histList && histList.getRowCount) {
          const count = histList.getRowCount();
          const data = [];

          for (let i = 0; i < count; i++) {
            const row = histList.getRowJSON(i);
            data.push({
              court: row.cortNm || '',
              courtCode: row.cortCd || '',
              caseNumber: row.csNo || '',
              caseName: row.csNm || '',
              encCsNo: row.encCsNo || '',
              csYear: row.csYear || '',
              csDvsCd: row.csDvsCd || '',
              csSerial: row.csSerial || '',
            });
          }

          return data;
        }

        // fallback: localStorage에서 시도 (Base64 + URL 인코딩)
        const csHist = localStorage.getItem('SSGO10LM01_CS_SRCH_HIST_mainCsHist');
        if (!csHist) return [];

        try {
          // Base64 디코딩 → URL 디코딩 → JSON 파싱
          const base64Decoded = atob(csHist);
          const urlDecoded = decodeURIComponent(base64Decoded);
          const parsed = JSON.parse(urlDecoded);

          if (!Array.isArray(parsed)) return [];

          return parsed.map((item: any) => ({
            court: item.cortNm || '',
            courtCode: item.cortCd || '',
            caseNumber: item.csNo || '',
            caseName: item.csNm || '',
            encCsNo: item.encCsNo || '',
            csYear: item.csYear || '',
            csDvsCd: item.csDvsCd || '',
            csSerial: item.csSerial || '',
          }));
        } catch {
          return [];
        }
      });

      return cases;

    } catch (error) {
      console.error('사건 목록 조회 실패:', error);
      return [];
    }
  }

  /**
   * 브라우저 localStorage 데이터를 DB에 동기화
   */
  async syncBrowserToDb(profile: ProfileConfig): Promise<{ synced: number; errors: number }> {
    console.log(`📦 브라우저 → DB 동기화 시작 (프로필: ${profile.profileName})`);

    const cases = await this.getSavedCasesWithEncCsNo(profile);
    console.log(`  발견된 사건: ${cases.length}건`);

    let synced = 0;
    let errors = 0;

    for (const caseItem of cases) {
      try {
        await this.supabase.from('scourt_profile_cases').upsert(
          {
            profile_id: profile.id,
            court_code: caseItem.courtCode,
            court_name: caseItem.court,
            case_number: caseItem.caseNumber,
            case_name: caseItem.caseName,
            enc_cs_no: caseItem.encCsNo,
            last_accessed_at: new Date().toISOString(),
          },
          { onConflict: 'profile_id,case_number' }
        );
        synced++;
      } catch (error) {
        console.error(`  ❌ 저장 실패: ${caseItem.caseNumber}`, error);
        errors++;
      }
    }

    // 프로필 case_count 업데이트
    await this.supabase
      .from('scourt_profiles')
      .update({ case_count: synced, last_sync_at: new Date().toISOString() })
      .eq('id', profile.id);

    console.log(`✅ 동기화 완료: ${synced}건 성공, ${errors}건 실패`);

    return { synced, errors };
  }

  /**
   * 프로필 상태 조회
   */
  async getProfileStatus(profileId: string): Promise<ProfileConfig | null> {
    const { data } = await this.supabase
      .from('scourt_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    return data ? this.toProfileConfig(data) : null;
  }

  /**
   * 브라우저 종료
   */
  async closeBrowser(profileName: string): Promise<void> {
    const browser = this.activeBrowsers.get(profileName);
    if (browser) {
      await browser.close();
      this.activeBrowsers.delete(profileName);
      this.activePages.delete(profileName);
    }
  }

  /**
   * 모든 브라우저 종료
   */
  async closeAll(): Promise<void> {
    for (const [name, browser] of this.activeBrowsers) {
      await browser.close();
    }
    this.activeBrowsers.clear();
    this.activePages.clear();
  }

  // === Private Methods ===

  private async fillSearchForm(page: Page, params: SearchParams): Promise<void> {
    // "사건검색 결과 저장" 체크 확인
    const isChecked = await page.$eval(SELECTORS.saveCheckbox, (el: any) => el.checked);
    if (!isChecked) {
      await page.click(SELECTORS.saveCheckbox);
    }

    // 법원 선택
    if (params.courtCode) {
      await page.select(SELECTORS.courtSelect, params.courtCode);
      await this.wait(500);
    }

    // 연도 선택
    await page.select(SELECTORS.yearSelect, params.caseYear);
    await this.wait(300);

    // 사건 구분 선택
    await page.select(SELECTORS.typeSelect, params.caseType);
    await this.wait(300);

    // 사건 일련번호 입력
    await page.type(SELECTORS.serialInput, params.caseSerial);

    // 당사자명 입력 (필수)
    if (params.partyName) {
      await page.type(SELECTORS.partyInput, params.partyName);
    }
  }

  private async solveCaptchaAndSubmit(page: Page): Promise<{ success: boolean; captchaText?: string }> {
    try {
      // 캡챠 이미지 캡처
      const captchaElement = await page.$(SELECTORS.captchaImg);
      if (!captchaElement) {
        console.log('❌ 캡챠 이미지를 찾을 수 없습니다');
        return { success: false };
      }

      const screenshot = await captchaElement.screenshot();
      const imageBuffer = Buffer.from(screenshot);

      // 캡챠 인식 전략:
      // - RGB 이미지 (실제 브라우저 캡챠): Vision API 우선 사용 (더 정확)
      // - RGBA 이미지 (학습 데이터): CNN 모델 사용 (98.47% 정확도)
      let captchaText: string | null = null;
      const useVisionFirst = shouldUseVisionAPI(imageBuffer);

      if (useVisionFirst) {
        // 실제 브라우저 캡챠 (RGB) - Vision API 우선
        console.log('📸 RGB 이미지 감지 - Vision API 우선 사용');
        const solver = getVisionCaptchaSolver();
        const result = await solver.solveCaptcha(imageBuffer);
        if (result.success && result.text) {
          captchaText = result.text;
          console.log(`👁️ Vision API 인식: "${captchaText}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);
        }

        // Vision API 실패 시 CNN 모델 폴백
        if (!captchaText && isModelAvailable()) {
          captchaText = await solveCaptchaWithModel(imageBuffer);
          if (captchaText) {
            console.log(`🤖 CNN 모델 폴백 인식: "${captchaText}"`);
          }
        }
      } else {
        // RGBA 이미지 (학습 데이터) - CNN 모델 우선
        console.log('🖼️ RGBA 이미지 감지 - CNN 모델 우선 사용');
        if (isModelAvailable()) {
          captchaText = await solveCaptchaWithModel(imageBuffer);
          if (captchaText) {
            console.log(`🤖 CNN 모델 인식: "${captchaText}"`);
          }
        }

        // CNN 모델 실패 시 Vision API 폴백
        if (!captchaText) {
          const solver = getVisionCaptchaSolver();
          const result = await solver.solveCaptcha(imageBuffer);
          if (result.success && result.text) {
            captchaText = result.text;
            console.log(`👁️ Vision API 폴백 인식: "${captchaText}" (신뢰도: ${(result.confidence * 100).toFixed(1)}%)`);
          }
        }
      }

      if (!captchaText) {
        console.log('❌ 캡챠 인식 실패');
        return { success: false };
      }

      // 캡챠 입력
      await page.type(SELECTORS.captchaInput, captchaText);

      // 검색 버튼 클릭
      await page.click(SELECTORS.searchButton);
      await this.wait(2000);

      // 에러 확인
      const hasError = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('보안문자') && text.includes('일치하지');
      });

      if (hasError) {
        console.log('❌ 캡챠 불일치');
        // 입력 필드 초기화
        await page.$eval(SELECTORS.captchaInput, (el: any) => (el.value = ''));
        return { success: false, captchaText };
      }

      return { success: true, captchaText };

    } catch (error) {
      console.error('캡챠 해결 중 에러:', error);
      return { success: false };
    }
  }

  private async refreshCaptcha(page: Page): Promise<void> {
    try {
      await page.click(SELECTORS.captchaRefresh);
      await this.wait(1000);
    } catch (error) {
      console.log('캡챠 새로고침 버튼 찾기 실패, 대체 방법 시도');
      // 대체 방법: 새로고침 버튼이 다른 셀렉터일 수 있음
    }
  }

  private async extractSearchResult(page: Page): Promise<{ court: string; caseNumber: string; caseName: string } | null> {
    try {
      const result = await page.evaluate((selector) => {
        const tbody = document.querySelector(selector);
        if (!tbody) return null;

        const firstRow = tbody.querySelector('tr');
        if (!firstRow) return null;

        const cells = Array.from(firstRow.querySelectorAll('td'));
        return {
          court: cells[2]?.textContent?.trim() || '',
          caseNumber: cells[3]?.textContent?.trim() || '',
          caseName: cells[4]?.textContent?.trim() || '',
        };
      }, SELECTORS.savedCasesTable);

      return result;
    } catch (error) {
      console.error('검색 결과 추출 실패:', error);
      return null;
    }
  }

  private async clickSavedCase(page: Page, caseNumber: string): Promise<boolean> {
    try {
      const clicked = await page.evaluate((selector, targetCaseNumber) => {
        const tbody = document.querySelector(selector);
        if (!tbody) return false;

        const rows = Array.from(tbody.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          const caseNumCell = cells[3];
          if (caseNumCell?.textContent?.trim() === targetCaseNumber) {
            // 사건번호 링크 클릭
            const link = caseNumCell.querySelector('a');
            if (link) {
              link.click();
              return true;
            }
            // 행 클릭
            (row as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, SELECTORS.savedCasesTable, caseNumber);

      return clicked;
    } catch (error) {
      console.error('사건 클릭 실패:', error);
      return false;
    }
  }

  private async extractCaseDetail(page: Page): Promise<CaseDetail | null> {
    try {
      await this.wait(2000);

      const detail = await page.evaluate(() => {
        // 기본 정보 추출
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el?.textContent?.trim() || '';
        };

        // 테이블에서 정보 추출
        const rows = Array.from(document.querySelectorAll('table tr'));
        const data: Record<string, string> = {};

        for (const row of rows) {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td) {
            data[th.textContent?.trim() || ''] = td.textContent?.trim() || '';
          }
        }

        // 기일 정보 추출
        const hearings: Array<{ date: string; time: string; type: string; location: string; result?: string }> = [];
        const hearingRows = document.querySelectorAll('.hearing-table tr, #hearingGrid tr');
        hearingRows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 4) {
            hearings.push({
              date: cells[0]?.textContent?.trim() || '',
              time: cells[1]?.textContent?.trim() || '',
              type: cells[2]?.textContent?.trim() || '',
              location: cells[3]?.textContent?.trim() || '',
              result: cells[4]?.textContent?.trim(),
            });
          }
        });

        return {
          caseNumber: data['사건번호'] || '',
          caseName: data['사건명'] || '',
          court: data['법원'] || '',
          plaintiffs: (data['원고'] || '').split(',').map((s) => s.trim()).filter(Boolean),
          defendants: (data['피고'] || '').split(',').map((s) => s.trim()).filter(Boolean),
          judge: data['재판부'] || '',
          filingDate: data['접수일'] || '',
          hearings,
          status: data['종국결과'] || data['상태'],
          rawData: data,
        };
      });

      return detail;
    } catch (error) {
      console.error('상세 정보 추출 실패:', error);
      return null;
    }
  }

  private async saveCaseToProfile(
    profile: ProfileConfig,
    caseInfo: { court: string; caseNumber: string; caseName: string; encCsNo?: string }
  ): Promise<void> {
    await this.supabase.from('scourt_profile_cases').upsert(
      {
        profile_id: profile.id,
        court_name: caseInfo.court,
        case_number: caseInfo.caseNumber,
        case_name: caseInfo.caseName,
        enc_cs_no: caseInfo.encCsNo || null,  // encCsNo 저장 추가
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id,case_number' }
    );
  }

  private async logSync(
    profileId: string,
    legalCaseId: string | null,
    action: string,
    status: string,
    captchaAttempts: number,
    durationMs: number,
    error?: any
  ): Promise<void> {
    await this.supabase.from('scourt_sync_logs').insert({
      profile_id: profileId,
      legal_case_id: legalCaseId,
      action,
      status,
      captcha_attempts: captchaAttempts,
      duration_ms: durationMs,
      error_message: error ? String(error) : null,
    });
  }

  private toProfileConfig(data: any): ProfileConfig {
    return {
      id: data.id,
      lawyerId: data.lawyer_id,
      profileName: data.profile_name,
      userDataDir: path.join(PROFILES_DIR, data.profile_name),
      caseCount: data.case_count,
      maxCases: data.max_cases,
      status: data.status,
    };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
let sessionManager: ScourtSessionManager | null = null;

export function getScourtSessionManager(): ScourtSessionManager {
  if (!sessionManager) {
    sessionManager = new ScourtSessionManager();
  }
  return sessionManager;
}
