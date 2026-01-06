/**
 * scourt_hearing_hash 컬럼 추가 마이그레이션
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/theyool-admin/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== scourt_hearing_hash 컬럼 마이그레이션 ===\n");

  // 먼저 현재 테이블 구조 확인
  const { data: columns, error: colError } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'court_hearings'
      ORDER BY ordinal_position
    `,
  });

  if (colError) {
    console.log("exec_sql RPC가 없습니다. Supabase Dashboard에서 직접 실행해주세요.");
    console.log("\n실행할 SQL:");
    console.log(`
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS scourt_hearing_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_court_hearings_case_hash
ON court_hearings (case_id, scourt_hearing_hash)
WHERE scourt_hearing_hash IS NOT NULL;
    `);
    return;
  }

  console.log("현재 컬럼:", columns);
}

run().catch(console.error);
