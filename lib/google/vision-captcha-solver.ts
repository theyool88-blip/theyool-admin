/**
 * Google Cloud Vision API를 사용한 캡챠 인식 모듈
 *
 * NOTE: 이 기능은 Cloudflare 서버리스 환경에서 비활성화되어 있습니다.
 * @google-cloud/vision 및 sharp 패키지는 네이티브 바이너리가 필요하여
 * Workers/Pages 환경에서 작동하지 않습니다.
 *
 * 로컬 개발 환경에서 사용하려면:
 * 1. npm install @google-cloud/vision sharp
 * 2. 이 파일을 원본 버전으로 교체
 */

export interface CaptchaSolveResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
}

export class VisionCaptchaSolver {
  private isConfigured: boolean = false;

  constructor() {
    console.warn('⚠️ VisionCaptchaSolver는 서버리스 환경에서 비활성화되어 있습니다.');
  }

  async solveCaptcha(_imageBuffer: Buffer | Uint8Array): Promise<CaptchaSolveResult> {
    return {
      text: '',
      confidence: 0,
      success: false,
      error: 'Vision API는 서버리스 환경에서 지원되지 않습니다. API 기반 인증을 사용하세요.'
    };
  }

  async solveCaptchaFromUrl(_imageUrl: string): Promise<CaptchaSolveResult> {
    return {
      text: '',
      confidence: 0,
      success: false,
      error: 'Vision API는 서버리스 환경에서 지원되지 않습니다.'
    };
  }

  async solveCaptchaFromBase64(_base64Image: string): Promise<CaptchaSolveResult> {
    return {
      text: '',
      confidence: 0,
      success: false,
      error: 'Vision API는 서버리스 환경에서 지원되지 않습니다.'
    };
  }

  isReady(): boolean {
    return false;
  }
}

// 싱글톤 인스턴스
let solverInstance: VisionCaptchaSolver | null = null;

/**
 * VisionCaptchaSolver 싱글톤 인스턴스 반환
 */
export function getVisionCaptchaSolver(): VisionCaptchaSolver {
  if (!solverInstance) {
    solverInstance = new VisionCaptchaSolver();
  }
  return solverInstance;
}
