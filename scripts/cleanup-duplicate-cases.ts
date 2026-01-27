import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupDuplicates() {
  console.log('🔍 중복 사건 확인 중...\n');

  const { data, error } = await supabase
    .from('legal_cases')
    .select('id, tenant_id, court_case_number, court_name, case_name, created_at')
    .not('court_case_number', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 중복 찾기
  const groups: Record<string, typeof data> = {};
  for (const c of data) {
    const key = `${c.tenant_id}|${c.court_case_number}|${c.court_name || 'NULL'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ 중복 사건 없음');
    return;
  }

  console.log(`⚠️  중복 그룹: ${duplicates.length}건\n`);

  // 삭제할 ID 수집 (가장 오래된 것 제외)
  const idsToDelete: string[] = [];

  for (const [key, cases] of duplicates) {
    // created_at 기준으로 정렬 (가장 오래된 것이 첫 번째)
    const sorted = cases.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const [keep, ...remove] = sorted;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`사건번호: ${keep.court_case_number}`);
    console.log(`법원: ${keep.court_name}`);
    console.log(`✅ 유지: ${keep.id} (${keep.case_name}) - ${keep.created_at}`);
    for (const r of remove) {
      console.log(`❌ 삭제: ${r.id} (${r.case_name}) - ${r.created_at}`);
      idsToDelete.push(r.id);
    }
  }

  console.log(`\n총 ${idsToDelete.length}개 사건 삭제 예정\n`);

  // 삭제 실행
  console.log('🗑️  삭제 중...\n');

  let deletedCount = 0;
  for (const id of idsToDelete) {
    const { error: deleteError } = await supabase
      .from('legal_cases')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error(`❌ 삭제 실패 (${id}):`, deleteError.message);
    } else {
      deletedCount++;
    }
  }

  console.log(`\n✅ 완료: ${deletedCount}/${idsToDelete.length}개 사건 삭제됨`);
  console.log('   (관련 기일, 당사자 등도 CASCADE로 자동 삭제됨)');
}

cleanupDuplicates();
