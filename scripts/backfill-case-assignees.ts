/**
 * 기존 사건에 case_assignees 일괄 생성
 * legal_cases.assigned_to → case_assignees 동기화
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       case_assignees 일괄 생성 (backfill)');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. assigned_to가 있지만 case_assignees가 없는 사건 조회
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, case_name, assigned_to')
    .eq('tenant_id', TENANT_ID)
    .not('assigned_to', 'is', null);

  if (casesError) {
    console.error('사건 조회 실패:', casesError.message);
    return;
  }

  const caseCount = cases ? cases.length : 0;
  console.log(`📋 assigned_to가 있는 사건: ${caseCount}건\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const legalCase of cases || []) {
    // 이미 case_assignees가 있는지 확인
    const { data: existing } = await supabase
      .from('case_assignees')
      .select('id')
      .eq('case_id', legalCase.id)
      .eq('member_id', legalCase.assigned_to)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // case_assignees 생성
    const { error: insertError } = await supabase
      .from('case_assignees')
      .insert({
        tenant_id: TENANT_ID,
        case_id: legalCase.id,
        member_id: legalCase.assigned_to,
        assignee_role: 'lawyer',
        is_primary: true,
      });

    if (insertError) {
      console.error(`❌ ${legalCase.case_name}: ${insertError.message}`);
      failed++;
    } else {
      created++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ 생성: ${created}건`);
  console.log(`⏭️  스킵 (이미 존재): ${skipped}건`);
  console.log(`❌ 실패: ${failed}건`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
