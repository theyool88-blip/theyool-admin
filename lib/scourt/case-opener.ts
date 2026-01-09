/**
 * SCOURT 사건 페이지(일반내용 탭) 열기
 *
 * Puppeteer를 사용하여 SCOURT에서 사건을 찾아 일반내용 탭 화면을 열어줍니다.
 * 브라우저 창을 닫지 않고 유지하여 사용자가 직접 조회할 수 있게 합니다.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'path';

// 싱글톤 브라우저 인스턴스 (progress-scraper와 공유)
let browserInstance: Browser | null = null;

/**
 * 브라우저 인스턴스 획득 (재사용)
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  const profileDir = path.join(process.cwd(), 'data/scourt-profiles/profile_1767095937486');

  browserInstance = await puppeteer.launch({
    headless: false,  // 사용자가 볼 수 있도록 GUI 모드
    userDataDir: profileDir,
    defaultViewport: null,  // 전체 화면 사용
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--start-maximized',  // 최대화
    ]
  });

  return browserInstance;
}

export interface OpenCaseResult {
  success: boolean;
  error?: string;
}

export interface OpenCaseParams {
  caseNumber: string;
  wmonid?: string;   // 세션 ID
  encCsNo?: string;  // 암호화된 사건번호
  courtName?: string; // 법원명
  partyName?: string; // 당사자명 (의뢰인 또는 상대방)
}

/**
 * SCOURT에서 사건 페이지(일반내용 탭) 열기
 *
 * encCsNo를 사용해서 직접 일반내용 화면을 로드합니다.
 * 저장된 사건 목록에 의존하지 않고, API와 동일한 방식으로 동작합니다.
 */
export async function openCaseInBrowser(params: OpenCaseParams): Promise<OpenCaseResult> {
  const { caseNumber, wmonid, encCsNo, courtName, partyName } = params;
  let page: Page | null = null;

  if (!encCsNo) {
    return {
      success: false,
      error: 'encCsNo가 필요합니다. 먼저 사건을 연동해주세요.',
    };
  }

  try {
    const browser = await getBrowser();

    // 기존 SCOURT 탭 닫기 (detached frame 문제 방지)
    const pages = await browser.pages();
    for (const p of pages) {
      if (p.url().includes('scourt.go.kr')) {
        await p.close();
      }
    }

    // 새 탭 생성
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 팝업/알림 자동 처리
    page.on('dialog', async dialog => await dialog.accept());

    // SCOURT 페이지로 이동 (wmonid를 URL 파라미터로 전달하여 세션 복원)
    const baseUrl = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';
    const url = wmonid ? `${baseUrl}&wmonid=${wmonid}` : baseUrl;
    console.log(`🔗 SCOURT 접속: ${url.substring(0, 80)}...`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // SCOURT 페이지의 특정 요소가 나타날 때까지 대기
    console.log('⏳ SCOURT 페이지 로딩 대기...');
    try {
      await page.waitForSelector('#mf_ssgoTopMainTab', { timeout: 30000 });
      console.log('✅ 메인 탭 로드됨');
    } catch (e) {
      console.log('⚠️ 메인 탭 대기 타임아웃, 계속 진행...');
    }

    // 추가 안정화 대기
    await new Promise(r => setTimeout(r, 3000));

    // encCsNo를 사용해서 직접 사건 일반내용 탭 로드
    console.log(`📋 encCsNo로 사건 일반내용 로드: ${encCsNo.substring(0, 30)}...`);

    // 사건번호 파싱 (예: "2025드단5823" → csYear, csDvsNm, csSerial)
    const match = caseNumber.match(/(\d{4})([가-힣]+)(\d+)/);
    if (!match) {
      return { success: false, error: '사건번호 파싱 실패' };
    }
    const [, csYear, csDvsNm, csSerial] = match;

    // 사건 유형 코드 변환
    const caseTypeCodes: Record<string, string> = {
      '드단': '150', '드합': '151', '느단': '140', '느합': '141', '르': '160',
      '므': '170', '브단': '180', '브합': '181',
    };
    const csDvsCd = caseTypeCodes[csDvsNm] || csDvsNm;

    // API와 동일한 방식: dma_search DataMap 설정 후 sbm_search submission 실행
    const loadResult = await page.evaluate((params: {
      encCsNo: string;
      caseNumber: string;
      csYear: string;
      csDvsCd: string;
      csSerial: string;
      courtName: string;
      partyName: string;
    }) => {
      const w = (window as any).$w;
      if (!w) {
        return { success: false, error: 'WebSquare5 API 없음' };
      }

      try {
        // 1. dma_search DataMap에 API와 동일한 값 설정
        const searchDataMapId = 'mf_ssgoTopMainTab_contents_content1_body_dma_search';
        const searchDataMap = w.getComponentById(searchDataMapId);

        if (!searchDataMap) {
          return { success: false, error: 'dma_search DataMap 없음' };
        }

        // API와 동일한 필드 설정
        searchDataMap.set('cortCd', params.courtName);  // 법원명
        searchDataMap.set('csNo', '');
        searchDataMap.set('encCsNo', params.encCsNo);
        searchDataMap.set('csYear', params.csYear);
        searchDataMap.set('csDvsCd', params.csDvsCd);
        searchDataMap.set('csSerial', params.csSerial.padStart(7, '0'));
        searchDataMap.set('btprtNm', params.partyName);  // 당사자명
        searchDataMap.set('captchaAnswer', '');

        console.log('dma_search 설정 완료:', {
          cortCd: params.courtName,
          encCsNo: params.encCsNo.substring(0, 20) + '...',
          csYear: params.csYear,
          csDvsCd: params.csDvsCd,
          csSerial: params.csSerial.padStart(7, '0'),
          btprtNm: params.partyName,
        });

        // 2. sbm_search submission 실행
        const submissionId = 'mf_ssgoTopMainTab_contents_content1_body_sbm_search';

        // executeSubmission 호출
        if (typeof w.executeSubmission === 'function') {
          console.log('executeSubmission 호출:', submissionId);
          w.executeSubmission(submissionId);
          return { success: true, method: 'executeSubmission' };
        }

        // 대안: submission 컴포넌트 직접 실행
        const submission = w.getComponentById(submissionId);
        if (submission && typeof submission.execute === 'function') {
          console.log('submission.execute 호출');
          submission.execute();
          return { success: true, method: 'submission.execute' };
        }

        return { success: false, error: 'submission 실행 방법 없음' };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }, {
      encCsNo,
      caseNumber,
      csYear,
      csDvsCd,
      csSerial,
      courtName: courtName || '',
      partyName: partyName || '',
    });

    console.log(`📋 로드 결과: ${JSON.stringify(loadResult)}`);

    if (!loadResult.success) {
      console.log(`⚠️ 1차 시도 실패: ${loadResult.error}`);

      // 대체 방식: fetch로 직접 API 호출 후 결과를 화면에 반영
      console.log('🔄 대체 방식: 직접 API 호출 시도...');

      const apiResult = await page.evaluate(async (params: {
        encCsNo: string;
        csYear: string;
        csDvsCd: string;
        csSerial: string;
      }) => {
        try {
          const response = await fetch('/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              dma_search: {
                encCsNo: params.encCsNo,
                csYear: params.csYear,
                csDvsCd: params.csDvsCd,
                csSerial: params.csSerial.padStart(7, '0'),
              }
            }),
          });

          const data = await response.json();

          // 응답을 화면에 반영
          const w = (window as any).$w;
          if (w) {
            // 일반내용 패널 열기 시도
            const detailPanel = w.getComponentById('mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail');
            if (detailPanel && typeof detailPanel.show === 'function') {
              detailPanel.show();
            }
          }

          return { success: true, hasData: !!data?.data };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      }, { encCsNo, csYear, csDvsCd, csSerial });

      console.log(`📋 API 호출 결과: ${JSON.stringify(apiResult)}`);
    }

    // 일반내용 탭 로딩 대기
    await new Promise(r => setTimeout(r, 3000));

    console.log(`✅ SCOURT 사건 일반내용 탭 열림: ${caseNumber}`);

    return { success: true };

  } catch (error) {
    console.error('사건 열기 에러:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * 브라우저 종료
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
