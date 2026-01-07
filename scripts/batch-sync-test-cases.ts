/**
 * 테스트 사건 일괄 SCOURT 동기화 스크립트
 *
 * - data/scourt-test-cases.json의 모든 사건을 순차적으로 동기화
 * - 캡챠 인증 → encCsNo 획득 → 일반내용/진행내용 저장
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface TestCase {
  type: string;
  desc: string;
  court: string;
  caseNo: string;
  party: string;
  verified: boolean;
}

async function loadTestCases(): Promise<TestCase[]> {
  const filePath = path.join(process.cwd(), 'data', 'scourt-test-cases.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return data.cases;
}

async function syncCase(
  legalCaseId: string,
  caseNumber: string,
  courtName: string,
  partyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${APP_URL}/api/admin/scourt/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalCaseId,
        caseNumber,
        courtName,
        partyName,
        forceRefresh: true,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || `HTTP ${response.status}` };
    }

    return { success: result.success, error: result.error };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       테스트 사건 일괄 SCOURT 동기화');
  console.log('═══════════════════════════════════════════════════════');

  // 테스트 케이스 로드
  const testCases = await loadTestCases();
  console.log(`\n📋 테스트 사건 ${testCases.length}건 로드됨\n`);

  // 테스트 테넌트 찾기
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .like('slug', 'test-law-firm-%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!tenant) {
    console.error('❌ 테스트 테넌트를 찾을 수 없습니다.');
    console.error('   먼저 scripts/setup-test-environment.ts를 실행하세요.');
    process.exit(1);
  }

  console.log(`🏢 테넌트 ID: ${tenant.id}\n`);

  // DB에서 사건 목록 조회
  const { data: dbCases, error } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, court_name, enc_cs_no')
    .eq('tenant_id', tenant.id);

  if (error || !dbCases) {
    console.error('❌ 사건 조회 실패:', error?.message);
    process.exit(1);
  }

  console.log(`📊 DB 사건 ${dbCases.length}건 조회됨\n`);

  // 사건번호로 매핑
  const caseMap = new Map(
    dbCases.map(c => [c.court_case_number, c])
  );

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const dbCase = caseMap.get(tc.caseNo);

    console.log(`[${i + 1}/${testCases.length}] ${tc.caseNo} (${tc.desc})`);

    if (!dbCase) {
      console.log(`  ⏭️ DB에 사건 없음 - 스킵`);
      skipCount++;
      continue;
    }

    if (dbCase.enc_cs_no) {
      console.log(`  ⏭️ 이미 연동됨 - 스킵`);
      skipCount++;
      continue;
    }

    // SCOURT 동기화 호출
    console.log(`  🔄 동기화 중... (당사자: ${tc.party})`);

    const result = await syncCase(
      dbCase.id,
      tc.caseNo,
      tc.court,
      tc.party
    );

    if (result.success) {
      console.log(`  ✅ 성공`);
      successCount++;
    } else {
      console.log(`  ❌ 실패: ${result.error}`);
      failCount++;
    }

    // API 호출 간격 (3초)
    if (i < testCases.length - 1) {
      console.log(`  ⏳ 3초 대기...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    완료!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ 성공: ${successCount}건`);
  console.log(`❌ 실패: ${failCount}건`);
  console.log(`⏭️ 스킵: ${skipCount}건`);
  console.log(`📊 총계: ${testCases.length}건`);
}

main().catch(console.error);
