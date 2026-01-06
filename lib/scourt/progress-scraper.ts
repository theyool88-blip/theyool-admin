/**
 * SCOURT 진행내용 스크래퍼
 *
 * 진행내용 API가 WebSquare5 보안으로 직접 호출이 불가능하여,
 * Puppeteer를 사용해 브라우저에서 데이터를 추출합니다.
 */

import puppeteer, { Browser, Page, Frame } from 'puppeteer';
import * as path from 'path';

export interface ProgressItem {
  date: string;      // 날짜 (YYYYMMDD 또는 YYYY.MM.DD)
  content: string;   // 진행 내용
  result: string;    // 결과/도달
  notice: string;    // 고지
}

export interface BasicInfo {
  재판부?: string;
  접수일?: string;
  종국결과?: string;
  확정일?: string;
  인지액?: string;
  상소일?: string;
  판결도달일?: string;
}

export interface ProgressResult {
  success: boolean;
  progress: ProgressItem[];
  basicInfo?: BasicInfo;  // 기본정보 (일반내용 탭)
  error?: string;
  caseNumber?: string;
}

// 싱글톤 브라우저 인스턴스
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
    headless: false,  // 디버그용 - 추후 true로 변경
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });

  return browserInstance;
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

/**
 * 저장된 사건에서 진행내용 추출
 *
 * @param caseNumber 사건번호 (예: "2025드단20513")
 */
export async function scrapeProgress(caseNumber: string): Promise<ProgressResult> {
  let page: Page | null = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 팝업/알림 자동 처리
    page.on('dialog', async dialog => await dialog.accept());

    // SCOURT 페이지로 이동
    await page.goto('https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(r => setTimeout(r, 3000));

    // 저장된 사건 목록에서 해당 사건 찾기
    const savedCases = await page.evaluate(() => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      if (!rows) return [];

      return Array.from(rows).map((row, idx) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          index: idx,
          caseNumber: cells[3]?.textContent?.trim() || '',
        };
      });
    });

    console.log('저장된 사건 목록:', savedCases);

    // 대상 사건 찾기
    const targetCase = savedCases.find(c =>
      c.caseNumber.replace(/\s/g, '') === caseNumber.replace(/\s/g, '')
    );

    if (!targetCase) {
      return {
        success: false,
        progress: [],
        error: `저장된 사건 목록에서 ${caseNumber}를 찾을 수 없습니다. 먼저 사건을 검색해주세요.`,
      };
    }

    // 사건 클릭
    await page.evaluate((idx) => {
      const tbody = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody');
      const rows = tbody?.querySelectorAll('tr');
      if (rows && rows[idx]) {
        (rows[idx] as HTMLElement).click();
      }
    }, targetCase.index);

    await new Promise(r => setTimeout(r, 5000));

    // 1. 먼저 일반내용 탭에서 기본정보 추출 (재판부, 종국결과, 확정일 등)
    console.log('일반내용 탭에서 기본정보 추출 중...');
    const basicInfo = await page.evaluate(() => {
      const result: Record<string, string> = {};

      // WebSquare5 그리드 API로 일반내용 데이터 추출
      const w = (window as any).$w;

      // 방법 1: 입력 필드에서 직접 추출 (일반내용 탭의 각 필드)
      const fieldMappings: Record<string, string> = {
        // 재판부
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_jdgpNm': '재판부',
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_jdgNm': '재판부',
        // 접수일
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_rcptYmd': '접수일',
        // 종국결과
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_endRsltNm': '종국결과',
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_endRslt': '종국결과',
        // 확정일
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_cfrmYmd': '확정일',
        // 인지액
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_injiAek': '인지액',
        // 상소일
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_aplYmd': '상소일',
        // 판결도달일
        'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_ibx_jdgArvYmd': '판결도달일',
      };

      for (const [id, label] of Object.entries(fieldMappings)) {
        const element = document.getElementById(id) as HTMLInputElement;
        if (element && element.value) {
          result[label] = element.value.trim();
        }
      }

      // 방법 2: WebSquare5 API 사용
      if (w && w.getComponentById) {
        const gnrlCttId = 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab1_body_dma_gnrlCtt';
        const gnrlCtt = w.getComponentById(gnrlCttId);
        if (gnrlCtt && gnrlCtt.getValue) {
          const data = gnrlCtt.getValue();
          if (data.jdgpNm) result['재판부'] = data.jdgpNm;
          if (data.rcptYmd) result['접수일'] = data.rcptYmd;
          if (data.endRsltNm) result['종국결과'] = data.endRsltNm;
          if (data.cfrmYmd) result['확정일'] = data.cfrmYmd;
          if (data.injiAek) result['인지액'] = data.injiAek;
          if (data.aplYmd) result['상소일'] = data.aplYmd;
          if (data.jdgArvYmd) result['판결도달일'] = data.jdgArvYmd;
        }
      }

      // 방법 3: DOM에서 label-value 쌍으로 추출
      const labels = document.querySelectorAll('label');
      labels.forEach(label => {
        const labelText = label.textContent?.trim();
        if (labelText && ['재판부', '접수일', '종국결과', '확정일', '인지액', '상소일', '판결도달일'].includes(labelText)) {
          // 연관된 input 찾기
          const forId = label.getAttribute('for');
          if (forId) {
            const input = document.getElementById(forId) as HTMLInputElement;
            if (input && input.value) {
              result[labelText] = input.value.trim();
            }
          }
        }
      });

      return result;
    });

    console.log('기본정보 추출 결과:', basicInfo);

    // 2. 진행내용 탭 클릭
    console.log('진행내용 탭 클릭 시도...');
    const tabClicked = await page.evaluate(() => {
      // 정확한 탭 ID로 클릭 시도
      const tabId = 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_tab_ssgoTab2_tabHTML';
      const tabElement = document.getElementById(tabId);
      if (tabElement) {
        tabElement.click();
        return { clicked: true, method: 'direct-id', text: tabElement.textContent };
      }

      // 대체 방법: "진행내용" 텍스트가 있는 <a> 태그 찾기
      const allLinks = document.querySelectorAll('a');
      for (const link of allLinks) {
        if (link.textContent?.trim() === '진행내용') {
          link.click();
          return { clicked: true, method: 'link-text', text: link.textContent };
        }
      }

      // 모든 탭 텍스트 출력
      const tabs = document.querySelectorAll('[role="tab"], [class*="tab"] a, span');
      return {
        clicked: false,
        allTabs: Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean).slice(0, 10)
      };
    });
    console.log('탭 클릭 결과:', tabClicked);

    await new Promise(r => setTimeout(r, 5000));

    // WebSquare5 그리드 API를 사용하여 진행내용 데이터 추출
    const progressData = await page.evaluate(() => {
      const gridId = 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab2_body_grd_csProgLst';

      // WebSquare5 API 사용
      const w = (window as any).$w;
      if (w && w.getComponentById) {
        const grid = w.getComponentById(gridId);
        if (grid && grid.getAllJSON) {
          const allData = grid.getAllJSON();
          return {
            found: true,
            source: 'websquare5',
            data: allData.map((item: any) => ({
              date: item.progYmd || '',        // YYYYMMDD 형식
              content: item.progCtt || '',     // 진행내용
              result: (item.progRslt || '').trim(),  // 결과
              notice: '',                       // 고지 (API에서 별도 제공 안함)
              deliveryInfo: item.dlvRInf || '',
              recipientRelation: item.msitDlvrrRltnNm || '',
            }))
          };
        }
      }

      // 폴백: DOM에서 직접 추출 (title 속성에 날짜가 있음)
      const tableId = gridId + '_body_table';
      const table = document.getElementById(tableId);

      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        return {
          found: true,
          source: 'dom',
          data: Array.from(rows).map(row => {
            const cells = row.querySelectorAll('td');
            // title 속성에 YYYYMMDD 형식의 날짜가 있음
            const dateCell = cells[0] as HTMLElement;
            const dateFromTitle = dateCell?.getAttribute('title') || '';
            return {
              date: dateFromTitle || cells[0]?.textContent?.trim()?.replace(/\./g, '') || '',
              content: cells[1]?.textContent?.trim() || '',
              result: cells[2]?.textContent?.trim() || '',
              notice: cells[3]?.textContent?.trim() || '',
            };
          }).filter((item: any) => item.content)
        };
      }

      return { found: false, source: 'none', data: [] };
    });

    console.log('진행내용 추출 결과:', { found: progressData.found, source: progressData.source, count: progressData.data?.length });

    // 데이터 추출
    const normalizedProgress = (progressData.data || []).filter((p: any) => p.content);

    return {
      success: true,
      progress: normalizedProgress,
      basicInfo: Object.keys(basicInfo).length > 0 ? basicInfo : undefined,
      caseNumber,
    };

  } catch (error) {
    return {
      success: false,
      progress: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * 진행내용을 DB 저장용 형식으로 변환
 */
export function transformProgressForDb(progress: ProgressItem[]): Array<{
  prcdDt: string;
  prcdNm: string;
  prcdRslt: string;
}> {
  return progress.map(p => ({
    prcdDt: p.date.replace(/\./g, ''),
    prcdNm: p.content,
    prcdRslt: p.result,
  }));
}
