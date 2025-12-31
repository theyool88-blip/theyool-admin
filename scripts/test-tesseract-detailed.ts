/**
 * Tesseract 상세 설정 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import Tesseract from 'tesseract.js';

async function testTesseractDetailed() {
  console.log('🔍 Tesseract 상세 설정 테스트\n');

  const imagePath = path.join(process.cwd(), 'temp', 'captcha-samples', 'captcha_01.png');

  console.log('📸 captcha_01.png (정답: 983182)\n');

  // PSM modes:
  // 6 = 균일한 텍스트 블록 (기본)
  // 7 = 한 줄 텍스트
  // 8 = 한 단어
  // 10 = 한 문자
  // 11 = sparse text
  // 13 = raw line

  const psmModes = [6, 7, 8, 11, 13];

  for (const psm of psmModes) {
    try {
      const { data } = await Tesseract.recognize(imagePath, 'eng', {
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: psm,
      } as any);

      const digits = data.text.replace(/[^0-9]/g, '');
      console.log(`PSM ${psm}: "${digits}" (${digits.length}자리) ${digits === '983182' ? '✅' : '❌'}`);
    } catch (error: any) {
      console.log(`PSM ${psm}: 에러 - ${error.message}`);
    }
  }

  // OEM (OCR Engine Mode) 테스트
  console.log('\n--- OEM 테스트 ---');
  const oems = [0, 1, 2, 3]; // 0=Legacy, 1=LSTM, 2=Legacy+LSTM, 3=Default

  for (const oem of oems) {
    try {
      const { data } = await Tesseract.recognize(imagePath, 'eng', {
        tessedit_char_whitelist: '0123456789',
        tessedit_ocr_engine_mode: oem,
      } as any);

      const digits = data.text.replace(/[^0-9]/g, '');
      console.log(`OEM ${oem}: "${digits}" (${digits.length}자리) ${digits === '983182' ? '✅' : '❌'}`);
    } catch (error: any) {
      console.log(`OEM ${oem}: 에러 - ${error.message}`);
    }
  }
}

testTesseractDetailed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
