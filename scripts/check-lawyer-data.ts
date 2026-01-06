import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // 1. tenant_members 조회
  const { data: members, error: mErr } = await supabase
    .from('tenant_members')
    .select('id, display_name, role')
    .limit(10);

  console.log("=== tenant_members ===");
  if (mErr) console.log("에러:", mErr.message);
  members?.forEach(m => console.log(m));

  // 2. court_hearings + attending_lawyer 조회
  const { data: hearings, error: hErr } = await supabase
    .from('court_hearings')
    .select(`
      id,
      hearing_type,
      attending_lawyer_id,
      legal_cases!inner(id, assigned_to, case_name)
    `)
    .limit(5);

  console.log("\n=== court_hearings (with case) ===");
  if (hErr) console.log("에러:", hErr.message);
  hearings?.forEach(h => console.log(JSON.stringify(h, null, 2)));

  // 3. unified_calendar 현재 상태
  const { data: calendar, error: cErr } = await supabase
    .from('unified_calendar')
    .select('*')
    .eq('event_type', 'COURT_HEARING')
    .limit(3);

  console.log("\n=== unified_calendar (COURT_HEARING) ===");
  if (cErr) console.log("에러:", cErr.message);
  calendar?.forEach(c => console.log(JSON.stringify(c, null, 2)));
}

run().catch(console.error);
