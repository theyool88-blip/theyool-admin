/**
 * SCOURT 사건 페이지(일반내용 탭) 열기
 *
 * NOTE: 이 기능은 Cloudflare 서버리스 환경에서 비활성화되어 있습니다.
 * Puppeteer는 네이티브 바이너리가 필요하여 Workers/Pages 환경에서 작동하지 않습니다.
 *
 * 로컬 개발 환경에서 사용하려면:
 * 1. npm install puppeteer
 * 2. 이 파일을 원본 버전으로 교체
 */

export interface OpenCaseResult {
  success: boolean;
  error?: string;
}

export interface OpenCaseParams {
  caseNumber: string;
  wmonid?: string;
  encCsNo?: string;
  courtName?: string;
  partyName?: string;
}

/**
 * SCOURT에서 사건 페이지(일반내용 탭) 열기
 * 서버리스 환경에서는 지원되지 않습니다.
 */
export async function openCaseInBrowser(_params: OpenCaseParams): Promise<OpenCaseResult> {
  console.warn('⚠️ openCaseInBrowser는 서버리스 환경에서 비활성화되어 있습니다.');
  return {
    success: false,
    error: '이 기능은 서버리스 환경에서 지원되지 않습니다. 브라우저 자동화가 필요한 기능입니다.',
  };
}

/**
 * 브라우저 종료 (서버리스 환경에서는 no-op)
 */
export async function closeBrowser(): Promise<void> {
  // No-op in serverless environment
}
