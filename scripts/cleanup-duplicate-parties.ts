import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const caseId = "e5ace803-7dad-4940-ac28-84bec91505bf";

  console.log("=== 중복 당사자 정리 ===\n");

  // 1. 현재 당사자 확인
  const { data: parties } = await supabase
    .from("case_parties")
    .select("id, party_name, party_type, party_type_label, is_our_client, client_id, scourt_synced")
    .eq("case_id", caseId);

  console.log("현재 당사자:");
  parties?.forEach((p, i) => {
    console.log(`  [${i+1}] ${p.party_type_label} (${p.party_type}): ${p.party_name} | scourt=${p.scourt_synced} | 의뢰인=${p.is_our_client}`);
  });

  // 2. 마이그레이션 당사자 (scourt_synced=false) 삭제
  const migrationParties = parties?.filter(p => !p.scourt_synced) || [];
  console.log(`\n삭제할 마이그레이션 당사자: ${migrationParties.length}건`);

  for (const p of migrationParties) {
    console.log(`  삭제: ${p.party_name} (ID: ${p.id})`);

    // 의뢰인 정보가 있으면 SCOURT 당사자에게 이전
    if (p.is_our_client && p.client_id) {
      // client 이름 조회
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", p.client_id)
        .single();

      if (client?.name) {
        const clientFirstChar = client.name.charAt(0);
        // SCOURT 당사자 중 첫글자가 같은 것 찾기
        const scourtParties = parties?.filter(sp => sp.scourt_synced) || [];
        for (const sp of scourtParties) {
          const spClean = sp.party_name.replace(/^\d+\.\s*/, "").trim();
          if (spClean.charAt(0) === clientFirstChar) {
            console.log(`    → 의뢰인 정보를 ${sp.party_name}에게 이전`);
            await supabase
              .from("case_parties")
              .update({
                is_our_client: true,
                client_id: p.client_id,
              })
              .eq("id", sp.id);
            break;
          }
        }
      }
    }

    // 삭제
    await supabase
      .from("case_parties")
      .delete()
      .eq("id", p.id);
  }

  // 3. 결과 확인
  console.log("\n=== 정리 후 당사자 ===");
  const { data: partiesAfter } = await supabase
    .from("case_parties")
    .select("id, party_name, party_type, party_type_label, is_our_client, scourt_synced")
    .eq("case_id", caseId);

  partiesAfter?.forEach((p, i) => {
    console.log(`  [${i+1}] ${p.party_type_label}: ${p.party_name} ${p.is_our_client ? '(의뢰인)' : ''}`);
  });
}

run().catch(console.error);
