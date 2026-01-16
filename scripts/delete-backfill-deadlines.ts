/**
 * 백필로 잘못 생성된 데드라인 삭제
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DELETE_MODE = process.argv.includes('--delete');

async function deleteBackfillDeadlines() {
  console.log('=== 백필 데드라인 삭제 ===\n');

  // 백필로 생성된 데드라인 조회
  const { data: deadlines, error } = await supabase
    .from('case_deadlines')
    .select('id, case_number, deadline_type, trigger_date, deadline_date, notes, created_at')
    .ilike('notes', '%백필%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('조회 오류:', error);
    return;
  }

  console.log(`백필 데드라인 발견: ${deadlines?.length || 0}건\n`);

  if (!deadlines || deadlines.length === 0) {
    console.log('삭제할 데드라인 없음');
    return;
  }

  // 목록 출력
  for (const d of deadlines) {
    console.log(`${d.case_number} | ${d.deadline_type} | ${d.trigger_date} → ${d.deadline_date}`);
  }

  if (DELETE_MODE) {
    console.log('\n🗑️  삭제 진행 중...');

    const { error: deleteError, count } = await supabase
      .from('case_deadlines')
      .delete({ count: 'exact' })
      .ilike('notes', '%백필%');

    if (deleteError) {
      console.error('삭제 오류:', deleteError);
    } else {
      console.log(`✅ ${count}건 삭제 완료`);
    }
  } else {
    console.log('\n💡 삭제하려면 --delete 옵션 추가:');
    console.log('   npx tsx scripts/delete-backfill-deadlines.ts --delete');
  }
}

deleteBackfillDeadlines().catch(console.error);
