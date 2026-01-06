import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // 1. court_hearings 직접 조회
  const { data: hearings, error: hErr } = await supabase
    .from('court_hearings')
    .select('id, hearing_type, hearing_date, case_id, status')
    .limit(5);

  console.log("=== court_hearings 직접 조회 ===");
  console.log("개수:", hearings?.length);
  if (hErr) console.log("에러:", hErr.message);
  hearings?.forEach(h => console.log(h));

  // 2. unified_calendar 뷰 조회
  const { data: calendar, error: cErr } = await supabase
    .from('unified_calendar')
    .select('*')
    .limit(10);

  console.log("\n=== unified_calendar 뷰 조회 ===");
  console.log("개수:", calendar?.length);
  if (cErr) console.log("에러:", cErr.message);
  calendar?.forEach(c => console.log(c.event_type, c.title, c.event_date));
}

run().catch(console.error);
