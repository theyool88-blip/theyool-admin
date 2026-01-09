const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteFakeCase() {
  // 허위 사건 찾기 (2004드단322322)
  const { data: cases, error: findError } = await supabase
    .from("legal_cases")
    .select("id, case_name, court_case_number, client_id")
    .ilike("court_case_number", "%322322%");

  if (findError) {
    console.error("검색 실패:", findError.message);
    return;
  }

  console.log("허위 사건 발견:", cases?.length || 0, "건");
  if (cases) {
    for (const c of cases) {
      console.log("  -", c.court_case_number, c.case_name, "(client_id:", c.client_id, ")");
    }
  }

  if (!cases || cases.length === 0) {
    console.log("삭제할 허위 사건 없음");
    return;
  }

  // 관련 데이터 삭제
  const caseIds = cases.map(c => c.id);

  await supabase.from("court_hearings").delete().in("legal_case_id", caseIds);
  await supabase.from("case_parties").delete().in("legal_case_id", caseIds);
  await supabase.from("case_deadlines").delete().in("legal_case_id", caseIds);
  await supabase.from("dismissed_related_cases").delete().in("legal_case_id", caseIds);

  // 사건 삭제
  const { error: deleteError } = await supabase
    .from("legal_cases")
    .delete()
    .in("id", caseIds);

  if (deleteError) {
    console.error("사건 삭제 실패:", deleteError.message);
  } else {
    console.log("✅ 허위 사건", caseIds.length, "건 삭제 완료");
  }

  // 연결된 의뢰인 확인 (다른 사건에 연결 안 된 경우만)
  const clientIds = cases.filter(c => c.client_id).map(c => c.client_id);
  if (clientIds.length > 0) {
    for (const clientId of clientIds) {
      const { count } = await supabase
        .from("legal_cases")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);

      if (count === 0) {
        const { error: clientError } = await supabase
          .from("clients")
          .delete()
          .eq("id", clientId);

        if (!clientError) {
          console.log("✅ 고아 의뢰인 삭제:", clientId);
        }
      }
    }
  }
}

deleteFakeCase().catch(console.error);
