/**
 * 나의사건검색에서 모든 사건유형 코드 추출
 *
 * 법원을 선택해야 사건구분 드롭다운이 활성화됨
 * 여러 법원에서 사건구분을 수집하여 중복 제거
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');
const SCOURT_URL = 'https://www.scourt.go.kr/portal/information/events/search/search.jsp';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

// 다양한 법원 유형 샘플 (각 유형별로 다른 사건구분이 있을 수 있음)
const SAMPLE_COURTS = [
  '서울중앙지방법원',  // 대형 지방법원
  '서울가정법원',      // 가정법원
  '서울회생법원',      // 회생법원
  '서울행정법원',      // 행정법원
  '서울고등법원',      // 고등법원
  '대법원',            // 대법원
  '수원지방법원',      // 지방법원
  '수원가정법원',      // 가정법원
  '인천지방법원',      // 지방법원
  '대전지방법원',      // 지방법원
  '부산지방법원',      // 지방법원
  '광주지방법원',      // 지방법원
];

async function main() {
  console.log('📋 모든 사건유형 코드 수집 시작\n');

  // 기존 프로필 사용
  const profiles = fs.readdirSync(PROFILES_DIR).filter(f =>
    f.startsWith('profile_') && fs.statSync(path.join(PROFILES_DIR, f)).isDirectory()
  );

  const userDataDir = profiles.length > 0
    ? path.join(PROFILES_DIR, profiles[0])
    : path.join(PROFILES_DIR, `profile_temp_${Date.now()}`);

  console.log(`프로필: ${path.basename(userDataDir)}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    userDataDir
  });

  const allCaseTypes = new Map<string, { code: string; name: string; courts: string[] }>();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 알림 자동 수락
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // 사이트 접속
    console.log('사이트 접속 중...');
    await page.goto(SCOURT_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await wait(5000);

    // iframe 찾기
    const targetFrame = page.frames().find(f => f.url().includes('ssgo.scourt.go.kr'));
    if (!targetFrame) {
      throw new Error('iframe을 찾을 수 없습니다');
    }
    console.log('✅ iframe 발견\n');

    // 각 법원에서 사건구분 수집
    for (const courtName of SAMPLE_COURTS) {
      console.log(`\n🏛️ ${courtName} 사건구분 확인...`);

      try {
        // 법원 선택
        await targetFrame.select('#mf_ssgoTopMainTab_contents_content1_body_sbx_cortCd', courtName);
        await wait(2000);

        // 사건구분 드롭다운에서 옵션 추출
        const caseTypes = await targetFrame.evaluate(() => {
          const select = document.querySelector('#mf_ssgoTopMainTab_contents_content1_body_sbx_csDvsCd') as HTMLSelectElement;
          if (!select) return [];

          return Array.from(select.options)
            .filter(opt => opt.value && opt.value !== '')
            .map(opt => ({
              code: opt.value,
              name: opt.text.trim()
            }));
        });

        console.log(`   ${caseTypes.length}개 사건유형 발견`);

        // 중복 제거하면서 수집
        for (const ct of caseTypes) {
          if (allCaseTypes.has(ct.code)) {
            allCaseTypes.get(ct.code)!.courts.push(courtName);
          } else {
            allCaseTypes.set(ct.code, {
              code: ct.code,
              name: ct.name,
              courts: [courtName]
            });
          }
        }

      } catch (error) {
        console.log(`   ❌ 실패: ${error}`);
      }
    }

    // 결과 정리
    console.log('\n\n========================================');
    console.log('📊 수집된 사건유형 목록');
    console.log('========================================\n');

    const sortedTypes = Array.from(allCaseTypes.values())
      .sort((a, b) => a.code.localeCompare(b.code, 'ko'));

    // 카테고리별 분류
    const categories: Record<string, typeof sortedTypes> = {
      '민사': [],
      '가사': [],
      '형사': [],
      '행정': [],
      '신청/집행': [],
      '파산/회생': [],
      '기타': []
    };

    for (const ct of sortedTypes) {
      // 사건유형 분류 로직
      if (['가단', '가합', '가소', '가확', '가기', '나', '나단', '나합', '다', '다단', '다합', '라', '마'].some(p => ct.code.startsWith(p))) {
        categories['민사'].push(ct);
      } else if (['드', '느', '르', '브', '므', '스', '즈', '조', '호'].some(p => ct.code.startsWith(p))) {
        categories['가사'].push(ct);
      } else if (['고', '노', '도', '로', '오'].some(p => ct.code.startsWith(p))) {
        categories['형사'].push(ct);
      } else if (['구', '누', '두', '아'].some(p => ct.code.startsWith(p))) {
        categories['행정'].push(ct);
      } else if (['카', '타', '차', '파'].some(p => ct.code.startsWith(p))) {
        categories['신청/집행'].push(ct);
      } else if (['하', '회', '개', '간'].some(p => ct.code.startsWith(p))) {
        categories['파산/회생'].push(ct);
      } else {
        categories['기타'].push(ct);
      }
    }

    // 출력
    for (const [category, types] of Object.entries(categories)) {
      if (types.length === 0) continue;
      console.log(`\n【 ${category} 】 (${types.length}개)`);
      for (const ct of types) {
        console.log(`  ${ct.code.padEnd(6)} ${ct.name}`);
      }
    }

    console.log(`\n\n총 ${sortedTypes.length}개 사건유형 수집됨`);

    // JSON 파일로 저장
    const outputPath = path.join(process.cwd(), 'temp', 'case-types-raw.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(sortedTypes, null, 2));
    console.log(`\n📁 저장됨: ${outputPath}`);

    // TypeScript 파일 생성용 코드 출력
    console.log('\n\n========================================');
    console.log('TypeScript 코드 (복사용)');
    console.log('========================================\n');

    console.log('export const CASE_TYPES = [');
    for (const ct of sortedTypes) {
      console.log(`  { code: '${ct.code}', name: '${ct.name}' },`);
    }
    console.log('];');

  } finally {
    console.log('\n\n5초 후 브라우저 종료...');
    await wait(5000);
    await browser.close();
  }
}

main().catch(console.error);
