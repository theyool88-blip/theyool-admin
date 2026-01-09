/**
 * 모든 사건 삭제 스크립트
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// .env.local 로드
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // 1. SCOURT 연동된 사건 확인 (enc_cs_no가 있는 사건)
  console.log("=== SCOURT 연동 사건 (legal_cases) ===");
  const { data: linkedCases, error: linkedError } = await supabase
    .from("legal_cases")
    .select("id, court_case_number, case_name, enc_cs_no")
    .not("enc_cs_no", "is", null);

  if (linkedError) {
    console.error("사건 조회 오류:", linkedError);
    return;
  }

  console.log(`총 ${linkedCases?.length || 0}개 SCOURT 연동 사건:`);
  linkedCases?.forEach((c) => {
    console.log(`  - ${c.court_case_number}: ${c.case_name}`);
  });

  // 2. 스냅샷 확인
  console.log("\n=== 스냅샷 현황 ===");
  const { data: snapshots } = await supabase
    .from("scourt_case_snapshots")
    .select("id, case_id");
  console.log(`총 ${snapshots?.length || 0}개 스냅샷`);

  // 3. XML 캐시 확인
  console.log("\n=== XML 캐시 현황 ===");
  const { data: xmlCache } = await supabase
    .from("scourt_xml_cache")
    .select("xml_path, case_type");
  console.log(`총 ${xmlCache?.length || 0}개 캐시된 XML`);
  xmlCache?.forEach((x) => console.log(`  - ${x.xml_path}`));

  // 4. SCOURT 연동 해제 (enc_cs_no 제거)
  if (linkedCases && linkedCases.length > 0) {
    console.log("\n=== SCOURT 연동 해제 중 ===");
    const linkedIds = linkedCases.map((c) => c.id);

    // 스냅샷 삭제
    const { error: snapshotError } = await supabase
      .from("scourt_case_snapshots")
      .delete()
      .in("legal_case_id", linkedIds);

    if (snapshotError) {
      console.log("스냅샷 삭제:", snapshotError.message);
    } else {
      console.log("✅ 스냅샷 삭제 완료");
    }

    // enc_cs_no 제거 (연동 해제)
    const { error: updateError } = await supabase
      .from("legal_cases")
      .update({
        enc_cs_no: null,
        scourt_wmonid: null,
        scourt_last_sync: null,
        scourt_sync_status: null,
        scourt_raw_data: null,
        scourt_last_snapshot_id: null,
        scourt_unread_updates: null,
        scourt_next_hearing: null,
        scourt_case_name: null
      })
      .in("id", linkedIds);

    if (updateError) {
      console.log("연동 해제:", updateError.message);
    } else {
      console.log("✅ SCOURT 연동 해제 완료");
    }
  }

  // 5. XML 캐시 삭제 (새로 다운받기 위해)
  if (xmlCache && xmlCache.length > 0) {
    console.log("\n=== XML 캐시 삭제 중 ===");
    const { error: xmlDeleteError } = await supabase
      .from("scourt_xml_cache")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (xmlDeleteError) {
      console.log("XML 캐시 삭제:", xmlDeleteError.message);
    } else {
      console.log("✅ XML 캐시 삭제 완료");
    }
  }

  console.log("\n🎉 정리 완료. 테스트 사건을 등록하세요.");
}

main().catch(console.error);
