/**
 * 테스트 사건 전체 리셋 및 SCOURT 동기화
 *
 * 1. 기존 사건 모두 삭제
 * 2. 테스트 사건 DB에 등록
 * 3. SCOURT 동기화 (순차적)
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
  // verified=true인 것만 사용
  return data.cases.filter((c: TestCase) => c.verified);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       테스트 사건 전체 리셋 및 SCOURT 동기화');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. 테스트 테넌트 찾기
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .or('slug.like.test-law-firm-%,slug.eq.theyool')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!tenant) {
    console.error('❌ 테넌트를 찾을 수 없습니다.');
    process.exit(1);
  }
  console.log(`🏢 테넌트: ${tenant.name} (${tenant.id})\n`);

  // 2. 기존 사건 삭제
  console.log('📋 Step 1: 기존 사건 삭제 중...');

  const { data: existingCases } = await supabase
    .from('legal_cases')
    .select('id')
    .eq('tenant_id', tenant.id);

  if (existingCases && existingCases.length > 0) {
    const caseIds = existingCases.map(c => c.id);

    // 관련 데이터 삭제
    await supabase.from('scourt_case_snapshots').delete().in('legal_case_id', caseIds);
    await supabase.from('case_parties').delete().in('case_id', caseIds);
    await supabase.from('case_representatives').delete().in('case_id', caseIds);
    await supabase.from('court_hearings').delete().in('case_id', caseIds);
    await supabase.from('case_relations').delete().in('case_id', caseIds);
    await supabase.from('case_relations').delete().in('related_case_id', caseIds);

    // 사건 삭제
    await supabase.from('legal_cases').delete().in('id', caseIds);
    console.log(`   ✅ ${existingCases.length}개 사건 삭제 완료\n`);
  } else {
    console.log('   ⏭️ 삭제할 사건 없음\n');
  }

  // XML 캐시도 삭제 (새로 받기 위해)
  await supabase.from('scourt_xml_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   ✅ XML 캐시 삭제 완료\n');

  // 3. 테스트 사건 로드
  const testCases = await loadTestCases();
  console.log(`📋 Step 2: ${testCases.length}개 테스트 사건 DB 등록 중...\n`);

  // 사건 유형에 따른 case_type 매핑
  const getCaseType = (caseNo: string): string => {
    if (/드|느|므|머|브|스|으|즈|흐|르|너/.test(caseNo)) return 'family';
    if (/고|노|도|로|모|보|소|오|조|초/.test(caseNo)) return 'criminal';
    if (/개회|하면|하단|파산/.test(caseNo)) return 'insolvency';
    if (/구단|구합|누|두|아/.test(caseNo)) return 'administrative';
    return 'civil';
  };

  // DB에 사건 등록
  const casesToInsert = testCases.map(tc => ({
    tenant_id: tenant.id,
    court_case_number: tc.caseNo,
    case_name: `${tc.party}v상대방`,
    case_type: getCaseType(tc.caseNo),
    court_name: tc.court,
    status: '진행중',  // valid values: '진행중', '종결'
  }));

  const { data: insertedCases, error: insertError } = await supabase
    .from('legal_cases')
    .insert(casesToInsert)
    .select('id, court_case_number');

  if (insertError) {
    console.error('❌ 사건 등록 실패:', insertError.message);
    process.exit(1);
  }

  console.log(`   ✅ ${insertedCases?.length}개 사건 등록 완료\n`);

  // 사건번호 → ID 매핑
  const caseIdMap = new Map(
    (insertedCases || []).map(c => [c.court_case_number, c.id])
  );

  // 4. SCOURT 동기화
  console.log('📋 Step 3: SCOURT 동기화 시작...\n');
  console.log('   ⚠️ 각 사건당 약 5-10초 소요 (캡챠 인증 포함)\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const legalCaseId = caseIdMap.get(tc.caseNo);

    if (!legalCaseId) {
      console.log(`[${i + 1}/${testCases.length}] ${tc.caseNo} - ⏭️ ID 없음`);
      continue;
    }

    console.log(`[${i + 1}/${testCases.length}] ${tc.caseNo} (${tc.desc})`);
    console.log(`   🔄 동기화 중... (${tc.court}, ${tc.party})`);

    try {
      const response = await fetch(`${APP_URL}/api/admin/scourt/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalCaseId,
          caseNumber: tc.caseNo,
          courtName: tc.court,
          partyName: tc.party,
          forceRefresh: true,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`   ✅ 성공 (${result.caseName || '-'})`);
        successCount++;
      } else {
        console.log(`   ❌ 실패: ${result.error || 'Unknown error'}`);
        failCount++;
      }
    } catch (error) {
      console.log(`   ❌ 에러: ${error}`);
      failCount++;
    }

    // 다음 요청 전 대기 (3초)
    if (i < testCases.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // 5. 결과 출력
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                      완료!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ 성공: ${successCount}건`);
  console.log(`❌ 실패: ${failCount}건`);
  console.log(`📊 총계: ${testCases.length}건`);

  // XML 캐시 현황
  const { data: xmlCache } = await supabase
    .from('scourt_xml_cache')
    .select('xml_path');
  console.log(`\n📁 XML 캐시: ${xmlCache?.length || 0}개`);
}

main().catch(console.error);
