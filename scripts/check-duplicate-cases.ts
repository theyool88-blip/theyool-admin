import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDuplicates() {
  console.log('🔍 중복 사건 확인 중...\n');

  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, tenant_id, court_case_number, court_name, case_name, created_at')
    .not('court_case_number', 'is', null)
    .order('court_case_number');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 수동으로 중복 찾기
  const groups: Record<string, typeof data> = {};
  for (const c of data) {
    const key = `${c.tenant_id}|${c.court_case_number}|${c.court_name || 'NULL'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ 중복 사건 없음 - 마이그레이션 적용 가능');
  } else {
    console.log(`⚠️  중복 사건 발견: ${duplicates.length}건\n`);
    for (const [key, cases] of duplicates) {
      const [tenantId, caseNumber, courtName] = key.split('|');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`사건번호: ${caseNumber}`);
      console.log(`법원: ${courtName}`);
      console.log(`중복 개수: ${cases.length}`);
      console.log('');
      for (const c of cases) {
        console.log(`  ID: ${c.id}`);
        console.log(`  사건명: ${c.case_name}`);
        console.log(`  생성일: ${c.created_at}`);
        console.log('');
      }
    }
    console.log('⚠️  마이그레이션 전에 중복 데이터를 정리해야 합니다.');
  }
}

checkDuplicates();
