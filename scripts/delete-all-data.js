const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAll() {
  console.log("=== 데이터 삭제 ===");

  // 순서대로 삭제
  await supabase.from("court_hearings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("case_parties").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("case_deadlines").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("consultations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("dismissed_related_cases").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // legal_cases 배치 삭제
  let deleted = 0;
  while (true) {
    const { data: cases } = await supabase.from("legal_cases").select("id").limit(100);
    if (!cases || cases.length === 0) break;
    const ids = cases.map(c => c.id);
    await supabase.from("legal_cases").delete().in("id", ids);
    deleted += ids.length;
  }
  console.log("사건 삭제:", deleted, "건");

  // clients 삭제
  const { error } = await supabase.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("의뢰인 삭제:", error?.message || "완료");

  // 확인
  const { count: c1 } = await supabase.from("legal_cases").select("*", { count: "exact", head: true });
  const { count: c2 } = await supabase.from("clients").select("*", { count: "exact", head: true });
  console.log("\n최종: 사건", c1, "건, 의뢰인", c2, "명");
}

deleteAll().catch(console.error);
