import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // SQL 파일 읽기
  const sql = fs.readFileSync(
    "supabase/migrations/20260106_create_unified_calendar.sql",
    "utf-8"
  );

  console.log("=== unified_calendar 뷰 업데이트 ===");

  // SQL 실행
  const { error } = await supabase.rpc('exec_sql', { query: sql });

  if (error) {
    console.error("RPC 에러:", error.message);

    // RPC가 없으면 직접 REST API로 시도
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
        },
        body: JSON.stringify({ query: sql })
      }
    );

    if (!res.ok) {
      console.log("REST API도 실패. SQL을 수동으로 실행해주세요.");
      console.log("\n=== 실행할 SQL ===\n");
      console.log(sql);
    }
  } else {
    console.log("성공!");
  }

  // 결과 확인
  console.log("\n=== 뷰 확인 ===");
  const { data, error: viewErr } = await supabase
    .from('unified_calendar')
    .select('id, event_type, title, attending_lawyer_id, attending_lawyer_name')
    .eq('event_type', 'COURT_HEARING')
    .limit(3);

  if (viewErr) {
    console.log("뷰 조회 에러:", viewErr.message);
  } else {
    data?.forEach(d => console.log(JSON.stringify(d, null, 2)));
  }
}

run().catch(console.error);
