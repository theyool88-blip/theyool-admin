/**
 * Vision API 상세 응답 디버깅
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import vision from '@google-cloud/vision';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function debugVisionResponse() {
  console.log('🔍 Vision API 상세 응답 확인\n');

  // Vision API 클라이언트 초기화
  let credentials = null;
  if (process.env.GOOGLE_VISION_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_VISION_CREDENTIALS);
  }

  if (!credentials) {
    console.error('❌ GOOGLE_VISION_CREDENTIALS 환경변수 없음');
    return;
  }

  const client = new vision.ImageAnnotatorClient({
    credentials,
    projectId: credentials.project_id,
  });

  console.log(`✅ Vision API 초기화 완료 (프로젝트: ${credentials.project_id})\n`);

  // 캡챠 이미지 로드
  const imagePath = path.join(process.cwd(), 'temp', 'captcha-samples', 'captcha_01.png');
  const imageBuffer = fs.readFileSync(imagePath);

  console.log('📸 이미지: captcha_01.png (실제값: 983182)\n');

  // textDetection
  console.log('=== textDetection 결과 ===');
  const [textResult] = await client.textDetection(imageBuffer);
  console.log('textAnnotations:');
  textResult.textAnnotations?.forEach((anno, i) => {
    console.log(`  [${i}] "${anno.description}" - bounds: ${JSON.stringify(anno.boundingPoly?.vertices?.map(v => ({x: v.x, y: v.y})))}`);
  });

  // documentTextDetection
  console.log('\n=== documentTextDetection 결과 ===');
  const [docResult] = await client.documentTextDetection(imageBuffer);

  console.log('fullTextAnnotation.text:', docResult.fullTextAnnotation?.text);

  if (docResult.fullTextAnnotation?.pages) {
    for (const page of docResult.fullTextAnnotation.pages) {
      for (const block of page.blocks || []) {
        console.log(`\nBlock (confidence: ${block.confidence}):`);
        for (const para of block.paragraphs || []) {
          for (const word of para.words || []) {
            const wordText = word.symbols?.map(s => s.text).join('') || '';
            const wordConf = word.confidence;
            console.log(`  Word: "${wordText}" (confidence: ${wordConf})`);
            for (const symbol of word.symbols || []) {
              console.log(`    Symbol: "${symbol.text}" (conf: ${symbol.confidence}) bounds: ${JSON.stringify(symbol.boundingBox?.vertices?.map(v => ({x: v.x, y: v.y})))}`);
            }
          }
        }
      }
    }
  }
}

debugVisionResponse()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 에러:', error);
    process.exit(1);
  });
