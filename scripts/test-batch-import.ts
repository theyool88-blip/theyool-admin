/**
 * 배치 임포트 테스트 스크립트
 * 에러 원인 파악용
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as path from 'path';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       배치 임포트 디버그 테스트');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Excel 파일에서 첫 번째 행 읽기
  const filePath = path.join(process.cwd(), '테스트_배치_281건_담당변호사.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet) as Record<string, string>[];

  console.log(`📄 파일에서 ${data.length}건 로드됨`);
  console.log(`\n📝 첫 번째 행 데이터:`);
  console.log(JSON.stringify(data[0], null, 2));

  // 2. 담당변호사 파싱 테스트
  const firstRow = data[0];
  const assignedLawyer = firstRow['담당변호사'];
  console.log(`\n🎯 담당변호사 값: "${assignedLawyer}"`);

  if (assignedLawyer) {
    const lawyerNames = assignedLawyer.split(/[,،]\s*/).map(n => n.trim()).filter(n => n);
    console.log(`   파싱 결과: ${JSON.stringify(lawyerNames)}`);

    // 3. 각 변호사 검색
    for (const name of lawyerNames) {
      const { data: member, error } = await supabase
        .from('tenant_members')
        .select('id, display_name, role')
        .eq('tenant_id', TENANT_ID)
        .eq('display_name', name)
        .single();

      if (error) {
        console.log(`   ❌ "${name}" 검색 실패: ${error.message}`);
      } else {
        console.log(`   ✅ "${name}" 발견: ${member.id} (${member.role})`);
      }
    }
  }

  // 4. case_assignees 테이블 스키마 확인
  console.log('\n📊 case_assignees 테이블 컬럼 확인:');
  const { data: columns, error: colError } = await supabase.rpc('get_table_columns', {
    table_name: 'case_assignees'
  });

  if (colError) {
    // RPC가 없으면 직접 쿼리
    console.log('   RPC 없음, 샘플 데이터로 확인...');
    const { data: sample, error: sampleError } = await supabase
      .from('case_assignees')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log(`   ❌ 테이블 접근 실패: ${sampleError.message}`);
    } else if (sample && sample.length > 0) {
      console.log(`   컬럼: ${Object.keys(sample[0]).join(', ')}`);
    } else {
      // 테이블은 있지만 데이터가 없는 경우, 빈 insert 시도로 컬럼 확인
      console.log('   테이블에 데이터 없음, 테스트 삽입 시도...');
    }
  } else {
    console.log(`   컬럼: ${columns?.map((c: {column_name: string}) => c.column_name).join(', ')}`);
  }

  // 5. 테스트 삽입 시도 (임시 사건으로)
  console.log('\n🧪 테스트 삽입 시도:');

  // 임시 사건 생성
  const { data: testCase, error: caseError } = await supabase
    .from('legal_cases')
    .insert({
      tenant_id: TENANT_ID,
      case_name: '테스트 사건 (삭제 예정)',
      court_name: '서울중앙지방법원',
      court_case_number: '9999가단999999',
      status: '진행중',
    })
    .select()
    .single();

  if (caseError) {
    console.log(`   ❌ 테스트 사건 생성 실패: ${caseError.message}`);
    return;
  }

  console.log(`   ✅ 테스트 사건 생성: ${testCase.id}`);

  // 멤버 조회
  const { data: members } = await supabase
    .from('tenant_members')
    .select('id, display_name')
    .eq('tenant_id', TENANT_ID)
    .eq('display_name', '김민수 변호사')
    .single();

  if (!members) {
    console.log('   ❌ 멤버를 찾을 수 없음');
    // 정리
    await supabase.from('legal_cases').delete().eq('id', testCase.id);
    return;
  }

  // case_assignees 삽입 시도
  const { error: assigneeError } = await supabase
    .from('case_assignees')
    .insert({
      tenant_id: TENANT_ID,
      case_id: testCase.id,
      member_id: members.id,
      is_primary: true,
      assignee_role: 'lawyer',
    });

  if (assigneeError) {
    console.log(`   ❌ case_assignees 삽입 실패: ${assigneeError.message}`);
    console.log(`      코드: ${assigneeError.code}`);
    console.log(`      상세: ${assigneeError.details}`);
    console.log(`      힌트: ${assigneeError.hint}`);
  } else {
    console.log(`   ✅ case_assignees 삽입 성공!`);
  }

  // 정리
  console.log('\n🧹 테스트 데이터 정리...');
  await supabase.from('case_assignees').delete().eq('case_id', testCase.id);
  await supabase.from('legal_cases').delete().eq('id', testCase.id);
  console.log('   완료');
}

main().catch(console.error);
