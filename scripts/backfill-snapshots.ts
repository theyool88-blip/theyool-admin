/**
 * 기존 SCOURT 연동 사건에 대해 스냅샷 일괄 생성
 * - scourt_enc_cs_no가 있는 사건 중 스냅샷이 없는 것 찾기
 * - 대법원 API 호출하여 일반내역/진행내역 가져오기
 * - 스냅샷 저장
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
const DELAY_MS = 2000; // API 호출 간 딜레이

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       SCOURT 스냅샷 일괄 생성');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. 스냅샷이 없는 연동 사건 조회
  const { data: cases, error: casesError } = await supabase
    .from('legal_cases')
    .select('id, court_case_number, court_name, scourt_enc_cs_no, primary_client_name')
    .eq('tenant_id', TENANT_ID)
    .not('scourt_enc_cs_no', 'is', null)
    .order('created_at', { ascending: false });

  if (casesError) {
    console.error('사건 조회 실패:', casesError.message);
    return;
  }

  console.log(`📋 SCOURT 연동된 사건: ${cases?.length || 0}건\n`);

  // 2. 각 사건별로 스냅샷 존재 여부 확인
  const casesWithoutSnapshot: typeof cases = [];

  for (const legalCase of cases || []) {
    const { data: snapshot } = await supabase
      .from('scourt_case_snapshots')
      .select('id')
      .eq('legal_case_id', legalCase.id)
      .single();

    if (!snapshot) {
      casesWithoutSnapshot.push(legalCase);
    }
  }

  console.log(`📸 스냅샷 없는 사건: ${casesWithoutSnapshot.length}건\n`);

  if (casesWithoutSnapshot.length === 0) {
    console.log('✅ 모든 사건에 스냅샷이 있습니다.');
    return;
  }

  // 3. 스냅샷 생성
  const apiClient = getScourtApiClient();
  let created = 0;
  let failed = 0;

  for (let i = 0; i < casesWithoutSnapshot.length; i++) {
    const legalCase = casesWithoutSnapshot[i];
    console.log(`[${i + 1}/${casesWithoutSnapshot.length}] ${legalCase.court_case_number}`);

    const parsed = parseCaseNumber(legalCase.court_case_number);
    if (!parsed.valid) {
      console.log('  ⚠️ 사건번호 파싱 실패');
      failed++;
      continue;
    }

    try {
      // 대법원 API 호출
      const result = await apiClient.searchAndRegisterCase({
        cortCd: legalCase.court_name,
        csYr: parsed.year,
        csDvsCd: parsed.caseType,
        csSerial: parsed.serial,
        btprNm: legalCase.primary_client_name || '테스트',
      });

      if (!result.success) {
        console.log('  ⚠️ API 실패:', result.error);
        failed++;
        await delay(DELAY_MS);
        continue;
      }

      type GeneralDataType = {
        hearings?: unknown[];
        lowerCourtCases?: Array<{
          userCsNo: string;
          cortNm?: string;
          ultmtDvsNm?: string;
          ultmtYmd?: string;
          encCsNo?: string;
        }>;
        relatedCases?: Array<{
          userCsNo: string;
          reltCsCortNm?: string;
          reltCsDvsNm?: string;
          encCsNo?: string;
        }>;
        documents?: unknown[];
      };

      const generalData = result.generalData as GeneralDataType | undefined;

      // 스냅샷 저장
      const snapshotData = {
        tenant_id: TENANT_ID,
        legal_case_id: legalCase.id,
        case_number: legalCase.court_case_number,
        court_code: legalCase.court_name,
        basic_info: generalData || {},
        hearings: generalData?.hearings || [],
        progress: result.progressData || [],
        documents: generalData?.documents || [],
        lower_court: (generalData?.lowerCourtCases || []).map(lc => ({
          caseNo: lc.userCsNo,
          courtName: lc.cortNm,
          result: lc.ultmtDvsNm,
          resultDate: lc.ultmtYmd,
          encCsNo: lc.encCsNo || null,
        })),
        related_cases: (generalData?.relatedCases || []).map(rc => ({
          caseNo: rc.userCsNo,
          caseName: rc.reltCsCortNm,
          relation: rc.reltCsDvsNm,
          encCsNo: rc.encCsNo || null,
        })),
      };

      const { error: insertError } = await supabase
        .from('scourt_case_snapshots')
        .insert(snapshotData);

      if (insertError) {
        console.log('  ❌ 저장 실패:', insertError.message);
        failed++;
      } else {
        const hearingCount = (generalData?.hearings?.length || 0);
        const progressCount = (result.progressData?.length || 0);
        console.log(`  ✅ 저장 완료 (기일: ${hearingCount}건, 진행: ${progressCount}건)`);
        created++;
      }

    } catch (err) {
      console.log('  ❌ 에러:', err instanceof Error ? err.message : err);
      failed++;
    }

    // API 호출 딜레이
    if (i < casesWithoutSnapshot.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ 생성: ${created}건`);
  console.log(`❌ 실패: ${failed}건`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
