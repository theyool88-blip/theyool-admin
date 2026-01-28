/**
 * Cloudflare Workers 빌드용 네이티브 모듈 shim 생성기
 *
 * Next.js 빌드 후, OpenNext esbuild 번들링 전에 실행됩니다.
 * 네이티브 바이너리가 필요한 npm 패키지들을 빈 스텁으로 교체하여
 * esbuild가 정상적으로 번들링할 수 있도록 합니다.
 *
 * 실제 기능은 Cloudflare Workers에서 사용할 수 없으므로,
 * 런타임에 해당 모듈을 호출하면 의미 있는 에러를 발생시킵니다.
 */

const fs = require('fs');
const path = require('path');

const NATIVE_MODULES = [
  'sharp',
  '@google-cloud/vision',
  'puppeteer',
  'tesseract.js',
];

function createShim(moduleName) {
  const modPath = path.join(process.cwd(), 'node_modules', moduleName);

  // 기존 패키지 삭제
  if (fs.existsSync(modPath)) {
    fs.rmSync(modPath, { recursive: true, force: true });
  }

  // 빈 shim 패키지 생성
  fs.mkdirSync(modPath, { recursive: true });

  fs.writeFileSync(
    path.join(modPath, 'package.json'),
    JSON.stringify({
      name: moduleName,
      main: 'index.js',
      version: '0.0.0-cloudflare-shim',
    })
  );

  fs.writeFileSync(
    path.join(modPath, 'index.js'),
    `'use strict';
const handler = {
  get(_, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy(function() {}, handler);
    return function() {
      throw new Error('[Cloudflare Workers] "${moduleName}" is not available in this runtime. ' +
        'This module requires native binaries that cannot run on Cloudflare Workers.');
    };
  },
  apply() {
    throw new Error('[Cloudflare Workers] "${moduleName}" is not available in this runtime.');
  }
};
module.exports = new Proxy(function() {}, handler);
module.exports.default = module.exports;
`
  );

  console.log(`  ✓ Shimmed: ${moduleName}`);
}

console.log('\\n🔧 Creating native module shims for Cloudflare Workers build...\\n');

for (const mod of NATIVE_MODULES) {
  createShim(mod);
}

console.log('\\n✅ All native modules shimmed successfully.\\n');
