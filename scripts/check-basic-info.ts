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
    .select('basic_info, raw_data')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  console.log('=== basic_info 전체 필드 ===');
  const info = data?.basic_info as any;
  if (info) {
    Object.keys(info).forEach(key => {
      console.log(key + ': ' + JSON.stringify(info[key]));
    });
  }

  console.log('\n=== raw_data에서 종국결과 관련 필드 찾기 ===');
  const raw = data?.raw_data as any;
  if (raw) {
    const searchInObject = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;

      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const keyLower = key.toLowerCase();

        // 종국결과 관련 필드 찾기
        if (keyLower.includes('ultmt') || keyLower.includes('rslt') || keyLower.includes('end') ||
            key.includes('종국') || key.includes('결과')) {
          console.log(path + key + ': ' + JSON.stringify(value));
        }

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          searchInObject(value, path + key + '.');
        }
      });
    };

    searchInObject(raw);
  }
}

main().catch(console.error);
