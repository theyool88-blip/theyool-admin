/**
 * 취소선 제거 후 Vision API 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import vision from '@google-cloud/vision';
import sharp from 'sharp';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testLineRemoval() {
  console.log('🔍 취소선 제거 테스트\n');

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
  const debugDir = path.join(process.cwd(), 'temp', 'captcha-debug');

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  console.log('📸 원본: captcha_01.png (정답: 983182)\n');

  const tests = [
    {
      name: '원본',
      fn: async (buf: Buffer) => buf,
    },
    {
      name: '이진화 (threshold 100)',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().threshold(100).toBuffer(),
    },
    {
      name: '이진화 (threshold 200)',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().threshold(200).toBuffer(),
    },
    {
      name: '반전 후 이진화',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().negate().threshold(150).negate().toBuffer(),
    },
    {
      name: '고대비',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().linear(3, -100).toBuffer(),
    },
    {
      name: 'median 필터',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().median(3).threshold(128).toBuffer(),
    },
    {
      name: 'blur + threshold',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().blur(0.5).threshold(150).toBuffer(),
    },
    {
      name: '5x 확대 + sharpen + threshold',
      fn: async (buf: Buffer) => {
        const meta = await sharp(buf).metadata();
        return sharp(buf)
          .resize((meta.width || 120) * 5, (meta.height || 40) * 5, { kernel: 'lanczos3' })
          .grayscale()
          .sharpen({ sigma: 2 })
          .threshold(128)
          .toBuffer();
      },
    },
  ];

  for (const test of tests) {
    try {
      const processed = await test.fn(originalBuffer);

      // 저장
      const filename = test.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png';
      fs.writeFileSync(path.join(debugDir, filename), processed);

      // Vision API
      const [result] = await client.textDetection(processed);
      const fullText = result.textAnnotations?.[0]?.description || '';
      const digits = fullText.replace(/[^0-9]/g, '');

      console.log(
        `${test.name}: "${digits}" (${digits.length}자리) ${digits === '983182' ? '✅' : '❌'}`
      );
    } catch (error) {
      console.log(`${test.name}: 에러 - ${error}`);
    }
  }

  console.log(`\n📁 처리된 이미지: ${debugDir}`);
}

testLineRemoval()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
