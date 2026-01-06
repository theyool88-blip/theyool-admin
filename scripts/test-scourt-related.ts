import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testScourtRelated() {
  console.log('=== SCOURT 연관사건 연결 테스트 ===\n');

  // 1. 연관사건이 있는 스냅샷 찾기
  console.log('1. 연관사건이 있는 스냅샷 검색...');
  const { data: allSnapshots } = await supabase
    .from('scourt_case_snapshots')
    .select('id, legal_case_id, related_cases, case_number, court_code')
    .order('created_at', { ascending: false })
    .limit(20);

  let hasRelatedCases = false;

  if (allSnapshots) {
    for (const snap of allSnapshots) {
      const related = snap.related_cases as any[];
      if (related && related.length > 0) {
        hasRelatedCases = true;
        console.log('\n   📌 스냅샷 발견: ' + snap.case_number);
        console.log('      legal_case_id: ' + snap.legal_case_id);
        console.log('      연관사건 ' + related.length + '건:');
        related.forEach((r: any) => {
          const caseNum = r.case_number || r.userCsNo || 'N/A';
          const relType = r.relation_type || r.reltCsDvsNm || 'N/A';
          console.log('      - ' + caseNum + ' (' + relType + ')');
        });
      }
    }
  }

  if (!hasRelatedCases) {
    console.log('   현재 스냅샷 중 연관사건이 있는 것이 없습니다.');
  }

  // 2. legal_cases에서 연관사건 번호와 매칭되는 사건 확인
  console.log('\n2. 시스템 내 사건 목록 (court_case_number 있는 것만)...');
  const { data: cases } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, case_level, main_case_id')
    .not('court_case_number', 'is', null)
    .limit(10);

  if (cases && cases.length > 0) {
    cases.forEach(c => {
      console.log('   - ' + c.court_case_number + ': ' + c.case_name);
      const level = c.case_level || 'N/A';
      const mainId = c.main_case_id ? c.main_case_id.substring(0, 8) + '...' : 'N/A';
      console.log('     level: ' + level + ', main_case_id: ' + mainId);
    });
  } else {
    console.log('   법원 사건번호가 있는 사건이 없습니다.');
  }

  // 3. case_relations 현황
  console.log('\n3. case_relations 현황...');
  const { data: relations, count } = await supabase
    .from('case_relations')
    .select('*', { count: 'exact' });

  console.log('   총 ' + (count || 0) + '건의 관계가 등록되어 있습니다.');
  if (relations && relations.length > 0) {
    relations.slice(0, 5).forEach(r => {
      console.log('   - ' + r.relation_type + ' (auto: ' + r.auto_detected + ')');
    });
  }

  console.log('\n=== 테스트 완료 ===');
}

testScourtRelated().catch(console.error);
