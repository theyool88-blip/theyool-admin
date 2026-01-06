import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/theyool-admin/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // enc_cs_no가 있는 사건 찾기
  const { data } = await supabase
    .from("legal_cases")
    .select("id, court_case_number, scourt_wmonid")
    .not("enc_cs_no", "is", null)
    .single();

  if (!data) {
    console.log("Case not found");
    return;
  }

  console.log("Syncing case:", data.court_case_number);
  console.log("Using wmonid:", data.scourt_wmonid);

  const res = await fetch("http://localhost:3000/api/admin/scourt/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      legalCaseId: data.id,
      caseNumber: data.court_case_number,
      forceRefresh: true,
    }),
  });

  const result = await res.json();
  console.log("Sync Result:", JSON.stringify(result, null, 2));
}
run();
