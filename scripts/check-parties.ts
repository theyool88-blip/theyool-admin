import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const caseId = "e5ace803-7dad-4940-ac28-84bec91505bf";

  const { data: parties, error } = await supabase
    .from("case_parties")
    .select("id, party_name, party_type, party_type_label, is_our_client")
    .eq("case_id", caseId)
    .order("party_type_label");

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log("=== case_parties 데이터 ===");
  if (parties) {
    parties.forEach((p, i) => {
      console.log(`[${i+1}] ${p.party_type_label} (${p.party_type}): ${p.party_name} ${p.is_our_client ? '(의뢰인)' : ''}`);
    });
    console.log(`\n총 ${parties.length}건`);
  }
}

run().catch(console.error);
