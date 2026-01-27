/**
 * batch-case-creator 직접 테스트
 */

import { config } from 'dotenv';
import * as XLSX from 'xlsx';
import * as path from 'path';

config({ path: '.env.local' });

// batch-case-creator 직접 임포트 대신 로직을 여기서 실행
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       batch-case-creator 직접 테스트');
  console.log('═══════════════════════════════════════════════════════\n');

  // Excel에서 첫 번째 행만 읽기
  const filePath = path.join(process.cwd(), '테스트_배치_281건_담당변호사.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

  const row = data[0];
  console.log('📝 테스트 데이터:');
  console.log(`   사건번호: ${row['사건번호']}`);
  console.log(`   담당변호사: ${row['담당변호사']}`);
  console.log(`   의뢰인: ${row['의뢰인명']}`);

  // 1. 담당변호사 조회
  const lawyerName = row['담당변호사'] as string;
  console.log(`\n🔍 담당변호사 "${lawyerName}" 조회...`);

  const { data: member, error: memberError } = await supabase
    .from('tenant_members')
    .select('id, display_name, role')
    .eq('tenant_id', TENANT_ID)
    .eq('display_name', lawyerName)
    .single();

  if (memberError) {
    console.log(`   ❌ 조회 실패: ${memberError.message}`);
  } else {
    console.log(`   ✅ 발견: ${member.id} (${member.role})`);
  }

  // 2. 의뢰인 조회/생성
  const clientName = row['의뢰인명'] as string;
  const clientPhone = row['의뢰인연락처'] as string;
  console.log(`\n🔍 의뢰인 "${clientName}" 조회...`);

  let clientId: string | null = null;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id, name')
    .eq('tenant_id', TENANT_ID)
    .eq('name', clientName)
    .single();

  if (existingClient) {
    clientId = existingClient.id;
    console.log(`   ✅ 기존 의뢰인 발견: ${clientId}`);
  } else {
    console.log(`   📝 신규 의뢰인 생성 시도...`);
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        tenant_id: TENANT_ID,
        name: clientName,
        phone: clientPhone,
      })
      .select()
      .single();

    if (clientError) {
      console.log(`   ❌ 생성 실패: ${clientError.message}`);
    } else {
      clientId = newClient.id;
      console.log(`   ✅ 생성 완료: ${clientId}`);
    }
  }

  // 3. 사건 생성
  const courtCaseNumber = (row['사건번호'] as string).replace(/^[가-힣]+/, ''); // 법원명 접두사 제거
  const caseName = row['사건명'] as string || courtCaseNumber;
  const courtName = row['법원명'] as string;

  console.log(`\n📋 사건 생성 시도...`);
  console.log(`   사건번호: ${courtCaseNumber}`);
  console.log(`   법원: ${courtName}`);

  const { data: newCase, error: caseError } = await supabase
    .from('legal_cases')
    .insert({
      tenant_id: TENANT_ID,
      case_name: caseName,
      court_case_number: courtCaseNumber,
      court_name: courtName,
      primary_client_id: clientId,
      primary_client_name: row['의뢰인명'] as string,
      assigned_to: member?.id || null,
      status: '진행중',
    })
    .select()
    .single();

  if (caseError) {
    console.log(`   ❌ 사건 생성 실패: ${caseError.message}`);
    console.log(`      코드: ${caseError.code}`);
    console.log(`      상세: ${caseError.details}`);
    console.log(`      힌트: ${caseError.hint}`);
    return;
  }

  console.log(`   ✅ 사건 생성 완료: ${newCase.id}`);

  // 4. case_assignees 추가
  if (member) {
    console.log(`\n👥 case_assignees 추가...`);
    const { error: assigneeError } = await supabase
      .from('case_assignees')
      .insert({
        tenant_id: TENANT_ID,
        case_id: newCase.id,
        member_id: member.id,
        is_primary: true,
      });

    if (assigneeError) {
      console.log(`   ❌ 담당자 추가 실패: ${assigneeError.message}`);
    } else {
      console.log(`   ✅ 담당자 추가 완료`);
    }
  }

  // 정리
  console.log(`\n🧹 테스트 데이터 정리...`);
  await supabase.from('case_assignees').delete().eq('case_id', newCase.id);
  await supabase.from('legal_cases').delete().eq('id', newCase.id);
  if (clientId && !existingClient) {
    await supabase.from('clients').delete().eq('id', clientId);
  }
  console.log(`   완료`);
}

main().catch(console.error);
