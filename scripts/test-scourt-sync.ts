/**
 * SCOURT 사건 등록 테스트
 * - 동적 XML 추출 기능 검증
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 테스트할 사건 (민사 - ssgo101)
const TEST_CASE = {
  courtCode: "420100", // 서울중앙지방법원
  caseNumber: "2025가단109347",
  partyName: "강미자",
  legalCaseId: null as string | null,
};

async function main() {
  console.log("=== SCOURT 사건 등록 테스트 ===\n");

  // 1. 기존 사건 찾기 또는 생성
  console.log("1. 테스트 사건 찾기...");
  const { data: existingCase } = await supabase
    .from("legal_cases")
    .select("id, court_case_number, case_name")
    .eq("court_case_number", TEST_CASE.caseNumber)
    .single();

  if (existingCase) {
    TEST_CASE.legalCaseId = existingCase.id;
    console.log(`   ✅ 기존 사건 발견: ${existingCase.case_name}`);
  } else {
    // 새 사건 생성
    const { data: newCase, error } = await supabase
      .from("legal_cases")
      .insert({
        court_case_number: TEST_CASE.caseNumber,
        case_name: "테스트 - 행정신청",
        case_type: "civil",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("   ❌ 사건 생성 실패:", error);
      return;
    }
    TEST_CASE.legalCaseId = newCase.id;
    console.log(`   ✅ 새 사건 생성: ${newCase.id}`);
  }

  // 2. SCOURT sync API 호출
  console.log("\n2. SCOURT sync API 호출...");
  console.log(`   사건번호: ${TEST_CASE.caseNumber}`);
  console.log(`   법원코드: ${TEST_CASE.courtCode}`);

  // 당사자명 (첫 연동 시 필요)
  const partyName = TEST_CASE.partyName;

  const syncResponse = await fetch(
    "http://localhost:3000/api/admin/scourt/sync",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        legalCaseId: TEST_CASE.legalCaseId,
        courtCode: TEST_CASE.courtCode,
        caseNumber: TEST_CASE.caseNumber,
        partyName: partyName,
      }),
    }
  );

  const result = await syncResponse.json();

  if (!syncResponse.ok) {
    console.log("   ❌ API 응답 오류:", result);
    return;
  }

  console.log(
    "   ✅ API 응답:",
    JSON.stringify(result, null, 2).slice(0, 500)
  );

  // 3. XML 캐시 확인
  console.log("\n3. XML 캐시 확인...");
  const { data: xmlCache } = await supabase
    .from("scourt_xml_cache")
    .select("xml_path, case_type, created_at")
    .order("created_at", { ascending: false });

  const cacheCount = xmlCache ? xmlCache.length : 0;
  console.log(`   총 ${cacheCount}개 캐시된 XML:`);
  if (xmlCache) {
    xmlCache.forEach((x) => console.log(`   - ${x.xml_path} (${x.case_type})`));
  }

  console.log("\n🎉 테스트 완료!");
}

main().catch(console.error);
