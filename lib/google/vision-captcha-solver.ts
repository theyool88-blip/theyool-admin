/**
 * Google Cloud Vision API를 사용한 캡챠 인식 모듈
 *
 * 환경변수 설정 필요:
 * - GOOGLE_VISION_CREDENTIALS: Google Cloud 서비스 계정 키 (JSON)
 * 또는
 * - GOOGLE_APPLICATION_CREDENTIALS: 서비스 계정 키 파일 경로
 */

import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import sharp from 'sharp';

export interface CaptchaSolveResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
}

export class VisionCaptchaSolver {
  private client: ImageAnnotatorClient;
  private isConfigured: boolean = false;

  constructor() {
    try {
      let credentials: { project_id: string; [key: string]: unknown } | null = null;

      // 방법 1: GOOGLE_VISION_CREDENTIALS 환경변수
      if (process.env.GOOGLE_VISION_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
      }
      // 방법 2: GOOGLE_SERVICE_ACCOUNT_KEY 환경변수 (기존 프로젝트 호환)
      else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      }

      // 명시적으로 credentials를 사용하여 클라이언트 생성
      if (credentials) {
        this.client = new ImageAnnotatorClient({
          credentials,
          // 다른 환경변수 무시
          projectId: credentials.project_id
        });
        this.isConfigured = true;
        console.log(`✅ Vision API 초기화 완료 (프로젝트: ${credentials.project_id})`);
      }
      // 방법 3: 파일 경로 사용
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.client = new ImageAnnotatorClient();
        this.isConfigured = true;
      }
      // 방법 4: 기본 인증 (로컬 개발시 gcloud CLI)
      else {
        console.warn('⚠️  Google Vision API 인증 정보를 찾을 수 없습니다.');
        this.client = new ImageAnnotatorClient();
        this.isConfigured = false;
      }
    } catch (error) {
      console.error('Google Vision API 초기화 실패:', error);
      this.isConfigured = false;
      this.client = new ImageAnnotatorClient();
    }
  }

  /**
   * 이미지 전처리 - 취소선 제거 및 대비 향상
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // 1. 그레이스케일 변환 + 대비 향상 + 이진화
      const processed = await sharp(imageBuffer)
        .grayscale()
        .normalize() // 대비 향상
        .threshold(128) // 이진화 (검은색/흰색)
        .negate() // 흑백 반전 (검은 배경 → 흰 배경)
        .negate() // 다시 원래대로
        .toBuffer();

      return processed;
    } catch (error) {
      console.warn('이미지 전처리 실패, 원본 사용:', error);
      return imageBuffer;
    }
  }

  /**
   * 캡챠 이미지에서 텍스트 추출
   *
   * @param imageBuffer 캡챠 이미지 Buffer 또는 Uint8Array
   * @returns 인식된 텍스트와 신뢰도
   */
  async solveCaptcha(imageBuffer: Buffer | Uint8Array): Promise<CaptchaSolveResult> {
    if (!this.isConfigured) {
      return {
        text: '',
        confidence: 0,
        success: false,
        error: 'Google Vision API가 구성되지 않았습니다. 환경변수를 확인하세요.'
      };
    }

    try {
      // Uint8Array를 Buffer로 변환
      const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);

      // 단순 textDetection 사용
      const [result] = await this.client.textDetection(buffer);
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return {
          text: '',
          confidence: 0,
          success: false,
          error: '이미지에서 텍스트를 찾을 수 없습니다.'
        };
      }

      // 첫 번째 결과가 전체 인식된 텍스트
      const fullText = detections[0].description || '';

      // 숫자만 추출
      const digitsOnly = fullText.replace(/[^0-9]/g, '');

      // 대법원 캡챠는 6자리 숫자
      const cleanedText = digitsOnly.length >= 6
        ? digitsOnly.substring(0, 6)
        : digitsOnly;

      // 신뢰도 (6자리면 높음)
      const confidence = cleanedText.length === 6 ? 0.9 : 0.5;

      return {
        text: cleanedText,
        confidence,
        success: true
      };
    } catch (error) {
      console.error('캡챠 인식 중 에러:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 에러'
      };
    }
  }

  /**
   * 신뢰도 추정
   * Vision API는 confidence를 직접 제공하지 않으므로,
   * 인식된 텍스트의 특성으로 추정
   */
  private estimateConfidence(
    detections: protos.google.cloud.vision.v1.IEntityAnnotation[],
    cleanedText?: string
  ): number {
    if (!detections || detections.length === 0) return 0;

    // 기본 신뢰도: 80%
    let confidence = 0.8;

    // 인식된 텍스트가 명확한 경우 신뢰도 증가
    if (detections.length > 1) {
      // 여러 단어/문자가 명확히 구분되면 신뢰도 증가
      confidence += 0.1;
    }

    // 6자리 숫자인 경우 신뢰도 증가
    if (cleanedText && cleanedText.length === 6) {
      confidence += 0.1;
    } else if (cleanedText && cleanedText.length < 6) {
      // 6자리 미만이면 신뢰도 감소
      confidence -= 0.3;
    }

    // 0-1 범위로 제한
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 이미지 URL에서 캡챠 인식
   *
   * @param imageUrl 캡챠 이미지 URL
   * @returns 인식된 텍스트와 신뢰도
   */
  async solveCaptchaFromUrl(imageUrl: string): Promise<CaptchaSolveResult> {
    try {
      // URL에서 이미지 다운로드
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return await this.solveCaptcha(buffer);
    } catch (error) {
      console.error('URL에서 이미지 다운로드 실패:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : '이미지 다운로드 실패'
      };
    }
  }

  /**
   * Base64 인코딩된 이미지에서 캡챠 인식
   *
   * @param base64Image Base64 인코딩된 이미지 문자열
   * @returns 인식된 텍스트와 신뢰도
   */
  async solveCaptchaFromBase64(base64Image: string): Promise<CaptchaSolveResult> {
    try {
      // data:image/png;base64, 접두사 제거
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      return await this.solveCaptcha(buffer);
    } catch (error) {
      console.error('Base64 디코딩 실패:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Base64 디코딩 실패'
      };
    }
  }

  /**
   * API 구성 상태 확인
   */
  isReady(): boolean {
    return this.isConfigured;
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
