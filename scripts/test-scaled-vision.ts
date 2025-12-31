/**
 * 확대된 이미지로 Vision API 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import vision from '@google-cloud/vision';
import sharp from 'sharp';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testScaledVision() {
  console.log('🔍 확대 이미지 Vision API 테스트\n');

  let credentials = null;
  if (process.env.GOOGLE_VISION_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
  }

  if (!credentials) {
    console.error('❌ GOOGLE_VISION_CREDENTIALS 없음');
    return;
  }

  const client = new vision.ImageAnnotatorClient({
    credentials,
    projectId: credentials.project_id,
  });

  const imagePath = path.join(process.cwd(), 'temp', 'captcha-samples', 'captcha_01.png');
  const originalBuffer = fs.readFileSync(imagePath);

  console.log('📸 원본: captcha_01.png (정답: 983182)\n');

  const scales = [1, 2, 3, 4, 5];

  for (const scale of scales) {
    let testBuffer: Buffer = originalBuffer;

    if (scale > 1) {
      // 원본 크기 확인
      const metadata = await sharp(originalBuffer).metadata();
      const newWidth = (metadata.width || 120) * scale;
      const newHeight = (metadata.height || 40) * scale;

      testBuffer = await sharp(originalBuffer)
        .resize(newWidth, newHeight, { kernel: 'lanczos3' })
        .sharpen()
        .toBuffer();
    }

    const [result] = await client.textDetection(testBuffer);
    const fullText = result.textAnnotations?.[0]?.description || '';
    const digits = fullText.replace(/[^0-9]/g, '');

    console.log(`${scale}x 확대: "${fullText.trim()}" → 숫자만: "${digits}" (${digits.length}자리) ${digits === '983182' ? '✅' : '❌'}`);
  }
}

testScaledVision()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
