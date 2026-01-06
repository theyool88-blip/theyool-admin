/**
 * 스냅샷에서 원본 데이터(raw_data) 확인
 * API 응답의 실제 필드명 찾기
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // raw_data가 있는 스냅샷 찾기
  const { data: snapshots, error } = await supabase
    .from('scourt_case_snapshots')
    .select('id, case_number, basic_info')
    .not('basic_info', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('=== 최근 스냅샷 ===');
  for (const snap of snapshots || []) {
    const basicInfo = snap.basic_info as Record<string, any>;
    console.log('\n--- ' + snap.case_number + ' ---');

    // 종국결과, 소가 관련 필드 찾기
    const relevantKeys = Object.keys(basicInfo).filter(k =>
      k.includes('종국') ||
      k.includes('소가') ||
      k.includes('수리') ||
      k.includes('보존') ||
      k.includes('결과')
    );

    if (relevantKeys.length > 0) {
      relevantKeys.forEach(key => {
        console.log('  ' + key + ': ' + JSON.stringify(basicInfo[key]));
      });
    } else {
      console.log('  (관련 필드 없음)');
    }

    // 모든 키 출력
    console.log('  모든 필드: ' + Object.keys(basicInfo).filter(k => typeof basicInfo[k] !== 'object').join(', '));
  }
}

main().catch(console.error);
