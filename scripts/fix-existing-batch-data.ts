/**
 * 기존 대량 등록 데이터 복구 스크립트
 *
 * 수정된 버그:
 * 1. case_clients 누락 → 생성
 * 2. scourt_last_snapshot_id 누락 → 연결
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';
const DRY_RUN = process.argv.includes('--dry-run');

async function fixData() {
  console.log('=== 기존 대량 등록 데이터 복구 ===');
  console.log(`모드: ${DRY_RUN ? 'DRY RUN (실제 변경 없음)' : '실제 실행'}\n`);

  // 1. case_clients 누락 복구
  console.log('📋 1. case_clients 누락 복구\n');

  // primary_client_name은 있지만 case_clients가 없는 사건 찾기
  const { data: casesWithName, error: caseError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, primary_client_name')
    .eq('tenant_id', TENANT_ID)
    .not('primary_client_name', 'is', null);

  if (caseError) {
    console.error('사건 조회 오류:', caseError.message);
    return;
  }

  let caseClientsCreated = 0;

  for (const legalCase of casesWithName || []) {
    // 이미 case_clients가 있는지 확인
    const { data: existingCC } = await supabase
      .from('case_clients')
      .select('id')
      .eq('case_id', legalCase.id)
      .limit(1);

    if (existingCC && existingCC.length > 0) {
      continue; // 이미 있음
    }

    // clients 테이블에서 이름으로 찾기
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('name', legalCase.primary_client_name)
      .single();

    if (!client) {
      console.log(`  ⚠️ ${legalCase.court_case_number}: 의뢰인 "${legalCase.primary_client_name}" 찾을 수 없음`);
      continue;
    }

    console.log(`  → ${legalCase.court_case_number}: case_clients 생성 (${legalCase.primary_client_name})`);

    if (!DRY_RUN) {
      const { error: insertError } = await supabase
        .from('case_clients')
        .insert({
          tenant_id: TENANT_ID,
          case_id: legalCase.id,
          client_id: client.id,
          is_primary_client: true,
        });

      if (insertError) {
        console.error(`    ✗ 오류: ${insertError.message}`);
      } else {
        caseClientsCreated++;
      }
    } else {
      caseClientsCreated++;
    }
  }

  console.log(`\n  총 ${caseClientsCreated}건 case_clients ${DRY_RUN ? '생성 예정' : '생성 완료'}`);

  // 2. scourt_last_snapshot_id 누락 복구
  console.log('\n📋 2. scourt_last_snapshot_id 누락 복구\n');

  // scourt_enc_cs_no는 있지만 scourt_last_snapshot_id가 없는 사건
  const { data: casesWithoutSnapshot, error: snapError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number')
    .eq('tenant_id', TENANT_ID)
    .not('scourt_enc_cs_no', 'is', null)
    .is('scourt_last_snapshot_id', null);

  if (snapError) {
    console.error('사건 조회 오류:', snapError.message);
    return;
  }

  let snapshotsLinked = 0;

  for (const legalCase of casesWithoutSnapshot || []) {
    // 해당 사건의 최신 스냅샷 찾기
    const { data: snapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id')
      .eq('legal_case_id', legalCase.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!snapshot) {
      console.log(`  ⚠️ ${legalCase.court_case_number}: 스냅샷 없음`);
      continue;
    }

    console.log(`  → ${legalCase.court_case_number}: snapshot_id 연결`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('legal_cases')
        .update({ scourt_last_snapshot_id: snapshot.id })
        .eq('id', legalCase.id);

      if (updateError) {
        console.error(`    ✗ 오류: ${updateError.message}`);
      } else {
        snapshotsLinked++;
      }
    } else {
      snapshotsLinked++;
    }
  }

  console.log(`\n  총 ${snapshotsLinked}건 snapshot_id ${DRY_RUN ? '연결 예정' : '연결 완료'}`);

  // 결과 요약
  console.log('\n=== 복구 완료 ===');
  console.log(`case_clients: ${caseClientsCreated}건`);
  console.log(`snapshot_id: ${snapshotsLinked}건`);

  if (DRY_RUN) {
    console.log('\n💡 실제 실행하려면: npx tsx scripts/fix-existing-batch-data.ts');
  }
}

fixData().catch(console.error);
