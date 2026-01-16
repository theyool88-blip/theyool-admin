/**
 * 잘못 등록된 상소기간 데드라인 조회 및 삭제 스크립트
 *
 * 문제: SCOURT 자동등록 시 "선고기일 지정" 같은 진행내용이
 *       "result_announced"로 잘못 분류되어 상소기간이 미리 등록됨
 *
 * 사용법:
 *   npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts          # 조회만
 *   npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts --delete # 삭제 실행
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DELETE_MODE = process.argv.includes('--delete');

async function findIncorrectDeadlines() {
  console.log('=== 잘못 등록된 상소기간 데드라인 조회 ===\n');

  // 1. SCOURT 자동등록된 상소기간 전체 조회
  const { data: allDeadlines, error: allError } = await supabase
    .from('case_deadlines')
    .select(`
      id,
      case_number,
      case_id,
      deadline_type,
      trigger_date,
      deadline_date,
      notes,
      created_at
    `)
    .in('deadline_type', ['DL_APPEAL', 'DL_FAMILY_NONLIT', 'DL_CRIMINAL_APPEAL'])
    .ilike('notes', '%SCOURT 자동등록%')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('조회 오류:', allError);
    return;
  }

  console.log(`총 SCOURT 자동등록 상소기간: ${allDeadlines?.length || 0}건\n`);

  // 2. 각 데드라인에 대해 종국결과 확인
  const suspiciousDeadlines: typeof allDeadlines = [];

  for (const deadline of allDeadlines || []) {
    // legal_cases에서 court_case_number 조회
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('court_case_number, case_name')
      .eq('id', deadline.case_id)
      .single();

    if (!legalCase) continue;

    // scourt_cases에서 종국결과 확인
    const { data: scourtCase } = await supabase
      .from('scourt_cases')
      .select('basic_info')
      .eq('case_number', legalCase.court_case_number)
      .single();

    const finalResult = scourtCase?.basic_info?.['종국결과'];

    // 종국결과가 없으면 의심 케이스
    if (!finalResult || finalResult.trim() === '') {
      suspiciousDeadlines.push({
        ...deadline,
        case_name: legalCase.case_name,
      } as typeof deadline & { case_name: string });
    }
  }

  console.log(`의심 케이스 (종국결과 없음): ${suspiciousDeadlines.length}건\n`);

  if (suspiciousDeadlines.length === 0) {
    console.log('✅ 잘못된 데드라인이 없습니다.');
    return;
  }

  // 의심 케이스 출력
  console.log('--- 의심 케이스 목록 ---');
  for (const d of suspiciousDeadlines) {
    console.log(`
ID: ${d.id}
사건번호: ${d.case_number}
사건명: ${(d as unknown as { case_name: string }).case_name || '(없음)'}
유형: ${d.deadline_type}
기산일: ${d.trigger_date}
만료일: ${d.deadline_date}
메모: ${d.notes}
생성일: ${d.created_at}
---`);
  }

  // 삭제 모드
  if (DELETE_MODE) {
    console.log('\n🗑️  삭제 모드 활성화 - 삭제를 진행합니다...\n');

    const idsToDelete = suspiciousDeadlines.map((d) => d.id);

    const { error: deleteError } = await supabase
      .from('case_deadlines')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('삭제 오류:', deleteError);
    } else {
      console.log(`✅ ${idsToDelete.length}건 삭제 완료`);
    }
  } else {
    console.log('\n💡 삭제하려면 --delete 옵션을 추가하세요:');
    console.log('   npx tsx scripts/cleanup-incorrect-appeal-deadlines.ts --delete');
  }
}

findIncorrectDeadlines().catch(console.error);
