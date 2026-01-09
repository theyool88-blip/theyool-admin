import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthenticated } from "@/lib/auth/auth";
import type {
  CreateCasePartyRequest,
} from "@/types/case-party";

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
    const { partyId, representativeId, ...updateData } = body;

    const adminClient = createAdminClient();

    // 대리인 수정
    if (representativeId) {
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

    // 당사자 수정
    if (!partyId) {
      return NextResponse.json(
        { error: "partyId or representativeId is required" },
        { status: 400 }
      );
    }

    // 당사자 업데이트
    const { data, error } = await adminClient
      .from("case_parties")
      .update({
        ...updateData,
        manual_override: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partyId)
      .eq("case_id", caseId)
      .select()
      .single();

    if (error) {
      console.error("당사자 수정 오류:", error);
      return NextResponse.json(
        { error: `당사자 수정 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // 의뢰인으로 설정된 경우 legal_cases.client_id 및 client_role 동기화
    if (updateData.is_our_client && updateData.client_id) {
      const { error: caseUpdateError } = await adminClient
        .from("legal_cases")
        .update({
          client_id: updateData.client_id,
          client_role: data.party_type, // 당사자 타입 (plaintiff/defendant)
          updated_at: new Date().toISOString(),
        })
        .eq("id", caseId);

      if (caseUpdateError) {
        console.error("legal_cases 동기화 오류:", caseUpdateError);
        // 실패해도 당사자 업데이트는 성공으로 처리
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
