import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticated } from "@/lib/auth/auth";
import type {
  CreateCasePartyRequest,
} from "@/types/case-party";

const PLAINTIFF_SIDE_TYPES = new Set([
  "plaintiff",
  "creditor",
  "applicant",
  "actor",
]);
const DEFENDANT_SIDE_TYPES = new Set([
  "defendant",
  "debtor",
  "respondent",
  "third_debtor",
  "accused",
  "juvenile",
]);

function getPartySide(partyType?: string | null): "plaintiff" | "defendant" | null {
  if (!partyType) return null;
  if (PLAINTIFF_SIDE_TYPES.has(partyType)) return "plaintiff";
  if (DEFENDANT_SIDE_TYPES.has(partyType)) return "defendant";
  return null;
}

const PARTY_UPDATE_FIELDS = [
  "party_name",
  "party_type",
  "party_type_label",
  "party_order",
  "client_id",
  "is_our_client",
  "is_primary",
  "fee_allocation_amount",
  "success_fee_terms",
  "notes",
];

function buildPartyUpdatePayload(updateData: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    manual_override: true,
    updated_at: new Date().toISOString(),
  };

  PARTY_UPDATE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updateData, field)) {
      payload[field] = updateData[field];
    }
  });

  return payload;
}

/**
 * GET /api/admin/cases/[id]/parties
 * 사건의 당사자/대리인 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const adminClient = createAdminClient();

    // 당사자 조회
    const { data: parties, error: partiesError } = await adminClient
      .from("case_parties")
      .select(
        `
        *,
        clients (
          id,
          name,
          phone,
          email
        )
      `
      )
      .eq("case_id", caseId)
      .order("party_type")
      .order("party_order");

    if (partiesError) {
      console.error("당사자 조회 오류:", partiesError);
      return NextResponse.json(
        { error: `당사자 조회 실패: ${partiesError.message}` },
        { status: 500 }
      );
    }

    // 대리인 조회
    const { data: representatives, error: repsError } = await adminClient
      .from("case_representatives")
      .select("*")
      .eq("case_id", caseId)
      .order("representative_type_label");

    if (repsError) {
      console.error("대리인 조회 오류:", repsError);
      return NextResponse.json(
        { error: `대리인 조회 실패: ${repsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      parties: parties || [],
      representatives: representatives || [],
    });
  } catch (error) {
    console.error("GET /api/admin/cases/[id]/parties 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cases/[id]/parties
 * 새 당사자 추가
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body: CreateCasePartyRequest = await request.json();
    const adminClient = createAdminClient();

    // 사건에서 tenant_id 조회
    const { data: legalCase, error: caseError } = await adminClient
      .from("legal_cases")
      .select("tenant_id")
      .eq("id", caseId)
      .single();

    if (caseError || !legalCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const tenantId = legalCase.tenant_id;

    // 당사자 추가
    const { data, error } = await adminClient
      .from("case_parties")
      .insert({
        tenant_id: tenantId,
        case_id: caseId,
        party_name: body.party_name,
        party_type: body.party_type,
        party_type_label: body.party_type_label || null,
        party_order: body.party_order || 1,
        client_id: body.client_id || null,
        is_our_client: body.is_our_client || false,
        is_primary: body.is_primary ?? false,
        fee_allocation_amount: body.fee_allocation_amount || null,
        notes: body.notes || null,
        scourt_synced: false,
        manual_override: true,
      })
      .select()
      .single();

    if (error) {
      console.error("당사자 추가 오류:", error);
      return NextResponse.json(
        { error: `당사자 추가 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("POST /api/admin/cases/[id]/parties 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/cases/[id]/parties
 * 당사자 또는 대리인 정보 수정
 * - partyId: 당사자 수정
 * - representativeId: 대리인 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();
    const { partyId, representativeId, partyUpdates, ...updateData } = body;

    const adminClient = createAdminClient();

    // 대리인 수정
    if (representativeId) {
      if (partyUpdates) {
        return NextResponse.json(
          { error: "partyUpdates and representativeId cannot be used together" },
          { status: 400 }
        );
      }
      const representativeUpdate: Record<string, unknown> = {
        manual_override: true,
      };

      if (Object.prototype.hasOwnProperty.call(updateData, "representative_name")) {
        representativeUpdate.representative_name = updateData.representative_name;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, "is_our_firm")) {
        representativeUpdate.is_our_firm = updateData.is_our_firm;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, "law_firm_name")) {
        representativeUpdate.law_firm_name = updateData.law_firm_name;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, "representative_type_label")) {
        representativeUpdate.representative_type_label = updateData.representative_type_label;
      }

      const { data, error } = await adminClient
        .from("case_representatives")
        .update(representativeUpdate)
        .eq("id", representativeId)
        .eq("case_id", caseId)
        .select()
        .single();

      if (error) {
        console.error("대리인 수정 오류:", error);
        return NextResponse.json(
          { error: `대리인 수정 실패: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data });
    }

    if (partyUpdates !== undefined) {
      if (!Array.isArray(partyUpdates) || partyUpdates.length === 0) {
        return NextResponse.json(
          { error: "partyUpdates must be a non-empty array" },
          { status: 400 }
        );
      }

      const partyIds = Array.from(new Set(
        partyUpdates
          .map((update: { partyId?: string }) => update.partyId)
          .filter((id: string | undefined): id is string => Boolean(id))
      ));

      if (partyIds.length === 0) {
        return NextResponse.json(
          { error: "partyUpdates requires partyId" },
          { status: 400 }
        );
      }

      const { data: existingParties, error: partiesError } = await adminClient
        .from("case_parties")
        .select("id, party_type")
        .eq("case_id", caseId)
        .in("id", partyIds);

      if (partiesError) {
        console.error("당사자 조회 오류:", partiesError);
        return NextResponse.json(
          { error: `당사자 조회 실패: ${partiesError.message}` },
          { status: 500 }
        );
      }

      const partyTypeById = new Map<string, string>();
      (existingParties || []).forEach((party: { id: string; party_type: string }) => {
        partyTypeById.set(party.id, party.party_type);
      });

      const primaryTargets = new Map<"plaintiff" | "defendant", string>();
      partyUpdates.forEach((update: { partyId?: string; party_type?: string; is_primary?: boolean }) => {
        if (!update.partyId || !update.is_primary) return;
        const partyType = update.party_type || partyTypeById.get(update.partyId) || null;
        const side = getPartySide(partyType);
        if (side) {
          primaryTargets.set(side, update.partyId);
        }
      });

      for (const update of partyUpdates) {
        if (!update?.partyId) continue;
        const payload = buildPartyUpdatePayload(update);
        const { data, error } = await adminClient
          .from("case_parties")
          .update(payload)
          .eq("id", update.partyId)
          .eq("case_id", caseId)
          .select("id, party_type")
          .single();

        if (error) {
          console.error("당사자 수정 오류:", error);
          return NextResponse.json(
            { error: `당사자 수정 실패: ${error.message}` },
            { status: 500 }
          );
        }

        const isOurClient = payload.is_our_client === true;
        const clientId = typeof payload.client_id === "string" ? payload.client_id : null;
        if (isOurClient) {
          const updatedPartyType = (payload.party_type as string) || data.party_type;
          const currentSide = getPartySide(updatedPartyType);

          // 반대측 의뢰인 해제 (같은 측은 복수 의뢰인 허용)
          if (currentSide) {
            const oppositeSideTypes = currentSide === "plaintiff"
              ? Array.from(DEFENDANT_SIDE_TYPES)
              : Array.from(PLAINTIFF_SIDE_TYPES);

            const { error: unsetError } = await adminClient
              .from("case_parties")
              .update({
                is_our_client: false,
                client_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq("case_id", caseId)
              .neq("id", update.partyId)
              .eq("is_our_client", true)
              .in("party_type", oppositeSideTypes);

            if (unsetError) {
              console.error("반대측 의뢰인 해제 오류:", unsetError);
            }
          }

          // legal_cases 동기화 (client_id 유무와 관계없이 client_role 업데이트)
          const { error: caseUpdateError } = await adminClient
            .from("legal_cases")
            .update({
              client_id: clientId,  // null이면 null로 설정
              client_role: updatedPartyType,
              updated_at: new Date().toISOString(),
            })
            .eq("id", caseId);

          if (caseUpdateError) {
            console.error("legal_cases 동기화 오류:", caseUpdateError);
          }
        }

        // 의뢰인 해제 시 legal_cases 동기화 (다른 의뢰인이 있으면 그 정보로, 없으면 null)
        if (payload.is_our_client === false) {
          const { data: otherClients } = await adminClient
            .from("case_parties")
            .select("client_id, party_type, is_primary")
            .eq("case_id", caseId)
            .eq("is_our_client", true)
            .neq("id", update.partyId)
            .order("is_primary", { ascending: false })
            .limit(1);

          if (otherClients && otherClients.length > 0) {
            const otherClient = otherClients[0];
            await adminClient
              .from("legal_cases")
              .update({
                client_id: otherClient.client_id,
                client_role: otherClient.party_type,
                updated_at: new Date().toISOString(),
              })
              .eq("id", caseId);
          } else {
            await adminClient
              .from("legal_cases")
              .update({
                client_id: null,
                client_role: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", caseId);
          }
        }
      }

      for (const [side, primaryId] of primaryTargets.entries()) {
        const sideTypes = side === "plaintiff"
          ? Array.from(PLAINTIFF_SIDE_TYPES)
          : Array.from(DEFENDANT_SIDE_TYPES);

        await adminClient
          .from("case_parties")
          .update({
            is_primary: false,
            updated_at: new Date().toISOString(),
          })
          .eq("case_id", caseId)
          .neq("id", primaryId)
          .in("party_type", sideTypes);

        await adminClient
          .from("case_parties")
          .update({
            is_primary: true,
            manual_override: true,
            updated_at: new Date().toISOString(),
          })
          .eq("case_id", caseId)
          .eq("id", primaryId);
      }

      // 업데이트된 당사자들 조회하여 반환 (낙관적 업데이트용)
      const { data: updatedParties } = await adminClient
        .from("case_parties")
        .select(`
          id, party_name, party_type, party_type_label, party_order,
          is_our_client, is_primary, manual_override, client_id,
          scourt_party_index, scourt_label_raw, scourt_name_raw,
          clients:client_id(id, name)
        `)
        .eq("case_id", caseId)
        .in("id", partyIds);

      return NextResponse.json({ success: true, updatedParties: updatedParties || [] });
    }

    // 당사자 수정
    if (!partyId) {
      return NextResponse.json(
        { error: "partyId or representativeId is required" },
        { status: 400 }
      );
    }

    const payload = buildPartyUpdatePayload(updateData);
    const { data, error } = await adminClient
      .from("case_parties")
      .update(payload)
      .eq("id", partyId)
      .eq("case_id", caseId)
      .select(`
        id, party_name, party_type, party_type_label, party_order,
        is_our_client, is_primary, manual_override, client_id,
        scourt_party_index, scourt_label_raw, scourt_name_raw,
        clients:client_id(id, name)
      `)
      .single();

    if (error) {
      console.error("당사자 수정 오류:", error);
      return NextResponse.json(
        { error: `당사자 수정 실패: ${error.message}` },
        { status: 500 }
      );
    }

    const isOurClient = payload.is_our_client === true;
    const clientId = typeof payload.client_id === "string" ? payload.client_id : null;
    if (isOurClient) {
      const updatedPartyType = (payload.party_type as string) || data.party_type;
      const currentSide = getPartySide(updatedPartyType);

      // 반대측 의뢰인 해제 (같은 측은 복수 의뢰인 허용)
      if (currentSide) {
        const oppositeSideTypes = currentSide === "plaintiff"
          ? Array.from(DEFENDANT_SIDE_TYPES)
          : Array.from(PLAINTIFF_SIDE_TYPES);

        const { error: unsetError } = await adminClient
          .from("case_parties")
          .update({
            is_our_client: false,
            client_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("case_id", caseId)
          .neq("id", partyId)
          .eq("is_our_client", true)
          .in("party_type", oppositeSideTypes);

        if (unsetError) {
          console.error("반대측 의뢰인 해제 오류:", unsetError);
        }
      }

      // legal_cases 동기화 (client_id 유무와 관계없이 client_role 업데이트)
      const { error: caseUpdateError } = await adminClient
        .from("legal_cases")
        .update({
          client_id: clientId,  // null이면 null로 설정
          client_role: updatedPartyType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId);

      if (caseUpdateError) {
        console.error("legal_cases 동기화 오류:", caseUpdateError);
      }
    }

    // 의뢰인 해제 시 legal_cases 동기화 (다른 의뢰인이 있으면 그 정보로, 없으면 null)
    if (payload.is_our_client === false) {
      // 다른 의뢰인 당사자 찾기 (is_primary 우선)
      const { data: otherClients } = await adminClient
        .from("case_parties")
        .select("client_id, party_type, is_primary")
        .eq("case_id", caseId)
        .eq("is_our_client", true)
        .neq("id", partyId)
        .order("is_primary", { ascending: false })
        .limit(1);

      if (otherClients && otherClients.length > 0) {
        // 다른 의뢰인이 있으면 그 정보로 업데이트
        const otherClient = otherClients[0];
        await adminClient
          .from("legal_cases")
          .update({
            client_id: otherClient.client_id,
            client_role: otherClient.party_type,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId);
      } else {
        // 다른 의뢰인이 없으면 null로 설정
        await adminClient
          .from("legal_cases")
          .update({
            client_id: null,
            client_role: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", caseId);
      }
    }

    if (payload.is_primary === true) {
      const updatedPartyType = (payload.party_type as string) || data.party_type;
      const side = getPartySide(updatedPartyType);
      if (side) {
        const sideTypes = side === "plaintiff"
          ? Array.from(PLAINTIFF_SIDE_TYPES)
          : Array.from(DEFENDANT_SIDE_TYPES);
        await adminClient
          .from("case_parties")
          .update({
            is_primary: false,
            updated_at: new Date().toISOString(),
          })
          .eq("case_id", caseId)
          .neq("id", partyId)
          .in("party_type", sideTypes);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("PATCH /api/admin/cases/[id]/parties 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cases/[id]/parties
 * 당사자 삭제 (partyId는 query param)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: caseId } = await params;
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId");

    if (!partyId) {
      return NextResponse.json(
        { error: "partyId is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 당사자 삭제
    const { error } = await adminClient
      .from("case_parties")
      .delete()
      .eq("id", partyId)
      .eq("case_id", caseId);

    if (error) {
      console.error("당사자 삭제 오류:", error);
      return NextResponse.json(
        { error: `당사자 삭제 실패: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/cases/[id]/parties 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
