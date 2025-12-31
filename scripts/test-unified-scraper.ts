/**
 * 통합 스크래퍼 + 변경 감지 테스트
 *
 * npx tsx scripts/test-unified-scraper.ts
 *
 * 테스트 순서:
 * 1. 저장된 사건 목록에서 첫 번째 사건 선택
 * 2. 상세 페이지 스크래핑
 * 3. 스냅샷 저장
 * 4. 변경 감지 로직 테스트
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { CaseChangeDetector, CaseSnapshot, CaseUpdate } from '../lib/scourt/change-detector';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PROFILES_DIR = path.join(process.cwd(), 'data', 'scourt-profiles');
const SCOURT_URL = 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 상세 페이지에서 데이터 추출
async function scrapeDetailPage(page: Page) {
  // 기본 정보 추출
  const basicInfo = await page.evaluate(() => {
    const info: Record<string, string> = {};
    const tables = document.querySelectorAll('.w2group table');
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        const headers = row.querySelectorAll('th');
        const cells = row.querySelectorAll('td');
        headers.forEach((th, idx) => {
          const key = th.textContent?.trim() || '';
          const value = cells[idx]?.textContent?.trim() || '';
          if (key && value) {
            info[key] = value;
          }
        });
      });
    });
    return info;
  });

  // 기일 정보 추출
  const hearings = await page.evaluate(() => {
    const results: Array<{
      date: string;
      time: string;
      type: string;
      location: string;
      result?: string;
    }> = [];
    const section = document.querySelector('.w2group[id*="grdt"]');
    if (!section) return results;

    const rows = section.querySelectorAll('table tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        const date = cells[0]?.textContent?.trim() || '';
        if (date.match(/\d{4}\.\d{2}\.\d{2}/)) {
          results.push({
            date,
            time: cells[1]?.textContent?.trim() || '',
            type: cells[2]?.textContent?.trim() || '',
            location: cells[3]?.textContent?.trim() || '',
            result: cells[4]?.textContent?.trim() || undefined,
          });
        }
      }
    });
    return results;
  });

  // 진행내용 추출
  const progress = await page.evaluate(() => {
    const results: Array<{
      date: string;
      content: string;
      result?: string;
    }> = [];
    const section = document.querySelector('.w2group[id*="prog"]');
    if (!section) return results;

    const rows = section.querySelectorAll('table tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const date = cells[0]?.textContent?.trim() || '';
        if (date.match(/\d{4}\.\d{2}\.\d{2}/)) {
          results.push({
            date,
            content: cells[1]?.textContent?.trim() || '',
            result: cells[2]?.textContent?.trim() || undefined,
          });
        }
      }
    });
    return results;
  });

  return { basicInfo, hearings, progress, documents: [], lowerCourt: [] };
}

async function main() {
  console.log('🧪 통합 스크래퍼 테스트\n');

  let browser: Browser | null = null;

  try {
    // 1. 프로필 조회
    console.log('1️⃣ 프로필 조회...');
    const { data: profile } = await supabase
      .from('scourt_profiles')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!profile) {
      console.log('❌ 활성 프로필이 없습니다. 먼저 사건 검색을 실행하세요.');
      return;
    }

    console.log(`   ✅ 프로필: ${profile.profile_name}`);
    console.log(`   📊 저장된 사건: ${profile.case_count}건\n`);

    // 2. 브라우저 시작
    console.log('2️⃣ 브라우저 시작...');
    const userDataDir = path.join(PROFILES_DIR, profile.profile_name);

    if (!fs.existsSync(userDataDir)) {
      console.log(`❌ 프로필 디렉토리가 없습니다: ${userDataDir}`);
      return;
    }

    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      userDataDir,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    console.log('   ✅ 브라우저 시작됨\n');

    // 3. 대법원 사이트 접속
    console.log('3️⃣ 대법원 사이트 접속...');
    await page.goto(SCOURT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
    console.log('   ✅ 사이트 로드됨\n');

    // 4. 저장된 사건 목록 확인
    console.log('4️⃣ 저장된 사건 목록 확인...');
    const savedCases = await page.evaluate(() => {
      const tbody = document.querySelector(
        '#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody'
      );
      if (!tbody) return [];

      const rows = Array.from(tbody.querySelectorAll('tr'));
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll('td'));
        return {
          court: cells[2]?.textContent?.trim() || '',
          caseNumber: cells[3]?.textContent?.trim() || '',
          caseName: cells[4]?.textContent?.trim() || '',
        };
      });
    });

    if (savedCases.length === 0) {
      console.log('   ❌ 저장된 사건이 없습니다.\n');
      return;
    }

    console.log(`   ✅ 저장된 사건 ${savedCases.length}건:`);
    savedCases.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.caseNumber} - ${c.caseName}`);
    });
    console.log('');

    // 5. 첫 번째 사건 클릭
    const targetCase = savedCases[0];
    console.log(`5️⃣ 상세 조회: ${targetCase.caseNumber}`);

    const clicked = await page.evaluate((targetNum) => {
      const tbody = document.querySelector(
        '#mf_ssgoTopMainTab_contents_content1_body_csSrchRsltGrid_body_tbody'
      );
      if (!tbody) return false;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells[3]?.textContent?.trim() === targetNum) {
          const link = cells[3].querySelector('a');
          if (link) {
            link.click();
            return true;
          }
        }
      }
      return false;
    }, targetCase.caseNumber);

    if (!clicked) {
      console.log('   ❌ 사건 클릭 실패\n');
      return;
    }

    await wait(3000);
    console.log('   ✅ 상세 페이지 로드됨\n');

    // 6. 스크래핑
    console.log('6️⃣ 상세 정보 스크래핑...');
    const scrapedData = await scrapeDetailPage(page);

    console.log(`   기본정보: ${Object.keys(scrapedData.basicInfo).length}개 필드`);
    console.log(`   기일: ${scrapedData.hearings.length}건`);
    console.log(`   진행내용: ${scrapedData.progress.length}건`);
    console.log('');

    // 상세 출력
    console.log('   📋 기본정보:');
    Object.entries(scrapedData.basicInfo).forEach(([k, v]) => {
      console.log(`      ${k}: ${v}`);
    });
    console.log('');

    if (scrapedData.hearings.length > 0) {
      console.log('   📅 기일:');
      scrapedData.hearings.forEach((h, i) => {
        console.log(`      ${i + 1}. ${h.date} ${h.time} - ${h.type} (${h.result || '미정'})`);
      });
      console.log('');
    }

    if (scrapedData.progress.length > 0) {
      console.log('   📄 진행내용 (최근 5건):');
      scrapedData.progress.slice(0, 5).forEach((p, i) => {
        console.log(`      ${i + 1}. ${p.date} - ${p.content}`);
      });
      console.log('');
    }

    // 7. 변경 감지 테스트 (시뮬레이션)
    console.log('7️⃣ 변경 감지 테스트 (시뮬레이션)...');

    const currentSnapshot: CaseSnapshot = scrapedData;

    // 이전 스냅샷이 없는 경우 (첫 동기화)
    const updatesFromNull = CaseChangeDetector.detectChanges(null, currentSnapshot);
    console.log(`   첫 동기화 시 업데이트: ${updatesFromNull.length}건`);
    updatesFromNull.forEach((u) => {
      console.log(`      [${u.importance}] ${u.updateType}: ${u.updateSummary}`);
    });
    console.log('');

    // 시뮬레이션: 기일 하나 추가된 경우
    const previousSnapshot: CaseSnapshot = {
      ...currentSnapshot,
      hearings: currentSnapshot.hearings.slice(1), // 첫 번째 기일 제거
    };

    const updatesWithChange = CaseChangeDetector.detectChanges(previousSnapshot, currentSnapshot);
    console.log(`   기일 추가 시뮬레이션 업데이트: ${updatesWithChange.length}건`);
    updatesWithChange.forEach((u) => {
      console.log(`      [${u.importance}] ${u.updateType}: ${u.updateSummary}`);
    });
    console.log('');

    // 8. 해시 테스트
    console.log('8️⃣ 스냅샷 해시 테스트...');
    const hash1 = CaseChangeDetector.generateHash(currentSnapshot);
    const hash2 = CaseChangeDetector.generateHash(currentSnapshot);
    const hash3 = CaseChangeDetector.generateHash(previousSnapshot);

    console.log(`   현재 스냅샷 해시: ${hash1.substring(0, 16)}...`);
    console.log(`   동일 스냅샷 해시: ${hash2.substring(0, 16)}... (${hash1 === hash2 ? '✅ 일치' : '❌ 불일치'})`);
    console.log(`   다른 스냅샷 해시: ${hash3.substring(0, 16)}... (${hash1 !== hash3 ? '✅ 다름' : '❌ 같음'})`);
    console.log('');

    // 9. 다음 기일 찾기
    console.log('9️⃣ 다음 기일 찾기...');
    const nextHearing = CaseChangeDetector.getNextHearing(scrapedData.hearings);
    if (nextHearing) {
      console.log(`   ✅ 다음 기일: ${nextHearing.date} ${nextHearing.time} - ${nextHearing.type}`);
    } else {
      console.log('   ❌ 예정된 기일 없음');
    }
    console.log('');

    console.log('✅ 테스트 완료!\n');
    console.log('⏳ 30초 후 브라우저 종료...');
    await wait(30000);

  } catch (error) {
    console.error('❌ 에러:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('브라우저 종료됨');
    }
  }
}

main();
