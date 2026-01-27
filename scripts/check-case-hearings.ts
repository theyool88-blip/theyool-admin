import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== 사건별 기일 현황 ===\n");

  // 1. court_hearings에 있는 case_id 목록
  const { data: hearings, error: hError } = await supabase
    .from('court_hearings')
    .select('case_id, hearing_type, hearing_date, location')
    .order('hearing_date', { ascending: false });

  if (hError) {
    console.error("조회 에러:", hError.message);
    return;
  }

  // case_id별로 그룹화
  const caseMap = new Map<string, any[]>();
  hearings?.forEach(h => {
    if (!caseMap.has(h.case_id)) {
      caseMap.set(h.case_id, []);
    }
    caseMap.get(h.case_id)?.push(h);
  });

  console.log(`기일이 있는 사건 수: ${caseMap.size}개\n`);

  // 각 사건 정보 조회
  for (const [caseId, caseHearings] of caseMap) {
    const { data: legalCase } = await supabase
      .from('legal_cases')
      .select('case_name, court_case_number, court_name')
      .eq('id', caseId)
      .single();

    console.log(`📁 ${legalCase?.case_name || '(이름없음)'}`);
    console.log(`   사건번호: ${legalCase?.court_case_number || '-'}`);
    console.log(`   법원: ${legalCase?.court_name || '-'}`);
    console.log(`   case_id: ${caseId}`);
    console.log(`   기일 수: ${caseHearings.length}개`);
    caseHearings.slice(0, 3).forEach((h, i) => {
      console.log(`   [${i+1}] ${h.hearing_type} | ${h.hearing_date} | ${h.location || '-'}`);
    });
    console.log('');
  }

  // 2. 기일이 없는 SCOURT 연동 사건 확인
  console.log("\n=== SCOURT 연동되었지만 기일 없는 사건 ===\n");

  const { data: linkedCases } = await supabase
    .from('legal_cases')
    .select('id, case_name, court_case_number, court_name')
    .not('enc_cs_no', 'is', null)
    .limit(10);

  for (const lc of linkedCases || []) {
    const hasHearings = caseMap.has(lc.id);
    if (!hasHearings) {
      console.log(`⚠️ ${lc.case_name} (${lc.court_case_number}) - 기일 없음`);
    }
  }
}

run().catch(console.error);
