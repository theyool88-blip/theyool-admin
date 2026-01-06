/**
 * SCOURT 기일 동기화 테스트
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/theyool-admin/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== SCOURT 기일 동기화 테스트 ===\n");

  // 1. enc_cs_no가 있는 사건 조회
  const { data: cases, error: casesError } = await supabase
    .from("legal_cases")
    .select("id, court_case_number, enc_cs_no, scourt_wmonid, scourt_last_sync")
    .not("enc_cs_no", "is", null)
    .limit(1);

  if (casesError || !cases?.length) {
    console.log("enc_cs_no가 저장된 사건이 없습니다.");
    return;
  }

  const testCase = cases[0];
  console.log(`테스트 사건: ${testCase.court_case_number}`);
  console.log(`  - ID: ${testCase.id}`);
  console.log(`  - enc_cs_no: ${testCase.enc_cs_no?.substring(0, 30)}...`);
  console.log(`  - 마지막 동기화: ${testCase.scourt_last_sync || "없음"}`);

  // 2. 동기화 API 호출
  console.log("\n📡 SCOURT 동기화 API 호출...");
  const response = await fetch("http://localhost:3000/api/admin/scourt/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      legalCaseId: testCase.id,
      caseNumber: testCase.court_case_number,
      forceRefresh: true,
    }),
  });

  const result = await response.json();
  console.log("\n응답:", JSON.stringify(result, null, 2));

  // 3. court_hearings 테이블 확인
  console.log("\n=== court_hearings 테이블 확인 ===");
  const { data: hearings, count } = await supabase
    .from("court_hearings")
    .select("*", { count: "exact" })
    .eq("case_id", testCase.id);

  console.log(`해당 사건의 기일 수: ${count || 0}건`);
  if (hearings && hearings.length > 0) {
    hearings.forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.hearing_type} - ${h.hearing_date} - ${h.status}`);
    });
  }
}

run().catch(console.error);
