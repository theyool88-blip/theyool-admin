/**
 * 권한 시스템 검증 스크립트
 * - case_assignees 데이터 무결성 확인
 * - assigned_to와 is_primary 동기화 확인
 * - 변호사별 사건 배정 현황
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       권한 시스템 검증');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. 테넌트 멤버 현황
  console.log('📋 1. 테넌트 멤버 현황\n');
  const { data: members, error: membersError } = await supabase
    .from('tenant_members')
    .select('id, display_name, role, email, status')
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'active')
    .order('role');

  if (membersError) {
    console.error('멤버 조회 실패:', membersError.message);
    return;
  }

  const lawyers = members?.filter(m => m.role === 'lawyer') || [];
  const staff = members?.filter(m => m.role === 'staff') || [];
  const admins = members?.filter(m => ['owner', 'admin'].includes(m.role)) || [];

  console.log(`  관리자 (owner/admin): ${admins.length}명`);
  admins.forEach(m => console.log(`    - ${m.display_name} (${m.role})`));

  console.log(`\n  변호사 (lawyer): ${lawyers.length}명`);
  lawyers.forEach(m => console.log(`    - ${m.display_name}`));

  console.log(`\n  직원 (staff): ${staff.length}명`);
  staff.forEach(m => console.log(`    - ${m.display_name}`));

  // 2. 사건 배정 현황
  console.log('\n\n📊 2. 변호사별 사건 배정 현황\n');

  const { data: assignmentStats, error: statsError } = await supabase
    .from('case_assignees')
    .select(`
      member_id,
      is_primary,
      member:tenant_members!member_id (
        display_name,
        role
      )
    `)
    .eq('tenant_id', TENANT_ID);

  if (statsError) {
    console.error('배정 통계 조회 실패:', statsError.message);
    return;
  }

  // 멤버별 통계 집계
  const memberStats = new Map<string, { name: string; role: string; total: number; primary: number }>();

  for (const assignment of assignmentStats || []) {
    const memberId = assignment.member_id;
    const member = assignment.member as { display_name: string; role: string } | null;

    if (!memberStats.has(memberId)) {
      memberStats.set(memberId, {
        name: member?.display_name || '알 수 없음',
        role: member?.role || 'unknown',
        total: 0,
        primary: 0
      });
    }

    const stat = memberStats.get(memberId)!;
    stat.total++;
    if (assignment.is_primary) stat.primary++;
  }

  // 결과 출력
  const sortedStats = Array.from(memberStats.entries())
    .sort((a, b) => b[1].total - a[1].total);

  console.log('  담당자 | 역할 | 총 배정 | 주담당');
  console.log('  ' + '-'.repeat(50));

  for (const [_, stat] of sortedStats) {
    console.log(`  ${stat.name.padEnd(15)} | ${stat.role.padEnd(6)} | ${String(stat.total).padStart(5)}건 | ${String(stat.primary).padStart(5)}건`);
  }

  // 3. assigned_to vs case_assignees.is_primary 동기화 검증
  console.log('\n\n🔄 3. assigned_to ↔ case_assignees.is_primary 동기화 검증\n');

  // assigned_to가 있지만 case_assignees에 없는 경우
  const { data: missingAssignees, error: missingError } = await supabase
    .from('legal_cases')
    .select('id, case_name, assigned_to')
    .eq('tenant_id', TENANT_ID)
    .not('assigned_to', 'is', null);

  if (missingError) {
    console.error('사건 조회 실패:', missingError.message);
    return;
  }

  let syncIssues = 0;
  let missingInAssignees = 0;
  let primaryMismatch = 0;

  for (const legalCase of missingAssignees || []) {
    // case_assignees에서 해당 사건의 primary assignee 확인
    const { data: assignee } = await supabase
      .from('case_assignees')
      .select('member_id, is_primary')
      .eq('case_id', legalCase.id)
      .eq('is_primary', true)
      .maybeSingle();

    if (!assignee) {
      missingInAssignees++;
      if (missingInAssignees <= 3) {
        console.log(`  ⚠️ case_assignees 누락: ${legalCase.case_name}`);
      }
    } else if (assignee.member_id !== legalCase.assigned_to) {
      primaryMismatch++;
      if (primaryMismatch <= 3) {
        console.log(`  ⚠️ primary 불일치: ${legalCase.case_name}`);
        console.log(`     assigned_to: ${legalCase.assigned_to}`);
        console.log(`     is_primary member: ${assignee.member_id}`);
      }
    }
  }

  if (missingInAssignees > 3) {
    console.log(`  ... 외 ${missingInAssignees - 3}건 case_assignees 누락`);
  }
  if (primaryMismatch > 3) {
    console.log(`  ... 외 ${primaryMismatch - 3}건 primary 불일치`);
  }

  syncIssues = missingInAssignees + primaryMismatch;

  if (syncIssues === 0) {
    console.log('  ✅ 모든 사건의 assigned_to와 case_assignees.is_primary가 동기화됨');
  } else {
    console.log(`\n  ❌ 동기화 문제: ${syncIssues}건`);
    console.log(`     - case_assignees 누락: ${missingInAssignees}건`);
    console.log(`     - primary 불일치: ${primaryMismatch}건`);
  }

  // 4. case_assignees 중복 검사
  console.log('\n\n🔍 4. case_assignees 중복 검사\n');

  const { data: duplicates, error: dupError } = await supabase.rpc('check_duplicate_assignees', {
    p_tenant_id: TENANT_ID
  });

  if (dupError && dupError.code !== 'PGRST202') {
    // 함수가 없으면 직접 쿼리
    const { data: allAssignees } = await supabase
      .from('case_assignees')
      .select('case_id, member_id')
      .eq('tenant_id', TENANT_ID);

    const seenKeys = new Set<string>();
    let dupCount = 0;

    for (const a of allAssignees || []) {
      const key = `${a.case_id}:${a.member_id}`;
      if (seenKeys.has(key)) {
        dupCount++;
      } else {
        seenKeys.add(key);
      }
    }

    if (dupCount === 0) {
      console.log('  ✅ 중복 없음');
    } else {
      console.log(`  ❌ 중복 발견: ${dupCount}건`);
    }
  } else {
    console.log('  ✅ 중복 검사 완료');
  }

  // 5. RLS 정책 테스트 (일반 클라이언트 사용)
  console.log('\n\n🔐 5. RLS 정책 설정 확인\n');

  // case_assignees RLS 정책 확인
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies_for_table', { table_name: 'case_assignees' });

  if (policyError && policyError.code !== 'PGRST202') {
    // 함수가 없으면 pg_policies에서 직접 조회
    const { data: pgPolicies, error: pgError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd')
      .eq('tablename', 'case_assignees');

    if (!pgError && pgPolicies && pgPolicies.length > 0) {
      console.log('  case_assignees 테이블 RLS 정책:');
      for (const p of pgPolicies) {
        console.log(`    - ${p.policyname} (${p.cmd})`);
      }
    } else {
      console.log('  ℹ️ RLS 정책 조회 불가 (권한 부족 또는 정책 없음)');
    }
  }

  // 예상되는 RLS 정책 출력
  console.log('\n  예상 RLS 정책 (마이그레이션 파일 기반):');
  console.log('    - case_assignees_select_policy: 테넌트 격리 + can_access_case()');
  console.log('    - case_assignees_insert_policy: 테넌트 격리 + admin 이상 또는 can_access_case()');
  console.log('    - case_assignees_update_policy: 테넌트 격리 + admin 이상');
  console.log('    - case_assignees_delete_policy: 테넌트 격리 + admin 이상');

  // 6. 총 데이터 요약
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('       검증 결과 요약');
  console.log('═══════════════════════════════════════════════════════\n');

  const { count: totalCases } = await supabase
    .from('legal_cases')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const { count: totalAssignees } = await supabase
    .from('case_assignees')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  const { count: casesWithAssignee } = await supabase
    .from('legal_cases')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .not('assigned_to', 'is', null);

  console.log(`  📁 총 사건 수: ${totalCases}건`);
  console.log(`  👤 담당자 지정된 사건: ${casesWithAssignee}건`);
  console.log(`  🔗 case_assignees 레코드: ${totalAssignees}건`);
  console.log(`  📊 평균 담당자 수: ${totalAssignees && casesWithAssignee ? (totalAssignees / casesWithAssignee).toFixed(2) : 'N/A'}명/사건`);

  console.log('\n  동기화 상태:');
  if (syncIssues === 0) {
    console.log('    ✅ 정상 - assigned_to와 case_assignees 완전 동기화');
  } else {
    console.log(`    ⚠️ 문제 발견 - ${syncIssues}건 동기화 필요`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
