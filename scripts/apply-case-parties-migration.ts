/**
 * case_parties, case_representatives 테이블 마이그레이션
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as fs from "fs";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSQL(sql: string, description: string) {
  console.log(`\n[실행] ${description}`);
  const { data, error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    console.log(`  -> RPC 오류: ${error.message}`);
    return false;
  }
  console.log(`  -> 성공`);
  return true;
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .limit(1);

  if (error && error.code === "42P01") {
    return false;
  }
  return true;
}

async function run() {
  console.log("=== 다수 당사자 관리 시스템 마이그레이션 ===\n");

  // 1. case_parties 테이블 존재 확인
  const partiesExists = await checkTableExists("case_parties");
  console.log(`case_parties 테이블 존재: ${partiesExists}`);

  if (!partiesExists) {
    // case_parties 테이블 생성 (Supabase Dashboard에서 직접 실행 필요)
    console.log("\n[안내] 아래 SQL을 Supabase Dashboard > SQL Editor에서 실행해주세요:\n");
    const migrationSQL = fs.readFileSync(
      "/Users/hskim/luseed/supabase/migrations/20260107_case_parties.sql",
      "utf-8"
    );
    console.log(migrationSQL);
    return;
  }

  // 테이블이 이미 있으면 데이터 확인
  const { data: parties, error } = await supabase
    .from("case_parties")
    .select("*")
    .limit(5);

  console.log("\ncase_parties 테이블 샘플 데이터:", parties?.length || 0, "건");

  // representatives 테이블 확인
  const repsExists = await checkTableExists("case_representatives");
  console.log(`case_representatives 테이블 존재: ${repsExists}`);

  if (repsExists) {
    const { data: reps } = await supabase
      .from("case_representatives")
      .select("*")
      .limit(5);
    console.log("case_representatives 테이블 샘플 데이터:", reps?.length || 0, "건");
  }

  console.log("\n마이그레이션 확인 완료!");
}

run().catch(console.error);
