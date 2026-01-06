/**
 * 스냅샷의 basic_info에 있는 모든 필드 확인
 * 종국결과, 원고소가, 피고소가 등 누락된 필드 찾기
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const caseId = '5379a691-5755-4fd5-9b09-2044a18f97a6';

  const { data } = await supabase
    .from('scourt_case_snapshots')
    .select('basic_info')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  const basicInfo = data?.basic_info as Record<string, any>;

  console.log('=== basic_info 전체 필드 ===');
  if (basicInfo) {
    Object.entries(basicInfo).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        console.log(key + ': ' + JSON.stringify(value).substring(0, 100) + '...');
      } else {
        console.log(key + ': ' + JSON.stringify(value));
      }
    });
  } else {
    console.log('basic_info가 null입니다');
  }

  // 찾아야 할 필드들
  console.log('\n=== 찾아야 할 필드 확인 ===');
  const expectedFields = ['종국결과', '원고소가', '피고소가', '수리구분', '병합구분', '보존여부'];
  expectedFields.forEach(field => {
    const value = basicInfo?.[field];
    console.log(field + ': ' + (value !== undefined ? JSON.stringify(value) : '(없음)'));
  });
}

main().catch(console.error);
