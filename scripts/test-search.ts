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
    .select("id, court_case_number")
    .not("enc_cs_no", "is", null)
    .single();

  if (!data) {
    console.log("Case not found");
    return;
  }

  console.log("Found case:", data.court_case_number, "ID:", data.id);

  // 사건번호 파싱
  const match = data.court_case_number?.match(/(\d{4})([가-힣]+)(\d+)/);
  if (!match) {
    console.log("Invalid case number format");
    return;
  }

  const [, caseYear, caseType, caseSerial] = match;
  console.log("Parsed:", { caseYear, caseType, caseSerial });

  const res = await fetch("http://localhost:3000/api/admin/scourt/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseYear,
      caseType,
      caseSerial,
      courtName: "평택가정",  // TODO: get from DB
      partyName: "김",
      legalCaseId: data.id,
    }),
  });

  const result = await res.json();
  console.log("Result:", JSON.stringify(result, null, 2));
}
run();
