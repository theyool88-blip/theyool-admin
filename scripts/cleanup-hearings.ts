/**
 * court_hearings 테이블 정리 스크립트
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // 1. 현재 court_hearings 데이터 확인
  const { data: hearings, count } = await supabase
    .from("court_hearings")
    .select("*", { count: "exact" });

  console.log(`\n=== court_hearings 현재 상태 ===`);
  console.log(`총 ${count || 0}건의 기일 데이터가 있습니다.`);

  if (hearings && hearings.length > 0) {
    console.log("\n샘플 데이터 (최대 5건):");
    hearings.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.case_number || h.case_id} - ${h.hearing_type} - ${h.hearing_date}`);
    });
  }

  // 2. pending_calendar_events 확인
  const { count: pendingCount } = await supabase
    .from("pending_calendar_events")
    .select("*", { count: "exact" });

  console.log(`\n=== pending_calendar_events 현재 상태 ===`);
  console.log(`총 ${pendingCount || 0}건의 대기 이벤트가 있습니다.`);

  // 3. 삭제 실행 (확인 후)
  const args = process.argv.slice(2);
  if (args.includes("--delete")) {
    console.log("\n🗑️ 데이터 삭제 시작...");

    // court_hearings 삭제
    const { error: hearingsError } = await supabase
      .from("court_hearings")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // 모든 레코드 삭제

    if (hearingsError) {
      console.error("court_hearings 삭제 실패:", hearingsError);
    } else {
      console.log("✅ court_hearings 테이블 정리 완료");
    }

    // pending_calendar_events 삭제
    const { error: pendingError } = await supabase
      .from("pending_calendar_events")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (pendingError) {
      console.error("pending_calendar_events 삭제 실패:", pendingError);
    } else {
      console.log("✅ pending_calendar_events 테이블 정리 완료");
    }

    // 결과 확인
    const { count: newCount } = await supabase
      .from("court_hearings")
      .select("*", { count: "exact" });

    console.log(`\n삭제 후 court_hearings: ${newCount || 0}건`);
  } else {
    console.log("\n💡 실제 삭제하려면: npx tsx scripts/cleanup-hearings.ts --delete");
  }
}

run().catch(console.error);
