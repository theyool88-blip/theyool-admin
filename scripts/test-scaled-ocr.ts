/**
 * 확대된 이미지로 Vision API OCR 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import sharp from 'sharp';
import vision from '@google-cloud/vision';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testScaledOCR() {
  console.log('🧪 확대 이미지 OCR 테스트\n');

  // Vision API 클라이언트 초기화
  let credentials = null;
  if (process.env.GOOGLE_VISION_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  }

  if (!credentials) {
    console.error('❌ Vision API 자격 증명 환경변수 없음');
    return;
  }

  const client = new vision.ImageAnnotatorClient({
    credentials,
    projectId: credentials.project_id,
  });

  console.log(`✅ Vision API 초기화 완료\n`);

  const samplesDir = path.join(process.cwd(), 'temp', 'captcha-samples');
  const debugDir = path.join(process.cwd(), 'temp', 'captcha-scaled');

  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }

  const files = fs
    .readdirSync(samplesDir)
    .filter((f) => f.match(/^captcha_\d+\.png$/))
    .sort();

  console.log(`📁 테스트 이미지: ${files.length}개\n`);

  let success6 = 0;

  for (const file of files) {
    const filepath = path.join(samplesDir, file);
    const imageBuffer = fs.readFileSync(filepath);

    // 이미지를 3배 확대
    const scaledImage = await sharp(imageBuffer)
      .resize({ width: 354, height: 120, fit: 'fill' }) // 원본의 약 3배
      .sharpen()
      .toBuffer();

    // 확대된 이미지 저장 (디버깅용)
    fs.writeFileSync(path.join(debugDir, file), scaledImage);

    // Vision API 호출
    const [result] = await client.textDetection(scaledImage);
    const detections = result.textAnnotations;

    let digits = '';
    if (detections && detections.length > 0) {
      const fullText = detections[0].description || '';
      digits = fullText.replace(/[^0-9]/g, '');
    }

    const length = digits.length;
    if (length === 6) success6++;

    console.log(
      `${file}: "${digits}" (${length}자리) ${length === 6 ? '✅' : '❌'}`
    );
  }

  console.log(
    `\n📊 결과: ${success6}/${files.length} (${((success6 / files.length) * 100).toFixed(1)}%) 6자리 인식`
  );
  console.log(`📁 확대 이미지 저장: ${debugDir}`);
}

testScaledOCR()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
