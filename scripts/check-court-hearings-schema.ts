/**
 * court_hearings 테이블 스키마 확인 및 마이그레이션 SQL 출력
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== court_hearings 스키마 확인 ===\n");

  // 테이블 존재 확인
  const { data, error } = await supabase
    .from("court_hearings")
    .select("*")
    .limit(1);

  if (error) {
    console.log("court_hearings 테이블 조회 에러:", error.message);
    return;
  }

  console.log("✅ court_hearings 테이블 존재 확인됨\n");

  // scourt_hearing_hash 컬럼 체크 - insert 테스트
  const testData = {
    case_id: "00000000-0000-0000-0000-000000000000",
    hearing_type: "HEARING_MAIN",
    hearing_date: "2025-01-01T09:00:00+09:00",
    status: "SCHEDULED",
    source: "test",
    scourt_hearing_hash: "test_hash_12345",
  };

  const { error: insertError } = await supabase
    .from("court_hearings")
    .insert(testData);

  if (insertError?.message.includes("scourt_hearing_hash")) {
    console.log("❌ scourt_hearing_hash 컬럼이 없습니다.\n");
    console.log("▶▶▶ Supabase Dashboard SQL Editor에서 다음 SQL을 실행하세요:\n");
    console.log("=".repeat(60));
    console.log(`
-- court_hearings 테이블에 SCOURT 기일 해시 컬럼 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS scourt_hearing_hash TEXT;

-- 유니크 인덱스 생성 (case_id + hash 조합)
CREATE UNIQUE INDEX IF NOT EXISTS idx_court_hearings_case_hash
ON court_hearings (case_id, scourt_hearing_hash)
WHERE scourt_hearing_hash IS NOT NULL;

-- 주석
COMMENT ON COLUMN court_hearings.scourt_hearing_hash IS 'SCOURT 기일 중복 방지용 해시 (date|time|type SHA256)';
`);
    console.log("=".repeat(60));
    console.log("\n실행 후 이 스크립트를 다시 실행하여 확인하세요.");
  } else if (insertError) {
    // 다른 에러 (FK 제약 등) - 컬럼은 있음
    console.log("다른 에러 (FK 제약 등):", insertError.message);
    console.log("\n✅ scourt_hearing_hash 컬럼이 이미 존재합니다.");

    // 테스트 데이터 삭제
    await supabase
      .from("court_hearings")
      .delete()
      .eq("scourt_hearing_hash", "test_hash_12345");
  } else {
    console.log("✅ scourt_hearing_hash 컬럼이 이미 존재합니다.");

    // 테스트 데이터 삭제
    await supabase
      .from("court_hearings")
      .delete()
      .eq("scourt_hearing_hash", "test_hash_12345");
  }
}

run().catch(console.error);
