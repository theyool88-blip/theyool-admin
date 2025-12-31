/**
 * 전처리 이미지 디버깅
 */

import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

async function debugPreprocessing() {
  console.log('🔍 이미지 전처리 디버깅\n');

  const samplesDir = path.join(process.cwd(), 'temp', 'captcha-samples');
  const debugDir = path.join(process.cwd(), 'temp', 'captcha-debug');

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const testFile = 'captcha_01.png';
  const imageBuffer = fs.readFileSync(path.join(samplesDir, testFile));

  // 다양한 전처리 시도
  const variants = [
    { name: 'original', fn: async (buf: Buffer) => buf },
    {
      name: 'grayscale',
      fn: async (buf: Buffer) => sharp(buf).grayscale().toBuffer(),
    },
    {
      name: 'normalize',
      fn: async (buf: Buffer) => sharp(buf).grayscale().normalize().toBuffer(),
    },
    {
      name: 'threshold_100',
      fn: async (buf: Buffer) => sharp(buf).grayscale().threshold(100).toBuffer(),
    },
    {
      name: 'threshold_128',
      fn: async (buf: Buffer) => sharp(buf).grayscale().threshold(128).toBuffer(),
    },
    {
      name: 'threshold_150',
      fn: async (buf: Buffer) => sharp(buf).grayscale().threshold(150).toBuffer(),
    },
    {
      name: 'threshold_180',
      fn: async (buf: Buffer) => sharp(buf).grayscale().threshold(180).toBuffer(),
    },
    {
      name: 'negate_threshold',
      fn: async (buf: Buffer) =>
        sharp(buf).grayscale().negate().threshold(128).toBuffer(),
    },
    {
      name: 'sharpen',
      fn: async (buf: Buffer) => sharp(buf).grayscale().sharpen().toBuffer(),
    },
    {
      name: 'linear_contrast',
      fn: async (buf: Buffer) =>
        sharp(buf)
          .grayscale()
          .linear(1.5, -30) // contrast, brightness
          .toBuffer(),
    },
    {
      name: 'high_contrast',
      fn: async (buf: Buffer) =>
        sharp(buf)
          .grayscale()
          .linear(2, -50)
          .toBuffer(),
    },
    {
      name: 'median_blur',
      fn: async (buf: Buffer) => sharp(buf).grayscale().median(3).toBuffer(),
    },
  ];

  for (const variant of variants) {
    try {
      const processed = await variant.fn(imageBuffer);
      const outputPath = path.join(debugDir, `${variant.name}.png`);
      fs.writeFileSync(outputPath, processed);
      console.log(`✅ ${variant.name}`);
    } catch (error) {
      console.log(`❌ ${variant.name}: ${error}`);
    }
  }

  console.log(`\n📁 결과 저장: ${debugDir}`);
}

debugPreprocessing()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
