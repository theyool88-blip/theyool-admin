/**
 * 당사자 마스킹 문제 디버깅 스크립트
 *
 * 사용법: npx tsx scripts/debug-party-masking.ts <case_id>
 *
 * 검증 항목:
 * 1. case_parties 테이블 조회
 * 2. 각 당사자의 party_name, manual_override, scourt_name_raw 등 출력
 * 3. case_clients 연결 상태 확인
 * 4. isMaskedPartyName() 함수로 마스킹 여부 테스트
 */

import { createAdminClient } from '../lib/supabase/admin';
import { isMaskedPartyName } from '../types/case-party';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface CaseParty {
  id: string;
  party_name: string;
  party_type: string;
  party_type_label: string | null;
  party_order: number;
  is_primary: boolean | null;
  manual_override: boolean;
  scourt_name_raw: string | null;
  scourt_party_index: number | null;
  scourt_synced: boolean;
  created_at: string;
  updated_at: string;
}

interface CaseClient {
  id: string;
  case_id: string;
  client_id: string;
  linked_party_id: string | null;
  is_primary_client: boolean;
  client?: {
    id: string;
    name: string;
  };
  linked_party?: {
    id: string;
    party_name: string;
  };
}

async function debugPartyMasking(caseId: string) {
  const supabase = createAdminClient();

  console.log('='.repeat(80));
  console.log('당사자 마스킹 디버깅');
  console.log('='.repeat(80));
  console.log(`사건 ID: ${caseId}\n`);

  // 1. case_parties 조회
  const { data: parties, error: partiesError } = await supabase
    .from('case_parties')
    .select('*')
    .eq('case_id', caseId)
    .order('party_order');

  if (partiesError) {
    console.error('❌ case_parties 조회 실패:', partiesError.message);
    return;
  }

  if (!parties || parties.length === 0) {
    console.log('⚠️  등록된 당사자가 없습니다.');
    return;
  }

  console.log(`📋 총 ${parties.length}명의 당사자 발견\n`);

  // 2. 각 당사자 상세 정보 출력
  console.log('='.repeat(80));
  console.log('당사자 상세 정보');
  console.log('='.repeat(80));

  parties.forEach((party: CaseParty, index: number) => {
    console.log(`\n[${index + 1}] ${party.party_type_label || party.party_type}`);
    console.log('─'.repeat(80));

    // 핵심 필드
    console.log(`  ID:               ${party.id}`);
    console.log(`  party_name:       "${party.party_name}"`);
    console.log(`  scourt_name_raw:  ${party.scourt_name_raw ? `"${party.scourt_name_raw}"` : 'null'}`);

    // 마스킹 테스트
    const isMasked = isMaskedPartyName(party.party_name);
    const maskStatus = isMasked ? '🔒 마스킹됨' : '✅ 실명';
    console.log(`  마스킹 여부:      ${maskStatus}`);

    if (party.scourt_name_raw) {
      const isRawMasked = isMaskedPartyName(party.scourt_name_raw);
      console.log(`  scourt_name_raw 마스킹: ${isRawMasked ? '🔒 마스킹됨' : '✅ 실명'}`);
    }

    // 플래그
    console.log(`  manual_override:  ${party.manual_override}`);
    console.log(`  scourt_synced:    ${party.scourt_synced}`);
    console.log(`  is_primary:       ${party.is_primary ?? 'null'}`);
    console.log(`  scourt_party_index: ${party.scourt_party_index ?? 'null'}`);
    console.log(`  party_order:      ${party.party_order}`);

    // 타임스탬프
    console.log(`  created_at:       ${party.created_at}`);
    console.log(`  updated_at:       ${party.updated_at}`);
  });

  // 3. case_clients 연결 상태 확인
  console.log('\n');
  console.log('='.repeat(80));
  console.log('의뢰인 연결 상태 (case_clients)');
  console.log('='.repeat(80));

  const { data: caseClients, error: clientsError } = await supabase
    .from('case_clients')
    .select(`
      id,
      case_id,
      client_id,
      linked_party_id,
      is_primary_client,
      client:clients(id, name),
      linked_party:case_parties!linked_party_id(id, party_name)
    `)
    .eq('case_id', caseId);

  if (clientsError) {
    console.error('❌ case_clients 조회 실패:', clientsError.message);
  } else if (!caseClients || caseClients.length === 0) {
    console.log('⚠️  연결된 의뢰인이 없습니다.');
  } else {
    console.log(`\n📋 총 ${caseClients.length}명의 의뢰인 연결\n`);

    (caseClients as any[]).forEach((cc: any, index: number) => {
      console.log(`[${index + 1}] 의뢰인: ${cc.client?.name || '(unknown)'}`);
      console.log(`    client_id:        ${cc.client_id}`);
      console.log(`    linked_party_id:  ${cc.linked_party_id || 'null'}`);
      console.log(`    is_primary_client: ${cc.is_primary_client}`);

      if (cc.linked_party) {
        console.log(`    연결된 당사자:    "${cc.linked_party.party_name}"`);
      } else {
        console.log(`    연결된 당사자:    없음`);
      }
      console.log('');
    });
  }

  // 4. 마스킹 분석 요약
  console.log('='.repeat(80));
  console.log('마스킹 분석 요약');
  console.log('='.repeat(80));

  const maskedParties = parties.filter((p: CaseParty) => isMaskedPartyName(p.party_name));
  const unmaskedParties = parties.filter((p: CaseParty) => !isMaskedPartyName(p.party_name));

  console.log(`\n총 당사자: ${parties.length}명`);
  console.log(`  🔒 마스킹된 당사자: ${maskedParties.length}명`);
  console.log(`  ✅ 실명 당사자:     ${unmaskedParties.length}명`);

  if (maskedParties.length > 0) {
    console.log('\n🔒 마스킹된 당사자 목록:');
    maskedParties.forEach((p: CaseParty) => {
      console.log(`  - ${p.party_type_label || p.party_type}: "${p.party_name}"`);
      if (p.scourt_name_raw && !isMaskedPartyName(p.scourt_name_raw)) {
        console.log(`    ⚠️  scourt_name_raw에 실명이 있음: "${p.scourt_name_raw}"`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('디버깅 완료');
  console.log('='.repeat(80));
}

async function main() {
  const caseId = process.argv[2];

  if (!caseId) {
    console.error('❌ 사용법: npx tsx scripts/debug-party-masking.ts <case_id>');
    console.error('');
    console.error('예시:');
    console.error('  npx tsx scripts/debug-party-masking.ts e5ace803-7dad-4940-ac28-84bec91505bf');
    process.exit(1);
  }

  try {
    await debugPartyMasking(caseId);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

main().catch(console.error);
