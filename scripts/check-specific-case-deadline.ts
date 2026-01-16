/**
 * 특정 사건의 데드라인 조회
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCase() {
  console.log('=== 사건 데드라인 조회 ===\n');

  // 1. 서산가정2025드단50218 사건 찾기
  const caseNumber = '2025드단50218';

  // case_deadlines에서 사건번호로 조회
  const { data: deadlines, error: deadlineError } = await supabase
    .from('case_deadlines')
    .select('*')
    .ilike('case_number', `%${caseNumber}%`);

  console.log('case_deadlines 조회 결과:');
  if (deadlineError) {
    console.error('오류:', deadlineError);
  } else if (!deadlines || deadlines.length === 0) {
    console.log('데드라인 없음');
  } else {
    for (const d of deadlines) {
      console.log(JSON.stringify(d, null, 2));
    }
  }

  // 2. legal_cases에서 사건 찾기
  console.log('\n\n=== legal_cases 조회 ===');
  const { data: cases, error: caseError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, case_name')
    .ilike('court_case_number', `%${caseNumber}%`);

  if (caseError) {
    console.error('오류:', caseError);
  } else if (!cases || cases.length === 0) {
    console.log('사건 없음');
  } else {
    for (const c of cases) {
      console.log(JSON.stringify(c, null, 2));

      // 해당 사건의 모든 데드라인 조회
      const { data: caseDeadlines } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('case_id', c.id);

      console.log('\n해당 사건의 데드라인:');
      if (!caseDeadlines || caseDeadlines.length === 0) {
        console.log('없음');
      } else {
        for (const d of caseDeadlines) {
          console.log(JSON.stringify(d, null, 2));
        }
      }
    }
  }

  // 3. 12월 23일 만료인 모든 DL_APPEAL 조회
  console.log('\n\n=== 2025-12-23 만료 DL_APPEAL 조회 ===');
  const { data: dec23Deadlines } = await supabase
    .from('case_deadlines')
    .select(`
      *,
      legal_cases (
        court_case_number,
        case_name
      )
    `)
    .eq('deadline_type', 'DL_APPEAL')
    .eq('deadline_date', '2025-12-23');

  if (!dec23Deadlines || dec23Deadlines.length === 0) {
    console.log('없음');
  } else {
    for (const d of dec23Deadlines) {
      console.log(JSON.stringify(d, null, 2));
    }
  }

  // 4. 모든 DL_APPEAL 조회
  console.log('\n\n=== 모든 DL_APPEAL 조회 ===');
  const { data: allAppeals } = await supabase
    .from('case_deadlines')
    .select(`
      id,
      case_number,
      deadline_type,
      trigger_date,
      deadline_date,
      notes,
      created_at,
      legal_cases (
        court_case_number,
        case_name
      )
    `)
    .eq('deadline_type', 'DL_APPEAL')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`총 ${allAppeals?.length || 0}건`);
  for (const d of allAppeals || []) {
    console.log(`
사건번호: ${d.case_number}
사건명: ${(d.legal_cases as { case_name?: string })?.case_name || '(없음)'}
기산일: ${d.trigger_date}
만료일: ${d.deadline_date}
메모: ${d.notes}
생성일: ${d.created_at}
---`);
  }
}

checkCase().catch(console.error);
