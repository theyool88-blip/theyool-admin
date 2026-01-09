/**
 * SCOURT 당사자/대리인 동기화 모듈
 * SCOURT API에서 가져온 당사자/대리인 데이터를 case_parties, case_representatives 테이블에 저장
 */

import { createClient } from "@/lib/supabase/client";
import type { CaseGeneralData } from "./api-client";
import type {
  CaseParty,
  CaseRepresentative,
  PartyType,
  ScourtParty,
  ScourtRepresentative,
} from "@/types/case-party";
import { mapScourtPartyType, getPartyTypeLabel } from "@/types/case-party";

export interface PartySyncParams {
  legalCaseId: string;
  tenantId: string;
  parties: CaseGeneralData["parties"];
  representatives: CaseGeneralData["representatives"];
}

export interface PartySyncResult {
  success: boolean;
  partiesUpserted: number;
  representativesUpserted: number;
  error?: string;
}

/**
 * SCOURT 당사자 데이터를 case_parties 테이블에 동기화
 */
export async function syncPartiesFromScourt(
  params: PartySyncParams
): Promise<PartySyncResult> {
  const { legalCaseId, tenantId, parties, representatives } = params;
  const supabase = createClient();

  let partiesUpserted = 0;
  let representativesUpserted = 0;

  try {
    // 1. 당사자 동기화
    if (parties && parties.length > 0) {
      for (let i = 0; i < parties.length; i++) {
        const party = parties[i];
        const partyType = mapScourtPartyType(party.btprDvsNm);

        // 당사자명: SCOURT 원본 그대로 저장 (번호 포함)
        const partyName = party.btprNm.trim();

        const { error } = await supabase.from("case_parties").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            party_name: partyName,
            party_type: partyType,
            party_type_label: party.btprDvsNm,
            party_order: i + 1,
            scourt_synced: true,
            scourt_party_index: i,
            adjdoc_rch_ymd: party.adjdocRchYmd || null,
            indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
            // is_our_client는 유지 (사용자가 수동 설정)
          },
          {
            onConflict: "case_id,party_type,party_name",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(`당사자 upsert 오류 (${party.btprNm}):`, error.message);
        } else {
          partiesUpserted++;
        }
      }
    }

    // 2. 대리인 동기화
    if (representatives && representatives.length > 0) {
      for (const rep of representatives) {
        const { error } = await supabase.from("case_representatives").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            representative_name: rep.agntNm,
            representative_type_label: rep.agntDvsNm,
            law_firm_name: rep.jdafrCorpNm || null,
            scourt_synced: true,
            // is_our_firm는 유지 (사용자가 수동 설정)
          },
          {
            onConflict: "case_id,representative_type_label,representative_name",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(
            `대리인 upsert 오류 (${rep.agntNm}):`,
            error.message
          );
        } else {
          representativesUpserted++;
        }
      }
    }

    return {
      success: true,
      partiesUpserted,
      representativesUpserted,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("당사자 동기화 오류:", errorMessage);
    return {
      success: false,
      partiesUpserted,
      representativesUpserted,
      error: errorMessage,
    };
  }
}

/**
 * 서버 사이드용 당사자 동기화 (service role 사용)
 * - 기존 마이그레이션 데이터(scourt_synced=false)와 중복 방지
 * - 의뢰인 정보는 SCOURT 레코드로 이전 후 기존 레코드 삭제
 */
export async function syncPartiesFromScourtServer(
  supabase: any,
  params: PartySyncParams
): Promise<PartySyncResult> {
  const { legalCaseId, tenantId, parties, representatives } = params;

  let partiesUpserted = 0;
  let representativesUpserted = 0;

  try {
    // 0. 기존 당사자 조회 (마이그레이션 + SCOURT 모두)
    const { data: existingParties } = await supabase
      .from("case_parties")
      .select("id, party_name, party_type, party_type_label, is_our_client, client_id, fee_allocation_amount, scourt_synced")
      .eq("case_id", legalCaseId);

    // 마이그레이션 당사자만 필터
    const existingMigrationParties = existingParties?.filter((p: any) => !p.scourt_synced) || [];
    // 기존 SCOURT 당사자
    const existingScourtParties = existingParties?.filter((p: any) => p.scourt_synced) || [];

    // SCOURT 갱신 시, 기존 SCOURT 당사자 중 의뢰인 정보가 없는 것은 삭제 (깨끗하게 재동기화)
    if (parties && parties.length > 0 && existingScourtParties.length > 0) {
      for (const existingParty of existingScourtParties) {
        // 의뢰인 정보가 없으면 삭제
        if (!existingParty.is_our_client) {
          await supabase
            .from("case_parties")
            .delete()
            .eq("id", existingParty.id);
          console.log(`  🗑️ 기존 SCOURT 당사자 삭제 (재동기화): ${existingParty.party_name}`);
        }
      }
    }

    // 1. 당사자 동기화
    if (parties && parties.length > 0) {
      console.log(`👥 SCOURT 당사자 원본 데이터 (${parties.length}명):`);
      parties.forEach((p: any, idx: number) => {
        console.log(`  [${idx}] btprNm: "${p.btprNm}", btprDvsNm: "${p.btprDvsNm}"`);
      });

      for (let i = 0; i < parties.length; i++) {
        const party = parties[i];
        const partyType = mapScourtPartyType(party.btprDvsNm);
        console.log(`  → 저장 예정: "${party.btprNm}" (${party.btprDvsNm}) → party_type: ${partyType}, party_type_label: ${party.btprDvsNm}`);

        // 기존 마이그레이션 데이터에서 의뢰인 정보 찾기
        // 조건: 이름 첫 글자가 같으면 동일 인물로 간주 (party_type은 SCOURT가 정확하므로 비교하지 않음)
        let clientInfo: { is_our_client: boolean; client_id: string | null; fee_allocation_amount: number | null } | null = null;
        let migrationPartyToDelete: string | null = null;

        if (existingMigrationParties && existingMigrationParties.length > 0) {
          // SCOURT 이름에서 번호 제거 (예: "1. 정OO" -> "정OO")
          const scourtNameClean = party.btprNm.replace(/^\d+\.\s*/, "").trim();
          const scourtFirstChar = scourtNameClean.charAt(0);

          for (const migParty of existingMigrationParties) {
            // 이름 첫 글자가 같으면 동일 인물로 간주
            // (party_type은 마이그레이션 데이터가 틀릴 수 있으므로 비교하지 않음)
            const migFirstChar = migParty.party_name.charAt(0);
            if (migFirstChar === scourtFirstChar) {
              // 의뢰인 정보가 있으면 이전
              if (migParty.is_our_client) {
                clientInfo = {
                  is_our_client: migParty.is_our_client,
                  client_id: migParty.client_id,
                  fee_allocation_amount: migParty.fee_allocation_amount,
                };
                console.log(`  🔄 의뢰인 매칭: ${migParty.party_name}(${migParty.party_type}) → ${party.btprNm}(${party.btprDvsNm})`);
              }
              migrationPartyToDelete = migParty.id;
              console.log(`  🔄 마이그레이션 당사자 매칭: ${migParty.party_name} → ${party.btprNm}`);
              break;
            }
          }
        }

        // 기존 마이그레이션 레코드 삭제 (SCOURT 데이터로 대체)
        if (migrationPartyToDelete) {
          await supabase
            .from("case_parties")
            .delete()
            .eq("id", migrationPartyToDelete);
          console.log(`  🗑️ 마이그레이션 당사자 삭제: ${migrationPartyToDelete}`);
        }

        // 당사자명: SCOURT 원본 그대로 저장 (번호 포함 - 2명 이상일 때 구분용)
        const partyName = party.btprNm.trim();

        // SCOURT 당사자 upsert (의뢰인 정보 포함)
        const { error } = await supabase.from("case_parties").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            party_name: partyName,
            party_type: partyType,
            party_type_label: party.btprDvsNm,
            party_order: i + 1,
            scourt_synced: true,
            scourt_party_index: i,
            adjdoc_rch_ymd: party.adjdocRchYmd || null,
            indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
            // 의뢰인 정보 이전 (있는 경우)
            ...(clientInfo && {
              is_our_client: clientInfo.is_our_client,
              client_id: clientInfo.client_id,
              fee_allocation_amount: clientInfo.fee_allocation_amount,
            }),
          },
          {
            onConflict: "case_id,party_type,party_name",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(`당사자 upsert 오류 (${party.btprNm}):`, error.message);
        } else {
          partiesUpserted++;
        }
      }

      // 매칭되지 않은 마이그레이션 당사자 삭제
      // (SCOURT 데이터가 권위 있는 출처이므로, 중복/잘못된 마이그레이션 데이터 정리)
      if (existingMigrationParties && existingMigrationParties.length > 0) {
        // SCOURT 당사자 첫글자 목록 생성
        const scourtFirstChars = parties.map(p => {
          const clean = p.btprNm.replace(/^\d+\.\s*/, "").trim();
          return clean.charAt(0);
        });

        for (const migParty of existingMigrationParties) {
          const migFirstChar = migParty.party_name.charAt(0);
          // SCOURT 당사자 중 첫글자가 같은 것이 있으면 이미 처리됨
          // 없으면 잘못된/중복된 마이그레이션 데이터이므로 삭제
          const alreadyMatched = scourtFirstChars.includes(migFirstChar);
          if (!alreadyMatched) {
            // 의뢰인 정보가 있으면 가장 유사한 SCOURT 당사자에게 이전 시도
            if (migParty.is_our_client && migParty.client_id) {
              // client 테이블에서 이름 조회
              const { data: clientData } = await supabase
                .from("clients")
                .select("name")
                .eq("id", migParty.client_id)
                .single();

              if (clientData?.name) {
                const clientFirstChar = clientData.name.charAt(0);
                // SCOURT 당사자 중 첫글자가 같은 것 찾기
                for (let i = 0; i < parties.length; i++) {
                  const scourtClean = parties[i].btprNm.replace(/^\d+\.\s*/, "").trim();
                  if (scourtClean.charAt(0) === clientFirstChar) {
                    // 해당 SCOURT 당사자에게 의뢰인 정보 이전
                    await supabase
                      .from("case_parties")
                      .update({
                        is_our_client: true,
                        client_id: migParty.client_id,
                        fee_allocation_amount: migParty.fee_allocation_amount,
                      })
                      .eq("case_id", legalCaseId)
                      .eq("party_name", parties[i].btprNm);
                    console.log(`  🔄 의뢰인 정보 이전: ${clientData.name} → ${parties[i].btprNm}`);
                    break;
                  }
                }
              }
            }

            // 마이그레이션 당사자 삭제
            await supabase
              .from("case_parties")
              .delete()
              .eq("id", migParty.id);
            console.log(`  🗑️ 매칭 안된 마이그레이션 당사자 삭제: ${migParty.party_name}`);
          }
        }
      }
    }

    // 2. 대리인 동기화
    if (representatives && representatives.length > 0) {
      for (const rep of representatives) {
        const { error } = await supabase.from("case_representatives").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            representative_name: rep.agntNm,
            representative_type_label: rep.agntDvsNm,
            law_firm_name: rep.jdafrCorpNm || null,
            scourt_synced: true,
          },
          {
            onConflict: "case_id,representative_type_label,representative_name",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(
            `대리인 upsert 오류 (${rep.agntNm}):`,
            error.message
          );
        } else {
          representativesUpserted++;
        }
      }
    }

    return {
      success: true,
      partiesUpserted,
      representativesUpserted,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("당사자 동기화 오류:", errorMessage);
    return {
      success: false,
      partiesUpserted,
      representativesUpserted,
      error: errorMessage,
    };
  }
}

/**
 * 사건의 당사자 목록 조회
 */
export async function getCaseParties(
  supabase: any,
  caseId: string
): Promise<{
  parties: CaseParty[];
  representatives: CaseRepresentative[];
}> {
  const { data: parties, error: partiesError } = await supabase
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

  const { data: representatives, error: repsError } = await supabase
    .from("case_representatives")
    .select("*")
    .eq("case_id", caseId)
    .order("representative_type_label");

  if (partiesError) {
    console.error("당사자 조회 오류:", partiesError.message);
  }
  if (repsError) {
    console.error("대리인 조회 오류:", repsError.message);
  }

  return {
    parties: parties || [],
    representatives: representatives || [],
  };
}

/**
 * 의뢰인 당사자만 조회 (is_our_client = true)
 */
export async function getClientParties(
  supabase: any,
  caseId: string
): Promise<CaseParty[]> {
  const { data, error } = await supabase
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
    .eq("is_our_client", true)
    .order("party_order");

  if (error) {
    console.error("의뢰인 당사자 조회 오류:", error.message);
    return [];
  }

  return data || [];
}

/**
 * 당사자 의뢰인 상태 업데이트
 */
export async function updatePartyClientStatus(
  supabase: any,
  partyId: string,
  isOurClient: boolean,
  clientId: string | null,
  feeAllocationAmount: number | null
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("case_parties")
    .update({
      is_our_client: isOurClient,
      client_id: clientId,
      fee_allocation_amount: feeAllocationAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partyId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
