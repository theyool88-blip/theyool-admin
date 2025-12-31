/**
 * 캡챠 인식 모듈
 *
 * 전략:
 * - RGBA 이미지 (학습 데이터): CNN 모델 사용 (98.47% 정확도)
 * - RGB 이미지 (실제 브라우저 캡챠): Vision API 사용 (더 정확)
 *
 * CNN 모델 정보:
 * - 프레임워크: PyTorch
 * - 아키텍처: CBAM + Multi-Head CNN (Position-Aware Pooling)
 * - 정확도: 98.47% (6자리 전체 일치, RGBA 학습 데이터 기준)
 * - 입력: 160x50 grayscale (RGBA Alpha 채널에서 추출)
 *
 * 주의: CNN 모델은 RGBA Alpha 채널 이미지에 최적화됨.
 *       실제 브라우저 캡챠(RGB)에는 Vision API가 더 정확함.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

const MODEL_PATH = path.join(process.cwd(), 'data', 'captcha-model', 'cbam_multihead_v2_final.pth');
const MODEL_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'cbam_multihead_v2.py');

/**
 * 이미지가 RGBA인지 확인 (CNN 모델에 적합한지)
 */
function isRGBAImage(imageBuffer: Buffer): boolean {
  // PNG 시그니처와 IHDR 청크에서 색상 타입 확인
  // PNG 시그니처: 89 50 4E 47 0D 0A 1A 0A
  // IHDR 청크: 13바이트 후 색상 타입 (6 = RGBA)
  if (imageBuffer.length > 26 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
    // IHDR 청크의 색상 타입 (offset 25)
    const colorType = imageBuffer[25];
    return colorType === 6; // 6 = RGBA
  }
  return false;
}

/**
 * 학습된 PyTorch 모델로 캡챠 인식 (RGBA 이미지에만 사용 권장)
 * RGB 이미지는 Vision API를 사용하는 것이 더 정확함
 */
export async function solveCaptchaWithModel(imageBuffer: Buffer): Promise<string | null> {
  // 임시 파일로 저장
  const tempPath = path.join('/tmp', `captcha_${Date.now()}.png`);
  fs.writeFileSync(tempPath, imageBuffer);

  try {
    const result = await runPythonPredict(tempPath);
    return result;
  } finally {
    // 임시 파일 삭제
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * PyTorch 모델로 캡챠 예측 실행
 *
 * 전처리 파이프라인:
 * 1. RGBA Alpha 채널 추출 (캡챠 텍스트가 Alpha에 저장됨)
 * 2. 색상 반전 (255 - img)
 * 3. 160x50 리사이즈
 * 4. [0, 1] 정규화
 */
function runPythonPredict(imagePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const pythonCode = `
import sys
import os
import warnings
warnings.filterwarnings('ignore')

# 경로 설정
sys.path.insert(0, '${path.join(process.cwd(), 'scripts')}')

import torch
import numpy as np
from PIL import Image
import cv2

# 모델 정의 임포트
from cbam_multihead_v2 import CBAM_MultiHead_V2

MODEL_PATH = '${MODEL_PATH}'
IMG_WIDTH = 160
IMG_HEIGHT = 50

try:
    # 이미지 로드 및 전처리
    pil_img = Image.open('${imagePath}')

    # RGBA 이미지 (학습 데이터): Alpha 채널에 텍스트가 있음 → 반전 필요
    # RGB 이미지 (실제 캡챠): 검정 텍스트 on 흰 배경 → 반전 불필요
    if pil_img.mode == 'RGBA':
        _, _, _, alpha = pil_img.split()
        img = np.array(alpha)
        # Alpha 채널은 흰색 텍스트이므로 반전
        img = 255 - img
    else:
        # RGB/Grayscale 이미지는 이미 검정 텍스트 on 흰 배경
        # 반전하지 않음 (학습 데이터와 동일한 형태)
        img = np.array(pil_img.convert('L'))

    # 리사이즈 (160x50)
    resized = cv2.resize(img, (IMG_WIDTH, IMG_HEIGHT))

    # 4. 정규화 [0, 1]
    normalized = resized.astype(np.float32) / 255.0

    # 텐서 변환 (batch, channel, height, width)
    tensor = torch.FloatTensor(normalized).unsqueeze(0).unsqueeze(0)

    # 모델 로드
    model = CBAM_MultiHead_V2()
    model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu', weights_only=True))
    model.eval()

    # 예측
    with torch.no_grad():
        outputs = model(tensor)
        predictions = [torch.argmax(out, dim=1).item() for out in outputs]

    result = ''.join(map(str, predictions))
    print(result)

except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    print('')
`;

    const python = spawn('python3', ['-c', pythonCode]);
    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      const result = output.trim();

      // 6자리 숫자인지 확인
      if (/^\d{6}$/.test(result)) {
        resolve(result);
      } else {
        console.error('캡챠 인식 실패:', error || result);
        resolve(null);
      }
    });

    python.on('error', (err) => {
      console.error('Python 실행 에러:', err);
      resolve(null);
    });
  });
}

/**
 * 모델 사용 가능 여부 확인
 */
export function isModelAvailable(): boolean {
  return fs.existsSync(MODEL_PATH) && fs.existsSync(MODEL_SCRIPT_PATH);
}

/**
 * 이미지 타입에 따라 적절한 인식 방식 권장
 * - RGBA: CNN 모델 사용 가능 (학습 데이터와 동일)
 * - RGB: Vision API 권장 (실제 브라우저 캡챠)
 */
export function shouldUseVisionAPI(imageBuffer: Buffer): boolean {
  // RGB 이미지(실제 브라우저 캡챠)는 Vision API가 더 정확
  return !isRGBAImage(imageBuffer);
}

/**
 * 캡챠 인식 결과와 신뢰도 반환
 */
export async function solveCaptchaWithConfidence(imageBuffer: Buffer): Promise<{ text: string | null; confidence: number }> {
  const text = await solveCaptchaWithModel(imageBuffer);
  // PyTorch 모델은 98.47% 정확도
  return {
    text,
    confidence: text ? 0.98 : 0
  };
}
