/**
 * Vision API 빠른 테스트
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getVisionCaptchaSolver } from '../lib/google/vision-captcha-solver';
import * as fs from 'fs';

async function quickTest() {
  console.log('🔍 Vision API 빠른 테스트\n');

  const solver = getVisionCaptchaSolver();

  // 환경변수 확인
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.log('✅ GOOGLE_SERVICE_ACCOUNT_KEY 발견');
  } else if (process.env.GOOGLE_VISION_CREDENTIALS) {
    console.log('✅ GOOGLE_VISION_CREDENTIALS 발견');
  } else {
    console.log('❌ 인증 정보 없음');
    return;
  }

  // 이전에 캡처한 캡챠 이미지 테스트
  const testImagePath = path.join(process.cwd(), 'temp/scourt-test/01-initial-page.png');

  if (!fs.existsSync(testImagePath)) {
    console.log('⚠️  테스트 이미지 없음. 먼저 대법원 사이트를 방문해주세요.');
    return;
  }

  console.log(`\n📸 테스트 이미지: ${testImagePath}`);

  const imageBuffer = fs.readFileSync(testImagePath);

  console.log('\n🔄 Vision API 호출 중...');
  const result = await solver.solveCaptcha(imageBuffer);

  console.log('\n📊 결과:');
  console.log(`  성공: ${result.success}`);
  console.log(`  인식된 텍스트: "${result.text}"`);
  console.log(`  신뢰도: ${(result.confidence * 100).toFixed(1)}%`);

  if (result.error) {
    console.log(`  에러: ${result.error}`);
  }
}

quickTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('에러:', error);
    process.exit(1);
  });
