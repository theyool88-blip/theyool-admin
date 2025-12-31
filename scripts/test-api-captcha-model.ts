/**
 * API 캡챠 이미지에 CNN 모델 적용 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import { getScourtApiClient } from '../lib/scourt/api-client';
import { solveCaptchaWithModel, isModelAvailable, shouldUseVisionAPI } from '../lib/scourt/captcha-solver';
import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';

async function main() {
  console.log('=== API 캡챠 이미지 CNN 모델 테스트 ===\n');

  // CNN 모델 확인
  console.log('CNN 모델 사용 가능:', isModelAvailable());

  const client = getScourtApiClient();

  // 세션 초기화
  console.log('\n1. 세션 초기화...');
  await client.initSession();

  // 캡챠 이미지 획득
  console.log('\n2. 캡챠 이미지 획득...');
  const captchaData = await (client as any).getCaptchaImage();

  if (!captchaData) {
    console.log('캡챠 이미지 획득 실패');
    return;
  }

  const imageBuffer = captchaData.image;
  console.log(`   이미지 크기: ${imageBuffer.length} bytes`);

  // 이미지 저장
  fs.writeFileSync('/tmp/api-captcha.png', imageBuffer);
  console.log('   저장: /tmp/api-captcha.png');

  // 이미지 타입 확인
  const useVision = shouldUseVisionAPI(imageBuffer);
  console.log(`   RGBA 여부: ${!useVision} (Vision API 권장: ${useVision})`);

  // PNG 헤더 확인
  console.log(`   PNG 시그니처: ${imageBuffer[0].toString(16)} ${imageBuffer[1].toString(16)}`);
  if (imageBuffer.length > 25) {
    console.log(`   색상 타입 (offset 25): ${imageBuffer[25]}`);
    // 색상 타입: 0=그레이스케일, 2=RGB, 3=팔레트, 4=그레이스케일+알파, 6=RGBA
  }

  // CNN 모델 테스트
  console.log('\n3. CNN 모델 인식...');
  if (isModelAvailable()) {
    const cnnResult = await solveCaptchaWithModel(imageBuffer);
    console.log(`   CNN 모델 결과: "${cnnResult}"`);
  } else {
    console.log('   CNN 모델 사용 불가');
  }

  // Vision API 테스트
  console.log('\n4. Vision API 인식...');
  const solver = getVisionCaptchaSolver();
  const visionResult = await solver.solveCaptcha(imageBuffer);
  console.log(`   Vision API 결과: "${visionResult.text}" (신뢰도: ${(visionResult.confidence * 100).toFixed(1)}%)`);

  // 여러 캡챠 이미지 테스트
  console.log('\n5. 여러 캡챠 이미지로 테스트...');
  for (let i = 1; i <= 5; i++) {
    const captcha = await (client as any).getCaptchaImage();
    if (!captcha) continue;

    fs.writeFileSync(`/tmp/api-captcha-${i}.png`, captcha.image);

    let cnnText = null;
    if (isModelAvailable()) {
      cnnText = await solveCaptchaWithModel(captcha.image);
    }

    const visionRes = await solver.solveCaptcha(captcha.image);

    console.log(`   #${i}: CNN="${cnnText || 'N/A'}", Vision="${visionRes.text}" (${(visionRes.confidence * 100).toFixed(0)}%)`);
  }
}

main().catch(console.error);
