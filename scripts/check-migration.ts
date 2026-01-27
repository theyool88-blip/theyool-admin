import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/hskim/luseed/.env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log("=== 마이그레이션 데이터 확인 ===\n");

  // 1. legal_cases에서 client_id 있는 사건 수
  const { data: cases, error: casesError } = await supabase
    .from("legal_cases")
    .select("id, client_id, client_role, opponent_name, retainer_fee, tenant_id, clients(name)")
    .not("client_id", "is", null);

  if (casesError) {
    console.log("legal_cases 조회 오류:", casesError.message);
    return;
  }

  console.log(`legal_cases with client_id: ${cases?.length || 0}건`);

  if (cases && cases.length > 0) {
    console.log("\n샘플 데이터:");
    cases.slice(0, 3).forEach((c: any, i: number) => {
      console.log(`  [${i + 1}] client_id: ${c.client_id}, client_role: ${c.client_role}, opponent: ${c.opponent_name}`);
    });
  }

  // 2. case_parties 테이블 현재 상태
  const { data: parties, error: partiesError } = await supabase
    .from("case_parties")
    .select("*");

  console.log(`\ncase_parties: ${parties?.length || 0}건`);

  // 3. 데이터 마이그레이션 수동 실행
  if (cases && cases.length > 0 && (!parties || parties.length === 0)) {
    console.log("\n[데이터 마이그레이션 시작]");

    for (const lc of cases) {
      const clientName = (lc.clients as any)?.name;
      if (!clientName) continue;

      const partyType = lc.client_role || "plaintiff";
      const partyTypeLabelMap: Record<string, string> = {
        plaintiff: "원고",
        defendant: "피고",
        creditor: "채권자",
        debtor: "채무자",
        applicant: "신청인",
        respondent: "피신청인",
      };
      const partyTypeLabel = partyTypeLabelMap[partyType] || "원고";

      // 의뢰인 추가
      const { error: insertError } = await supabase
        .from("case_parties")
        .upsert({
          tenant_id: lc.tenant_id,
          case_id: lc.id,
          party_name: clientName,
          party_type: partyType,
          party_type_label: partyTypeLabel,
          client_id: lc.client_id,
          is_our_client: true,
          fee_allocation_amount: lc.retainer_fee,
        }, {
          onConflict: "case_id,party_type,party_name"
        });

      if (insertError) {
        console.log(`  의뢰인 추가 오류 (${clientName}):`, insertError.message);
      } else {
        console.log(`  의뢰인 추가: ${clientName}`);
      }

      // 상대방 추가
      if (lc.opponent_name) {
        const oppTypeMap: Record<string, string> = {
          plaintiff: "defendant",
          defendant: "plaintiff",
          creditor: "debtor",
          debtor: "creditor",
          applicant: "respondent",
          respondent: "applicant",
        };
        const oppType = oppTypeMap[partyType] || "defendant";

        const oppLabelMap: Record<string, string> = {
          defendant: "피고",
          plaintiff: "원고",
          debtor: "채무자",
          creditor: "채권자",
          respondent: "피신청인",
          applicant: "신청인",
        };
        const oppLabel = oppLabelMap[oppType] || "피고";

        const { error: oppError } = await supabase
          .from("case_parties")
          .upsert({
            tenant_id: lc.tenant_id,
            case_id: lc.id,
            party_name: lc.opponent_name,
            party_type: oppType,
            party_type_label: oppLabel,
            is_our_client: false,
          }, {
            onConflict: "case_id,party_type,party_name"
          });

        if (oppError) {
          console.log(`  상대방 추가 오류 (${lc.opponent_name}):`, oppError.message);
        } else {
          console.log(`  상대방 추가: ${lc.opponent_name}`);
        }
      }
    }

    console.log("\n[마이그레이션 완료]");

    // 재확인
    const { data: partiesAfter } = await supabase.from("case_parties").select("*");
    console.log(`case_parties 최종: ${partiesAfter?.length || 0}건`);
  }
}

run().catch(console.error);
