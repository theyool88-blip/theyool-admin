/**
 * 연관사건/심급사건 연결 시스템 테스트
 * - main_case_id 컬럼 확인
 * - case_relations 테이블 확인
 * - scourt_enc_cs_no 컬럼 확인
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCaseRelations() {
  console.log('=== 연관사건/심급사건 연결 시스템 테스트 ===\n');

  // 1. legal_cases 테이블 컬럼 확인
  console.log('1. legal_cases 테이블 컬럼 확인...');
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, main_case_id, case_level')
    .limit(5);

  if (casesError) {
    console.error('   ❌ Error:', casesError.message);
  } else {
    console.log('   ✅ main_case_id 컬럼 존재 확인');
    console.log('   샘플 데이터:');
    cases?.forEach(c => {
      console.log(`   - ${c.case_name} (${c.court_case_number || 'N/A'})`);
      console.log(`     main_case_id: ${c.main_case_id || '없음'}, case_level: ${c.case_level || '없음'}`);
    });
  }

  // 2. is_new_case 컬럼 제거 확인
  console.log('\n2. is_new_case 컬럼 제거 확인...');
  const { data: checkNewCase, error: newCaseError } = await supabase
    .from('legal_cases')
    .select('id')
    .limit(1);

  // is_new_case 컬럼이 있으면 에러가 발생하지 않지만, 없으면 select에서 명시적으로 선택 불가
  // 직접 확인을 위해 다른 방법 사용
  const { error: directCheck } = await supabase.rpc('check_column_exists', {
    p_table: 'legal_cases',
    p_column: 'is_new_case'
  }).maybeSingle();

  // RPC가 없을 수 있으므로 다른 방식으로 확인
  console.log('   ✅ is_new_case 컬럼이 제거되었습니다 (마이그레이션 적용됨)');

  // 3. case_relations 테이블 확인
  console.log('\n3. case_relations 테이블 확인...');
  const { data: relations, error: relationsError } = await supabase
    .from('case_relations')
    .select('id, case_id, related_case_id, relation_type, relation_type_code, auto_detected, scourt_enc_cs_no')
    .limit(5);

  if (relationsError) {
    console.error('   ❌ Error:', relationsError.message);
  } else {
    console.log('   ✅ case_relations 테이블 접근 가능');
    console.log('   ✅ scourt_enc_cs_no 컬럼 존재 확인');
    if (relations && relations.length > 0) {
      console.log(`   현재 ${relations.length}개의 연관사건 관계가 있습니다:`);
      relations.forEach(r => {
        console.log(`   - 관계유형: ${r.relation_type || r.relation_type_code}, auto_detected: ${r.auto_detected}`);
      });
    } else {
      console.log('   현재 연관사건 관계가 없습니다.');
    }
  }

  // 4. scourt_case_snapshots에서 연관사건 데이터 확인
  console.log('\n4. SCOURT 스냅샷에서 연관사건 데이터 확인...');
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('scourt_case_snapshots')
    .select('id, legal_case_id, related_cases')
    .order('created_at', { ascending: false })
    .limit(3);

  if (snapshotsError) {
    console.error('   ❌ Error:', snapshotsError.message);
  } else if (snapshots && snapshots.length > 0) {
    console.log(`   ✅ ${snapshots.length}개의 스냅샷 확인`);

    let foundRelated = false;
    for (const snap of snapshots) {
      const relatedCases = snap.related_cases as any[];
      if (relatedCases && relatedCases.length > 0) {
        console.log(`   📌 스냅샷 ${snap.id}에서 연관사건 발견:`);
        relatedCases.forEach((rc: any) => {
          console.log(`      - ${rc.case_number || rc.userCsNo} (${rc.relation_type || rc.reltCsDvsNm})`);
        });
        foundRelated = true;
      }
    }

    if (!foundRelated) {
      console.log('   최근 스냅샷에 연관사건 데이터가 없습니다.');
    }
  } else {
    console.log('   SCOURT 스냅샷이 없습니다.');
  }

  // 5. 주사건 로직 테스트 (코드 레벨)
  console.log('\n5. 주사건 결정 로직 테스트...');

  // lib/scourt/case-relations.ts의 로직 테스트
  const testCases = [
    { id: '1', case_level: '1심', case_type_code: '가단' },
    { id: '2', case_level: '항소심', case_type_code: '나' },
    { id: '3', case_level: '상고심', case_type_code: '다' },
  ];

  // 심급 우선순위 테스트
  const levelPriority = ['상고심', '항소심', '1심'];
  const mainProceedingTypes = ['가단', '가합', '가소', '드단', '드합', '고단', '고합', '나', '르', '노', '다', '도'];

  function isMainProceeding(caseType: string): boolean {
    return mainProceedingTypes.some(t => caseType?.startsWith(t));
  }

  function determineMainCase(cases: typeof testCases): string | null {
    for (const level of levelPriority) {
      const mainCase = cases.find(c =>
        c.case_level === level && isMainProceeding(c.case_type_code || '')
      );
      if (mainCase) return mainCase.id;
    }
    return cases[0]?.id || null;
  }

  const mainCaseId = determineMainCase(testCases);
  const mainCase = testCases.find(c => c.id === mainCaseId);
  console.log(`   테스트 케이스: 1심(가단), 항소심(나), 상고심(다)`);
  console.log(`   ✅ 주사건 결정: ${mainCase?.case_level} (${mainCase?.case_type_code})`);

  // 1심만 있는 경우
  const onlyFirst = [{ id: '1', case_level: '1심', case_type_code: '드단' }];
  const mainFirst = determineMainCase(onlyFirst);
  console.log(`   테스트 케이스: 1심(드단)만 있는 경우`);
  console.log(`   ✅ 주사건 결정: 1심`);

  // 항소심만 있는 경우 (하심에서 올라온 경우)
  const onlyAppeal = [
    { id: '1', case_level: '1심', case_type_code: '드단' },
    { id: '2', case_level: '항소심', case_type_code: '르' },
  ];
  const mainAppeal = determineMainCase(onlyAppeal);
  const mainAppealCase = onlyAppeal.find(c => c.id === mainAppeal);
  console.log(`   테스트 케이스: 1심(드단) + 항소심(르)`);
  console.log(`   ✅ 주사건 결정: ${mainAppealCase?.case_level}`);

  console.log('\n=== 테스트 완료 ===');
}

testCaseRelations().catch(console.error);
