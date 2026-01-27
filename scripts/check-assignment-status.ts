/**
 * 담당변호사 배정 현황 확인 스크립트
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('       담당변호사 배정 현황');
  console.log('═══════════════════════════════════════════════════════\n');

  // 변호사별 배정 사건 수 확인
  const { data: cases, error } = await supabase
    .from('legal_cases')
    .select(`
      id,
      assigned_to
    `)
    .eq('tenant_id', TENANT_ID);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const assignedCases = cases?.filter(c => c.assigned_to) || [];
  const unassignedCases = cases?.filter(c => !c.assigned_to) || [];

  console.log(`📊 전체 사건: ${cases?.length || 0}건`);
  console.log(`   - 담당자 배정됨: ${assignedCases.length}건`);
  console.log(`   - 담당자 미배정: ${unassignedCases.length}건`);

  // 담당자별 집계
  if (assignedCases.length > 0) {
    const { data: members } = await supabase
      .from('tenant_members')
      .select('id, display_name, role')
      .eq('tenant_id', TENANT_ID);

    const memberMap = new Map(members?.map(m => [m.id, m]) || []);
    const counts: Record<string, { name: string; role: string; count: number }> = {};

    assignedCases.forEach(c => {
      const member = memberMap.get(c.assigned_to);
      if (member) {
        if (!counts[member.id]) {
          counts[member.id] = { name: member.display_name, role: member.role, count: 0 };
        }
        counts[member.id].count++;
      }
    });

    console.log('\n📋 담당자별 배정 현황:');
    console.log('─'.repeat(50));

    Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .forEach(({ name, role, count }) => {
        const roleLabel = role === 'lawyer' ? '변호사' : role === 'owner' ? '관리자' : '직원';
        console.log(`  ${name} (${roleLabel}): ${count}건`);
      });

    console.log('─'.repeat(50));
  }

  // 팀원 목록
  const { data: allMembers } = await supabase
    .from('tenant_members')
    .select('id, display_name, role, email')
    .eq('tenant_id', TENANT_ID)
    .order('role');

  console.log('\n👥 등록된 팀원:');
  const lawyers = allMembers?.filter(m => m.role === 'lawyer' || m.role === 'owner') || [];
  const staff = allMembers?.filter(m => m.role === 'staff') || [];

  console.log(`  변호사/관리자: ${lawyers.length}명`);
  lawyers.forEach(m => console.log(`    - ${m.display_name}`));

  console.log(`  직원: ${staff.length}명`);
  staff.forEach(m => console.log(`    - ${m.display_name}`));

  console.log('\n═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
