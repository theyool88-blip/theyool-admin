/**
 * 테스트 환경 구축 스크립트
 * - 테스트 법무법인(tenant) 생성
 * - 변호사 2명 (1명 관리자/owner, 1명 일반 lawyer)
 * - 직원 1명 (staff)
 * - 46개 테스트 사건 등록
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config({ path: '.env.local' });

// Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다.');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 테스트 사용자 정보
const TEST_USERS = {
  owner: {
    email: 'owner@testlaw.kr',
    password: 'test1234!',
    name: '김대표',
    role: 'owner' as const,
    barNumber: '12345',
  },
  lawyer: {
    email: 'lawyer@testlaw.kr',
    password: 'test1234!',
    name: '박변호',
    role: 'lawyer' as const,
    barNumber: '67890',
  },
  staff: {
    email: 'staff@testlaw.kr',
    password: 'test1234!',
    name: '이직원',
    role: 'staff' as const,
    barNumber: null,
  },
};

// 테스트 법무법인 정보
const TEST_TENANT = {
  name: '테스트 법무법인',
  slug: 'test-law-firm-' + Date.now(),
  type: 'firm' as const,
  plan: 'professional' as const,
};

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

async function cleanupExistingTestData() {
  console.log('\n🧹 기존 테스트 데이터 정리 중...');

  // 기존 테스트 사용자 삭제
  for (const user of Object.values(TEST_USERS)) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === user.email);
    if (existingUser) {
      console.log(`  - 기존 사용자 삭제: ${user.email}`);
      await supabase.auth.admin.deleteUser(existingUser.id);
    }
  }

  // 기존 테스트 테넌트 삭제 (slug로 검색)
  const { data: existingTenants } = await supabase
    .from('tenants')
    .select('id, slug')
    .like('slug', 'test-law-firm-%');

  if (existingTenants && existingTenants.length > 0) {
    for (const tenant of existingTenants) {
      console.log(`  - 기존 테넌트 삭제: ${tenant.slug}`);

      // 관련 데이터 삭제 (cascade 없는 경우)
      await supabase.from('legal_cases').delete().eq('tenant_id', tenant.id);
      await supabase.from('clients').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenant_members').delete().eq('tenant_id', tenant.id);
      await supabase.from('tenants').delete().eq('id', tenant.id);
    }
  }

  console.log('  ✅ 정리 완료');
}

async function createTestUsers() {
  console.log('\n👤 테스트 사용자 생성 중...');

  const createdUsers: Record<string, string> = {};

  for (const [key, user] of Object.entries(TEST_USERS)) {
    console.log(`  - ${user.name} (${user.email}) 생성 중...`);

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        role: 'lawyer',
      },
    });

    if (error) {
      console.error(`    ❌ 오류: ${error.message}`);
      throw error;
    }

    createdUsers[key] = data.user.id;
    console.log(`    ✅ 생성됨 (ID: ${data.user.id})`);
  }

  return createdUsers;
}

async function createTestTenant() {
  console.log('\n🏢 테스트 법무법인 생성 중...');

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      name: TEST_TENANT.name,
      slug: TEST_TENANT.slug,
      type: TEST_TENANT.type,
      plan: TEST_TENANT.plan,
      status: 'active',
      is_verified: true,
      features: {
        maxCases: 1000,
        maxClients: 500,
        maxMembers: 10,
        scourtSync: true,
        advancedReporting: true,
      },
    })
    .select()
    .single();

  if (error) {
    console.error(`  ❌ 오류: ${error.message}`);
    throw error;
  }

  console.log(`  ✅ 생성됨: ${data.name} (ID: ${data.id})`);
  return data;
}

async function createTenantMembers(
  tenantId: string,
  users: Record<string, string>
) {
  console.log('\n👥 멤버십 생성 중...');

  for (const [key, userId] of Object.entries(users)) {
    const userInfo = TEST_USERS[key as keyof typeof TEST_USERS];
    console.log(`  - ${userInfo.name} → ${userInfo.role} 역할 부여...`);

    const { error } = await supabase.from('tenant_members').insert({
      tenant_id: tenantId,
      user_id: userId,
      role: userInfo.role,
      display_name: userInfo.name,
      bar_number: userInfo.barNumber,
      email: userInfo.email,
      status: 'active',
      permissions: {},
    });

    if (error) {
      console.error(`    ❌ 오류: ${error.message}`);
      throw error;
    }

    console.log(`    ✅ 완료`);
  }
}

async function createTestClients(tenantId: string) {
  console.log('\n👨‍👩‍👧 테스트 의뢰인 생성 중...');

  // 다양한 테스트 의뢰인 생성
  const clients = [
    { name: '홍길동', phone: '010-1234-5678' },
    { name: '김철수', phone: '010-2345-6789' },
    { name: '이영희', phone: '010-3456-7890' },
  ];

  const createdClients: Record<string, string> = {};

  for (const client of clients) {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        name: client.name,
        phone: client.phone,
      })
      .select()
      .single();

    if (error) {
      console.error(`  ❌ ${client.name} 생성 실패: ${error.message}`);
      continue;
    }

    createdClients[client.name] = data.id;
    console.log(`  ✅ ${client.name} 생성됨`);
  }

  return createdClients;
}

async function registerTestCases(
  tenantId: string,
  ownerMemberId: string,
  clientId: string
) {
  console.log('\n📋 테스트 사건 등록 중...');

  const testCases = await loadTestCases();
  console.log(`  총 ${testCases.length}개 사건 등록 예정\n`);

  let successCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    const caseData = {
      tenant_id: tenantId,
      case_name: `${testCase.desc} (${testCase.caseNo})`,
      case_type: getCaseType(testCase.type),
      court_name: testCase.court,
      court_case_number: testCase.caseNo,
      client_id: clientId,
      assigned_member_id: ownerMemberId,
      status: '진행중',
      client_role: getClientRole(testCase.type),
      notes: `테스트 사건 - ${testCase.desc}\n당사자: ${testCase.party}`,
    };

    const { data, error } = await supabase
      .from('legal_cases')
      .insert(caseData)
      .select()
      .single();

    if (error) {
      console.log(`  ❌ ${testCase.caseNo}: ${error.message}`);
      failCount++;
    } else {
      console.log(`  ✅ ${testCase.caseNo} (${testCase.desc})`);
      successCount++;
    }
  }

  console.log(`\n  📊 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
}

function getCaseType(caseCode: string): string {
  const typeMap: Record<string, string> = {
    // 민사
    가단: '민사(단독)',
    가소: '민사(소액)',
    가합: '민사(합의)',
    나: '민사(항소)',
    다: '민사(상고)',
    머: '민사조정',
    // 가사
    드단: '가사(단독)',
    드합: '가사(합의)',
    느단: '가사비송(단독)',
    느합: '가사비송(합의)',
    르: '가사(항소)',
    므: '가사(상고)',
    너: '가사비송(항고)',
    즈단: '가사보전(단독)',
    즈합: '가사보전(합의)',
    즈기: '가사신청',
    브: '가사후견(항고)',
    // 형사
    고단: '형사(단독)',
    고합: '형사(합의)',
    노: '형사(항소)',
    도: '형사(상고)',
    // 행정
    구단: '행정(단독)',
    구합: '행정(합의)',
    누: '행정(항소)',
    두: '행정(상고)',
    아: '행정신청',
    // 신청/보전
    카기: '신청(기타)',
    카단: '보전(단독)',
    카합: '보전(합의)',
    카불: '채무불이행자명부',
    카확: '소송비용확정',
    카정: '정정',
    카소: '소송허가',
    카명: '명령',
    카담: '담보취소',
    // 집행
    타채: '채권압류/추심',
    타배: '배당',
    타기: '집행신청',
    // 전자독촉
    차전: '전자지급명령',
    // 회생/파산
    개회: '개인회생',
    하단: '파산',
    하면: '면책',
    // 보호
    동버: '가정보호',
    푸: '소년보호',
    // 감치
    정명: '감치',
    // 기타
    스: '특별항고',
  };

  return typeMap[caseCode] || `기타(${caseCode})`;
}

function getClientRole(caseCode: string): 'plaintiff' | 'defendant' {
  // 대부분 원고(신청인) 측으로 기본 설정
  const defendantTypes = ['고단', '고합', '노', '도']; // 형사는 피고인
  return defendantTypes.includes(caseCode) ? 'defendant' : 'plaintiff';
}

async function getMemberId(tenantId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data.id;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       테스트 환경 구축 스크립트');
  console.log('═══════════════════════════════════════════════════════');

  try {
    // 1. 기존 데이터 정리
    await cleanupExistingTestData();

    // 2. 테스트 사용자 생성
    const users = await createTestUsers();

    // 3. 테스트 법무법인 생성
    const tenant = await createTestTenant();

    // 4. 멤버십 생성
    await createTenantMembers(tenant.id, users);

    // 5. 테스트 의뢰인 생성
    const clients = await createTestClients(tenant.id);

    // 6. owner의 member ID 가져오기
    const ownerMemberId = await getMemberId(tenant.id, users.owner);

    // 7. 테스트 사건 등록
    await registerTestCases(
      tenant.id,
      ownerMemberId,
      clients['홍길동'] || Object.values(clients)[0]
    );

    // 완료 메시지
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                    ✅ 설정 완료!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📌 로그인 정보:');
    console.log('┌────────────────────────────────────────────────────┐');
    console.log(`│ 관리자(Owner): ${TEST_USERS.owner.email}`);
    console.log(`│ 비밀번호: ${TEST_USERS.owner.password}`);
    console.log('├────────────────────────────────────────────────────┤');
    console.log(`│ 변호사: ${TEST_USERS.lawyer.email}`);
    console.log(`│ 비밀번호: ${TEST_USERS.lawyer.password}`);
    console.log('├────────────────────────────────────────────────────┤');
    console.log(`│ 직원: ${TEST_USERS.staff.email}`);
    console.log(`│ 비밀번호: ${TEST_USERS.staff.password}`);
    console.log('└────────────────────────────────────────────────────┘');
    console.log(`\n🏢 법무법인: ${tenant.name}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   ID: ${tenant.id}`);
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

main();
