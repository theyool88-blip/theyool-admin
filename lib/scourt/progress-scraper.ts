/**
 * SCOURT 진행내용 스크래퍼
 *
 * NOTE: 이 기능은 Cloudflare 서버리스 환경에서 비활성화되어 있습니다.
 * Puppeteer는 네이티브 바이너리가 필요하여 Workers/Pages 환경에서 작동하지 않습니다.
 *
 * 대신 API 기반 조회를 사용하세요: lib/scourt/api-client.ts
 *
 * 로컬 개발 환경에서 사용하려면:
 * 1. npm install puppeteer
 * 2. 이 파일을 원본 버전으로 교체
 */

export interface ProgressItem {
  date: string;
  content: string;
  result: string;
  notice?: string;
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
  basicInfo?: BasicInfo;
  error?: string;
  caseNumber?: string;
}

/**
 * 브라우저 종료 (서버리스 환경에서는 no-op)
 */
export async function closeBrowser(): Promise<void> {
  // No-op in serverless environment
}

/**
 * 저장된 사건에서 진행내용 추출
 * 서버리스 환경에서는 지원되지 않습니다.
 */
export async function scrapeProgress(_caseNumber: string): Promise<ProgressResult> {
  console.warn('⚠️ scrapeProgress는 서버리스 환경에서 비활성화되어 있습니다.');
  return {
    success: false,
    progress: [],
    error: '이 기능은 서버리스 환경에서 지원되지 않습니다. API 기반 조회를 사용하세요.',
  };
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
