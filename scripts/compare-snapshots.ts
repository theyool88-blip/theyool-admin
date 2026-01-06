/**
 * 종국결과 있는 사건과 없는 사건의 스냅샷 비교
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 종국결과가 있는 사건
  const caseWithResult = '2024드단23848';
  // 종국결과가 없는 사건
  const caseWithoutResult = '2025가소73623';

  // 두 사건의 스냅샷 조회
  const { data: snapshots } = await supabase
    .from('scourt_case_snapshots')
    .select('case_number, basic_info')
    .in('case_number', [caseWithResult, caseWithoutResult])
    .order('scraped_at', { ascending: false });

  console.log('=== 스냅샷 비교 ===\n');

  for (const snap of snapshots || []) {
    const basicInfo = snap.basic_info as Record<string, any>;
    console.log('--- ' + snap.case_number + ' ---');

    // 모든 필드 출력 (객체 제외)
    if (basicInfo) {
      const scalarFields = Object.entries(basicInfo)
        .filter(([, v]) => typeof v !== 'object')
        .sort(([a], [b]) => a.localeCompare(b));

      scalarFields.forEach(([key, value]) => {
        console.log('  ' + key + ': ' + JSON.stringify(value));
      });
    }
    console.log('');
  }
}

main().catch(console.error);
