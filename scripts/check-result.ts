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
    .select('basic_info, progress, scraped_at')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  console.log('=== 기본정보 ===');
  const info = data?.basic_info as any;
  console.log('종국결과:', info?.['종국결과'] || '(없음)');
  console.log('종국일:', info?.['종국일']);

  console.log('\n=== 진행내용에서 종국결과 찾기 ===');
  const progress = data?.progress || [];

  // 판결, 선고, 종국 관련 항목 찾기
  const resultKeywords = ['판결', '선고', '종국', '원고', '피고', '청구', '기각', '인용', '각하', '취하', '화해', '조정'];

  progress.forEach((item: any, i: number) => {
    const name = item.prcdNm || item.name || '';
    const result = item.prcdRslt || item.rslt || item.result || '';
    const date = item.prcdDt || item.date || '';

    const hasKeyword = resultKeywords.some(kw => name.includes(kw) || result.includes(kw));
    if (hasKeyword) {
      console.log(`[${i}] ${date} - ${name} ${result ? `(${result})` : ''}`);
    }
  });

  // 첫 5개 진행내용 출력
  console.log('\n=== 진행내용 샘플 (최근 5건) ===');
  progress.slice(0, 5).forEach((item: any, i: number) => {
    console.log(`[${i}] ${JSON.stringify(item)}`);
  });
}

main().catch(console.error);
