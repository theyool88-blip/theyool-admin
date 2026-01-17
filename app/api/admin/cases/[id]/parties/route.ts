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
  "is_primary",
  "representatives",  // JSONB field for representatives
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
 * 사건의 당사자/의뢰인 연결 목록 조회
 * 대리인은 각 당사자의 representatives JSONB에 포함
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

    // 당사자 조회 (대리인은 representatives JSONB에 포함)
    const { data: parties, error: partiesError } = await adminClient
      .from("case_parties")
      .select("*")
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

    // 의뢰인 연결 조회
    const { data: caseClients, error: clientsError } = await adminClient
      .from("case_clients")
      .select(`
        *,
        client:clients!client_id (
          id,
          name,
          phone,
          email
        ),
        linked_party:case_parties!linked_party_id (
          id,
          party_name,
          party_type,
          scourt_party_index
        )
      `)
      .eq("case_id", caseId)
      .order("is_primary_client", { ascending: false })
      .order("created_at");

    if (clientsError) {
      console.error("의뢰인 연결 조회 오류:", clientsError);
      return NextResponse.json(
        { error: `의뢰인 연결 조회 실패: ${clientsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      parties: parties || [],
      caseClients: caseClients || [],
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

    // 당사자 추가 (의뢰인 연결은 case_clients로 분리됨)
    const { data, error } = await adminClient
      .from("case_parties")
      .insert({
        tenant_id: tenantId,
        case_id: caseId,
        party_name: body.party_name,
        party_type: body.party_type,
        party_type_label: body.party_type_label || null,
        party_order: body.party_order || 1,
        is_primary: body.is_primary ?? false,
        representatives: body.representatives || [],
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
 * 당사자 정보 수정 (대리인은 representatives JSONB 필드로 관리)
 * - partyId: 당사자 수정
 * - partyUpdates: 여러 당사자 일괄 수정
 *
 * NOTE: 의뢰인 연결은 case_clients API를 통해 관리
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
    const { partyId, partyUpdates, ...updateData } = body;

    const adminClient = createAdminClient();

    // 여러 당사자 일괄 수정
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

      // is_primary 처리: 같은 측에서 한 명만 primary 가능
      const primaryTargets = new Map<"plaintiff" | "defendant", string>();
      partyUpdates.forEach((update: { partyId?: string; party_type?: string; is_primary?: boolean }) => {
        if (!update.partyId || !update.is_primary) return;
        const partyType = update.party_type || partyTypeById.get(update.partyId) || null;
        const side = getPartySide(partyType);
        if (side) {
          primaryTargets.set(side, update.partyId);
        }
      });

      // 각 당사자 업데이트
      for (const update of partyUpdates) {
        if (!update?.partyId) continue;
        const payload = buildPartyUpdatePayload(update);
        const { error } = await adminClient
          .from("case_parties")
          .update(payload)
          .eq("id", update.partyId)
          .eq("case_id", caseId);

        if (error) {
          console.error("당사자 수정 오류:", error);
          return NextResponse.json(
            { error: `당사자 수정 실패: ${error.message}` },
            { status: 500 }
          );
        }
      }

      // is_primary 처리: 같은 측의 다른 당사자는 is_primary=false
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

      // 업데이트된 당사자들 조회하여 반환
      const { data: updatedParties } = await adminClient
        .from("case_parties")
        .select("*")
        .eq("case_id", caseId)
        .in("id", partyIds);

      return NextResponse.json({ success: true, updatedParties: updatedParties || [] });
    }

    // 단일 당사자 수정
    if (!partyId) {
      return NextResponse.json(
        { error: "partyId is required" },
        { status: 400 }
      );
    }

    const payload = buildPartyUpdatePayload(updateData);
    const { data, error } = await adminClient
      .from("case_parties")
      .update(payload)
      .eq("id", partyId)
      .eq("case_id", caseId)
      .select("*")
      .single();

    if (error) {
      console.error("당사자 수정 오류:", error);
      return NextResponse.json(
        { error: `당사자 수정 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // is_primary 처리: 같은 측의 다른 당사자는 is_primary=false
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
