/**
 * 기존 스냅샷에서 종국결과를 추출하여 legal_cases 테이블 업데이트
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

  // 스냅샷에서 진행내용 조회
  const { data: snapshot } = await supabase
    .from('scourt_case_snapshots')
    .select('progress')
    .eq('legal_case_id', caseId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .single();

  const progress = snapshot?.progress || [];

  // 종국 항목 찾기
  const endProgressItem = progress.find((item: { prcdNm?: string }) =>
    item.prcdNm?.startsWith('종국 : ')
  );

  if (endProgressItem && endProgressItem.prcdNm) {
    const caseResult = endProgressItem.prcdNm.replace('종국 : ', '').trim();
    const caseResultDate = endProgressItem.prcdDt || null;

    console.log('추출된 종국결과:', caseResult);
    console.log('종국일:', caseResultDate);

    // legal_cases 업데이트
    const { error } = await supabase
      .from('legal_cases')
      .update({
        case_result: caseResult,
        case_result_date: caseResultDate,
      })
      .eq('id', caseId);

    if (error) {
      console.error('업데이트 에러:', error);
    } else {
      console.log('✅ legal_cases 업데이트 완료');
    }
  } else {
    console.log('종국 항목을 찾지 못했습니다');
  }

  // 업데이트 확인
  const { data: legalCase } = await supabase
    .from('legal_cases')
    .select('case_result, case_result_date')
    .eq('id', caseId)
    .single();

  console.log('\n=== 업데이트된 사건 정보 ===');
  console.log('case_result:', legalCase?.case_result);
  console.log('case_result_date:', legalCase?.case_result_date);
}

main().catch(console.error);
