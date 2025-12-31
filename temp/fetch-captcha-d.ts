import { ScourtApiClient } from '../lib/scourt/api-client';
import * as fs from 'fs';
import * as path from 'path';

async function fetchCaptchaBatch() {
  const client = new ScourtApiClient();
  const outputDir = 'temp/captcha-batch-d';
  
  // Initialize session first
  console.log('Initializing session...');
  const sessionOk = await client.initSession();
  if (!sessionOk) {
    console.error('Failed to initialize session');
    return;
  }
  
  // Clear existing files
  const existingFiles = fs.readdirSync(outputDir);
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(outputDir, file));
  }
  
  console.log('Fetching 10 captcha images...');
  
  for (let i = 1; i <= 10; i++) {
    try {
      const result = await client.getCaptchaImage();
      if (result && result.image) {
        const filePath = path.join(outputDir, `captcha_${i}.png`);
        fs.writeFileSync(filePath, result.image);
        console.log(`Saved captcha_${i}.png`);
      } else {
        console.error(`No image data for captcha ${i}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`Error fetching captcha ${i}:`, error);
    }
  }
  
  console.log('Done fetching batch');
}

fetchCaptchaBatch();
