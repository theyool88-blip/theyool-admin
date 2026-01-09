import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function main() {
  // 1. 테넌트 찾기
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
  console.log('🏢 테넌트:', tenant.name);

  // 2. 사건 등록
  const { data: insertedCase, error: insertError } = await supabase
    .from('legal_cases')
    .insert({
      tenant_id: tenant.id,
      court_case_number: '2024드단25547',
      case_name: '엄현식v상대방',
      case_type: 'family',
      court_name: '수원가정법원 평택지원',
      status: '진행중',
    })
    .select('id, court_case_number')
    .single();

  if (insertError) {
    console.error('❌ 사건 등록 실패:', insertError.message);
    process.exit(1);
  }
  console.log('✅ 사건 등록 완료:', insertedCase.court_case_number);

  // 3. SCOURT 동기화
  console.log('🔄 SCOURT 동기화 중...');
  const response = await fetch(`${APP_URL}/api/admin/scourt/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      legalCaseId: insertedCase.id,
      caseNumber: '2024드단25547',
      courtName: '수원가정법원 평택지원',
      partyName: '엄현식',
      forceRefresh: true,
    }),
  });

  const result = await response.json();
  if (response.ok && result.success) {
    console.log('✅ SCOURT 동기화 성공:', result.caseName || '-');
  } else {
    console.log('❌ SCOURT 동기화 실패:', result.error || 'Unknown error');
  }
}

main().catch(console.error);
