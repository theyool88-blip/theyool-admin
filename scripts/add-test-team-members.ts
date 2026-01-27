/**
 * 테스트 팀원 추가 스크립트
 * 법무법인 더율에 9명의 팀원 추가 (변호사 3명, 직원 6명)
 * auth.users에도 사용자를 생성하고 tenant_members에 연결
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

// Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 법무법인 더율 tenant ID
const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

// 추가할 팀원 (비밀번호 포함)
const TEAM_MEMBERS = [
  { role: 'lawyer', display_name: '김민수 변호사', email: 'kim.ms@test.com', password: 'test1234!' },
  { role: 'lawyer', display_name: '박지영 변호사', email: 'park.jy@test.com', password: 'test1234!' },
  { role: 'lawyer', display_name: '이준호 변호사', email: 'lee.jh@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '최서연', email: 'choi.sy@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '정하윤', email: 'jung.hy@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '강도윤', email: 'kang.dy@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '윤서준', email: 'yoon.sj@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '임예은', email: 'lim.ye@test.com', password: 'test1234!' },
  { role: 'staff', display_name: '한지우', email: 'han.jw@test.com', password: 'test1234!' },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       테스트 팀원 추가 스크립트');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n🏢 대상 테넌트: ${TENANT_ID}`);

  // 테넌트 존재 확인
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', TENANT_ID)
    .single();

  if (tenantError || !tenant) {
    console.error('❌ 테넌트를 찾을 수 없습니다:', tenantError?.message);
    process.exit(1);
  }

  console.log(`   테넌트명: ${tenant.name}`);

  // 기존 팀원 확인
  const { data: existingMembers } = await supabase
    .from('tenant_members')
    .select('email, display_name, user_id')
    .eq('tenant_id', TENANT_ID);

  console.log(`\n📋 기존 팀원: ${existingMembers?.length || 0}명`);

  // 새 팀원 추가
  console.log('\n👥 새 팀원 추가 중...');

  let successCount = 0;
  let skipCount = 0;
  const addedMembers: { id: string; display_name: string; role: string }[] = [];

  for (const member of TEAM_MEMBERS) {
    // 이미 존재하는 이메일인지 확인
    const existing = existingMembers?.find(m => m.email === member.email);
    if (existing) {
      console.log(`  ⏭️  ${member.display_name} (${member.email}) - 이미 존재`);
      skipCount++;
      continue;
    }

    // 1. auth.users에 사용자 생성
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: member.email,
      password: member.password,
      email_confirm: true,
      user_metadata: {
        name: member.display_name,
        role: member.role,
      },
    });

    if (authError) {
      console.log(`  ❌ ${member.display_name} (auth): ${authError.message}`);
      continue;
    }

    // 2. tenant_members에 멤버 추가
    const { data, error } = await supabase
      .from('tenant_members')
      .insert({
        tenant_id: TENANT_ID,
        user_id: authUser.user.id,
        role: member.role,
        display_name: member.display_name,
        email: member.email,
        status: 'active',
        permissions: {},
      })
      .select('id, display_name, role')
      .single();

    if (error) {
      console.log(`  ❌ ${member.display_name} (member): ${error.message}`);
      // auth 사용자 삭제 (롤백)
      await supabase.auth.admin.deleteUser(authUser.user.id);
    } else {
      console.log(`  ✅ ${member.display_name} (${member.role}) 추가됨`);
      successCount++;
      addedMembers.push(data);
    }
  }

  // 최종 팀원 목록 출력
  const { data: finalMembers } = await supabase
    .from('tenant_members')
    .select('id, display_name, role, email')
    .eq('tenant_id', TENANT_ID)
    .order('role', { ascending: true });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`               결과: 추가 ${successCount}명, 스킵 ${skipCount}명`);
  console.log('═══════════════════════════════════════════════════════');

  console.log('\n📋 현재 팀원 목록:');
  console.log('┌─────────────────────────────────────────────────────────────────┐');

  const lawyers = finalMembers?.filter(m => m.role === 'lawyer' || m.role === 'owner') || [];
  const staff = finalMembers?.filter(m => m.role === 'staff') || [];

  console.log('│ 🎓 변호사/관리자:');
  lawyers.forEach(m => {
    console.log(`│   - ${m.display_name} (${m.role}) - ${m.email}`);
  });

  console.log('│');
  console.log('│ 👤 직원:');
  staff.forEach(m => {
    console.log(`│   - ${m.display_name} - ${m.email}`);
  });

  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log(`\n총 ${finalMembers?.length || 0}명`);
}

main().catch(console.error);
