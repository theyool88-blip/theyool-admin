/**
 * Vision API imageContext 힌트 테스트
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import vision from '@google-cloud/vision';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testVisionHints() {
  console.log('🔍 Vision API 힌트 테스트\n');

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
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Content = imageBuffer.toString('base64');

  console.log('📸 captcha_01.png (정답: 983182)\n');

  // 다양한 힌트 조합 테스트
  const tests = [
    {
      name: 'TEXT_DETECTION 기본',
      request: {
        image: { content: base64Content },
        features: [{ type: 'TEXT_DETECTION' }],
      },
    },
    {
      name: 'DOCUMENT_TEXT_DETECTION',
      request: {
        image: { content: base64Content },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    },
    {
      name: 'TEXT + languageHints en',
      request: {
        image: { content: base64Content },
        features: [{ type: 'TEXT_DETECTION' }],
        imageContext: {
          languageHints: ['en'],
        },
      },
    },
    {
      name: 'DOC + DENSE_OCR',
      request: {
        image: { content: base64Content },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: {
          textDetectionParams: {
            advancedOcrOptions: ['ENABLE_DENSE_OCR'],
          },
        },
      },
    },
    {
      name: 'DOC + SYMBOL_LEVEL',
      request: {
        image: { content: base64Content },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: {
          textDetectionParams: {
            advancedOcrOptions: ['ENABLE_SYMBOL_LEVEL_OCR'],
          },
        },
      },
    },
  ];

  for (const test of tests) {
    try {
      const [result] = await client.annotateImage(test.request as any);
      const fullText = result.textAnnotations?.[0]?.description || result.fullTextAnnotation?.text || '';
      const digits = fullText.replace(/[^0-9]/g, '');

      console.log(`${test.name}: "${digits}" (${digits.length}자리) ${digits === '983182' ? '✅' : '❌'}`);
    } catch (error: any) {
      console.log(`${test.name}: 에러 - ${error.message?.substring(0, 100)}`);
    }
  }
}

testVisionHints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
