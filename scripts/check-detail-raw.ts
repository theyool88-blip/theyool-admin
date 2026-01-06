/**
 * 저장된 사건의 상세 정보 조회 (raw API 응답 확인)
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getScourtApiClient } from '../lib/scourt/api-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const caseId = '5379a691-5755-4fd5-9b09-2044a18f97a6';  // 2025가소73623

  // 저장된 encCsNo 조회
  const { data: caseData } = await supabase
    .from('legal_cases')
    .select('enc_cs_no, scourt_wmonid, court_name, court_case_number')
    .eq('id', caseId)
    .single();

  console.log('=== 저장된 정보 ===');
  console.log('court_case_number:', caseData?.court_case_number);
  console.log('court_name:', caseData?.court_name);
  console.log('enc_cs_no:', caseData?.enc_cs_no?.substring(0, 30) + '...');
  console.log('scourt_wmonid:', caseData?.scourt_wmonid);

  if (!caseData?.enc_cs_no || !caseData?.scourt_wmonid) {
    console.log('\n❌ 저장된 encCsNo 또는 wmonid가 없습니다. 먼저 검색/동기화를 실행해주세요.');
    return;
  }

  // 상세 조회 시도
  console.log('\n=== 상세 조회 시도 ===');
  const apiClient = getScourtApiClient();

  const result = await apiClient.getCaseDetailWithStoredEncCsNo(
    caseData.scourt_wmonid,
    caseData.enc_cs_no,
    {
      cortCd: caseData.court_name || '수원지방법원 평택지원',
      csYear: '2025',
      csDvsCd: '가소',
      csSerial: '73623',
    }
  );

  if (result.success && result.data) {
    console.log('\n✅ 상세 조회 성공!');

    // raw 응답의 모든 필드 출력
    const raw = result.data.raw?.data;
    if (raw) {
      console.log('\n=== raw.data의 모든 키 ===');
      console.log(Object.keys(raw).join(', '));

      // dma_csBasCtt (기본정보)
      const basicInfo = raw.dma_csBasCtt || raw.dma_csBsCtt || raw.dma_gnrlCtt;
      if (basicInfo) {
        console.log('\n=== 기본정보 (dma_csBasCtt) 모든 필드 ===');
        Object.entries(basicInfo).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') {
            // 중요 필드 강조
            const kLower = k.toLowerCase();
            const isImportant = kLower.includes('ultmt') ||
                               kLower.includes('rslt') ||
                               kLower.includes('sov') ||
                               kLower.includes('amt') ||
                               kLower.includes('rcpt') ||
                               kLower.includes('prsrv');
            const prefix = isImportant ? '⭐ ' : '   ';
            console.log(prefix + k + ': ' + JSON.stringify(v));
          }
        });
      }
    }
  } else {
    console.log('\n❌ 상세 조회 실패:', result.error);
  }
}

main().catch(console.error);
