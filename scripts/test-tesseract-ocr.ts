/**
 * Tesseract.js OCR 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import Tesseract from 'tesseract.js';

async function testTesseractOCR() {
  console.log('🧪 Tesseract OCR 테스트\n');

  const samplesDir = path.join(process.cwd(), 'temp', 'captcha-samples');

  const files = fs
    .readdirSync(samplesDir)
    .filter((f) => f.match(/^captcha_\d+\.png$/))
    .sort();

  console.log(`📁 테스트 이미지: ${files.length}개\n`);

  let success6 = 0;

  for (const file of files) {
    const filepath = path.join(samplesDir, file);

    try {
      const {
        data: { text },
      } = await Tesseract.recognize(filepath, 'eng', {
        // 숫자만 인식하도록 설정
        tessedit_char_whitelist: '0123456789',
      } as any);

      const digits = text.replace(/[^0-9]/g, '');
      const length = digits.length;
      if (length === 6) success6++;

      console.log(
        `${file}: "${digits}" (${length}자리) ${length === 6 ? '✅' : '❌'}`
      );
    } catch (error) {
      console.log(`${file}: 에러 - ${error}`);
    }
  }

  console.log(
    `\n📊 결과: ${success6}/${files.length} (${((success6 / files.length) * 100).toFixed(1)}%) 6자리 인식`
  );
}

testTesseractOCR()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
