import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const caseId = "e5ace803-7dad-4940-ac28-84bec91505bf";

  // SCOURT 스냅샷 확인
  const { data: snapshot } = await supabase
    .from("scourt_case_snapshots")
    .select("basic_info")
    .eq("legal_case_id", caseId)
    .single();

  if (snapshot?.basic_info) {
    const basicInfo = snapshot.basic_info as any;
    console.log("=== SCOURT 스냅샷 당사자 ===");
    if (basicInfo.parties) {
      basicInfo.parties.forEach((p: any, i: number) => {
        console.log(`[${i+1}] ${p.btprDvsNm}: ${p.btprNm}`);
      });
    }
    console.log("\n=== SCOURT 스냅샷 대리인 ===");
    if (basicInfo.representatives) {
      basicInfo.representatives.forEach((r: any, i: number) => {
        console.log(`[${i+1}] ${r.agntDvsNm}: ${r.agntNm}`);
      });
    }
  } else {
    console.log("스냅샷 없음");
  }

  // legal_cases의 client 정보
  const { data: legalCase } = await supabase
    .from("legal_cases")
    .select("client_id, client_role, opponent_name, clients(name)")
    .eq("id", caseId)
    .single();

  console.log("\n=== legal_cases 기존 데이터 ===");
  console.log("client:", (legalCase?.clients as any)?.name);
  console.log("client_role:", legalCase?.client_role);
  console.log("opponent_name:", legalCase?.opponent_name);
}

run().catch(console.error);
