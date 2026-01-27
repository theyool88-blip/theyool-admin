/**
 * 대법원 API 테스트 - 일반내역/진행내역 반환 확인
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getScourtApiClient } from '../lib/scourt/api-client';
import { parseCaseNumber } from '../lib/scourt/case-number-utils';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TENANT_ID = '799ce69a-df47-454d-8355-90b981ecf32f';

async function test() {
  // 연동된 사건 하나 가져오기
  const { data: testCase } = await supabase
    .from('legal_cases')
    .select('court_case_number, court_name, scourt_enc_cs_no, primary_client_name')
    .eq('tenant_id', TENANT_ID)
    .not('scourt_enc_cs_no', 'is', null)
    .limit(1)
    .single();

  if (!testCase) {
    console.log('테스트할 사건이 없습니다');
    return;
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('       대법원 API 테스트');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('테스트 사건:', testCase.court_case_number);
  console.log('법원:', testCase.court_name);
  console.log('의뢰인:', testCase.primary_client_name);

  const parsed = parseCaseNumber(testCase.court_case_number);
  console.log('파싱 결과:', parsed);

  if (!parsed.valid) {
    console.log('사건번호 파싱 실패');
    return;
  }

  const apiClient = getScourtApiClient();

  console.log('\n대법원 API 호출 시작...\n');
  const result = await apiClient.searchAndRegisterCase({
    cortCd: testCase.court_name,
    csYr: parsed.year,
    csDvsCd: parsed.caseType,
    csSerial: parsed.serial,
    btprNm: testCase.primary_client_name || '테스트',
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('       결과');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('success:', result.success);
  console.log('encCsNo:', result.encCsNo ? result.encCsNo.substring(0, 30) + '...' : null);

  const hasGeneralData = result.generalData !== undefined && result.generalData !== null;
  const hasProgressData = result.progressData !== undefined && result.progressData !== null;

  console.log('generalData 있음:', hasGeneralData);
  console.log('progressData 있음:', hasProgressData);

  if (result.generalData) {
    const gd = result.generalData as { hearings?: unknown[]; parties?: unknown[]; documents?: unknown[] };
    console.log('\n일반내역:');
    console.log('  기일 수:', gd.hearings?.length || 0);
    console.log('  당사자 수:', gd.parties?.length || 0);
    console.log('  서류 수:', gd.documents?.length || 0);
  }

  if (result.progressData) {
    console.log('\n진행내역:');
    console.log('  진행내역 수:', result.progressData.length);
  }

  if (!hasGeneralData && !hasProgressData) {
    console.log('\n⚠️ 일반내역과 진행내역이 모두 없습니다!');
    console.log('   스냅샷이 저장되지 않는 원인입니다.');
  }
}

test().catch(console.error);
