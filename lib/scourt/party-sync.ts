/**
 * SCOURT 당사자/대리인 동기화 모듈
 * SCOURT API에서 가져온 당사자/대리인 데이터를 case_parties, case_representatives 테이블에 저장
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CaseGeneralData } from "./api-client";
import type {
  CaseParty,
  CaseRepresentative,
  PartyType,
} from "@/types/case-party";
import {
  isMaskedPartyName,
  mapScourtPartyType,
  normalizePartyNameForMatch,
  preservePrefix,
} from "@/types/case-party";

// 의뢰인 정보를 이전하면 안 되는 당사자 유형 (사건본인, 제3자 등)
const NON_CLIENT_PARTY_LABELS = [
  '사건본인',
  '제3자',
  '제3채무자',
  '참가인',
  '보조참가인',
  '증인',
  '감정인',
];

/**
 * 비의뢰인 유형인지 확인 (사건본인, 제3자 등)
 */
function isNonClientPartyLabel(label: string): boolean {
  if (!label) return false;
  return NON_CLIENT_PARTY_LABELS.some(l => label.includes(l));
}

// 원고측 party_type
const PLAINTIFF_SIDE_TYPES: PartyType[] = ['plaintiff', 'creditor', 'applicant', 'actor'];
// 피고측 party_type
const DEFENDANT_SIDE_TYPES: PartyType[] = ['defendant', 'debtor', 'respondent', 'third_debtor', 'accused', 'juvenile'];

function getPartySide(partyType: PartyType): 'plaintiff' | 'defendant' | null {
  if (PLAINTIFF_SIDE_TYPES.includes(partyType)) return 'plaintiff';
  if (DEFENDANT_SIDE_TYPES.includes(partyType)) return 'defendant';
  return null;
}

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

interface ExistingPartyRecord {
  id: string;
  party_name: string;
  party_type: PartyType;
  party_type_label?: string | null;
  is_our_client?: boolean;
  client_id?: string | null;
  fee_allocation_amount?: number | null;
  scourt_synced?: boolean;
  scourt_party_index?: number | null;
  manual_override?: boolean;
  is_primary?: boolean;
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
  const manualRepresentativeKeys = new Set<string>();

  try {
    const { data: existingParties } = await supabase
      .from("case_parties")
      .select("id, party_name, party_type, is_our_client, client_id, scourt_party_index, manual_override, is_primary")
      .eq("case_id", legalCaseId);

    interface PartyRecord {
      id: string;
      party_name: string;
      party_type: PartyType;
      is_our_client?: boolean;
      client_id?: string | null;
      scourt_party_index?: number | null;
      manual_override?: boolean;
      is_primary?: boolean;
    }

    const partiesByIndex = new Map<number, PartyRecord>();
    const primarySides = new Set<'plaintiff' | 'defendant'>();
    (existingParties || []).forEach((party: PartyRecord) => {
      if (party.scourt_party_index !== null && party.scourt_party_index !== undefined) {
        partiesByIndex.set(party.scourt_party_index, party);
      }
      const side = getPartySide(party.party_type);
      if (party.is_primary && side) {
        primarySides.add(side);
      }
    });

    const { data: manualRepresentatives } = await supabase
      .from("case_representatives")
      .select("representative_type_label, representative_name")
      .eq("case_id", legalCaseId)
      .eq("manual_override", true);

    interface RepresentativeRecord { representative_type_label?: string; representative_name: string; }
    (manualRepresentatives || []).forEach((rep: RepresentativeRecord) => {
      manualRepresentativeKeys.add(`${rep.representative_type_label || ""}:${rep.representative_name}`);
    });

    // 1. 당사자 동기화
    if (parties && parties.length > 0) {
      for (let i = 0; i < parties.length; i++) {
        const party = parties[i];
        const partyType = mapScourtPartyType(party.btprDvsNm);
        const side = getPartySide(partyType);
        const existingParty = partiesByIndex.get(i);

        const scourtName = party.btprNm.trim();
        const scourtLabel = party.btprDvsNm?.trim() || null;

        const shouldPreserveName =
          (existingParty?.manual_override || false) ||
          (!!existingParty?.party_name && !isMaskedPartyName(existingParty.party_name));

        const resolvedName = shouldPreserveName && existingParty?.party_name
          ? existingParty.party_name
          : scourtName;

        let isPrimary = existingParty?.is_primary || false;
        if (!isPrimary && side && !primarySides.has(side)) {
          isPrimary = true;
          primarySides.add(side);
        }

        const { error } = await supabase.from("case_parties").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            party_name: resolvedName,
            party_type: partyType,
            party_type_label: scourtLabel,
            party_order: i + 1,
            scourt_synced: true,
            scourt_party_index: i,
            scourt_label_raw: scourtLabel,
            scourt_name_raw: scourtName,
            is_our_client: existingParty?.is_our_client || false,
            client_id: existingParty?.client_id || null,
            is_primary: isPrimary,
            adjdoc_rch_ymd: party.adjdocRchYmd || null,
            indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
          },
          {
            onConflict: "case_id,scourt_party_index",
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
        const repKey = `${rep.agntDvsNm || ""}:${rep.agntNm}`;
        if (manualRepresentativeKeys.has(repKey)) {
          continue;
        }

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
  supabase: SupabaseClient,
  params: PartySyncParams
): Promise<PartySyncResult> {
  const { legalCaseId, tenantId, parties, representatives } = params;

  let partiesUpserted = 0;
  let representativesUpserted = 0;
  const legacyOverridesByIndex = new Map<number, {
    party_name: string;
    is_our_client?: boolean;
    client_id?: string | null;
    fee_allocation_amount?: number | null;
    manual_override?: boolean;
  }>();
  const legacyPartyIdsToDelete = new Set<string>();
  const existingByIndex = new Map<number, ExistingPartyRecord>();
  const primarySides = new Set<'plaintiff' | 'defendant'>();
  const manualRepresentativeKeys = new Set<string>();

  try {
    // 0. 기존 당사자 조회 (마이그레이션 + SCOURT 모두)
    const { data: existingParties } = await supabase
      .from("case_parties")
      .select("id, party_name, party_type, party_type_label, is_our_client, client_id, fee_allocation_amount, scourt_synced, scourt_party_index, manual_override, is_primary, scourt_label_raw, scourt_name_raw")
      .eq("case_id", legalCaseId);

    const allExistingParties = (existingParties || []) as ExistingPartyRecord[];
    const existingMigrationParties = allExistingParties.filter(
      p => p.scourt_party_index === null || p.scourt_party_index === undefined
    );

    allExistingParties.forEach((party) => {
      if (party.scourt_party_index !== null && party.scourt_party_index !== undefined) {
        existingByIndex.set(party.scourt_party_index, party);
      }
      const side = getPartySide(party.party_type);
      if (party.is_primary && side) {
        primarySides.add(side);
      }
    });

    // 1. 당사자 동기화
    if (parties && parties.length > 0) {
      const scourtIndexBySideChar = new Map<string, number[]>();

      parties.forEach((party, index) => {
        const partyType = mapScourtPartyType(party.btprDvsNm);
        const side = getPartySide(partyType);
        const firstChar = normalizePartyNameForMatch(party.btprNm).charAt(0);
        if (!side || !firstChar) return;
        const key = `${side}:${firstChar}`;
        const existing = scourtIndexBySideChar.get(key) || [];
        existing.push(index);
        scourtIndexBySideChar.set(key, existing);
      });

      existingMigrationParties.forEach((migParty) => {
        if (!migParty.party_name) return;
        if (migParty.party_type_label && isNonClientPartyLabel(migParty.party_type_label)) return;

        const side = getPartySide(migParty.party_type);
        const firstChar = normalizePartyNameForMatch(migParty.party_name).charAt(0);
        if (!side || !firstChar) return;

        const key = `${side}:${firstChar}`;
        const candidates = scourtIndexBySideChar.get(key) || [];
        if (candidates.length !== 1) return;

        const targetIndex = candidates[0];
        if (legacyOverridesByIndex.has(targetIndex)) return;

        legacyOverridesByIndex.set(targetIndex, {
          party_name: migParty.party_name,
          is_our_client: migParty.is_our_client,
          client_id: migParty.client_id,
          fee_allocation_amount: migParty.fee_allocation_amount,
          manual_override: migParty.manual_override,
        });
        legacyPartyIdsToDelete.add(migParty.id);
      });

      for (let i = 0; i < parties.length; i++) {
        const party = parties[i];
        const partyType = mapScourtPartyType(party.btprDvsNm);
        const side = getPartySide(partyType);
        const scourtName = party.btprNm.trim();
        const scourtLabel = party.btprDvsNm?.trim() || null;

        const existingParty = existingByIndex.get(i);
        const legacyOverride = legacyOverridesByIndex.get(i);

        const candidateName = legacyOverride?.party_name || existingParty?.party_name || "";
        const shouldPreserveName =
          (legacyOverride?.manual_override || existingParty?.manual_override || false) ||
          (!!candidateName && !isMaskedPartyName(candidateName));

        const resolvedName = shouldPreserveName && candidateName
          ? preservePrefix(scourtName, candidateName)
          : scourtName;

        const isOurClient = legacyOverride?.is_our_client ?? existingParty?.is_our_client ?? false;
        const clientId = legacyOverride?.client_id ?? existingParty?.client_id ?? null;
        const feeAllocationAmount =
          legacyOverride?.fee_allocation_amount ?? existingParty?.fee_allocation_amount ?? null;

        let isPrimary = existingParty?.is_primary || false;
        if (!isPrimary && side && !primarySides.has(side)) {
          isPrimary = true;
          primarySides.add(side);
        }

        let manualOverride = existingParty?.manual_override || legacyOverride?.manual_override || false;
        if (!manualOverride && candidateName && !isMaskedPartyName(candidateName) && candidateName !== scourtName) {
          manualOverride = true;
        }

        const { error } = await supabase.from("case_parties").upsert(
          {
            tenant_id: tenantId,
            case_id: legalCaseId,
            party_name: resolvedName,
            party_type: partyType,
            party_type_label: scourtLabel,
            party_order: i + 1,
            scourt_synced: true,
            scourt_party_index: i,
            scourt_label_raw: scourtLabel,
            scourt_name_raw: scourtName,
            is_our_client: isOurClient,
            client_id: clientId,
            fee_allocation_amount: feeAllocationAmount,
            manual_override: manualOverride,
            is_primary: isPrimary,
            adjdoc_rch_ymd: party.adjdocRchYmd || null,
            indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
          },
          {
            onConflict: "case_id,scourt_party_index",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error(`당사자 upsert 오류 (${party.btprNm}):`, error.message);
        } else {
          partiesUpserted++;
        }
      }

      if (legacyPartyIdsToDelete.size > 0) {
        await supabase
          .from("case_parties")
          .delete()
          .in("id", Array.from(legacyPartyIdsToDelete));
      }
    }

    const { data: existingRepresentatives } = await supabase
      .from("case_representatives")
      .select("representative_type_label, representative_name, manual_override")
      .eq("case_id", legalCaseId);

    interface ExistingRep { representative_type_label?: string; representative_name: string; manual_override?: boolean; }
    (existingRepresentatives || []).forEach((rep: ExistingRep) => {
      if (!rep.manual_override) return;
      manualRepresentativeKeys.add(`${rep.representative_type_label || ""}:${rep.representative_name}`);
    });

    // 2. 대리인 동기화
    if (representatives && representatives.length > 0) {
      for (const rep of representatives) {
        const repKey = `${rep.agntDvsNm || ""}:${rep.agntNm}`;
        if (manualRepresentativeKeys.has(repKey)) {
          console.log(`  ✋ 수동 수정 대리인 보존: ${rep.agntNm} (${rep.agntDvsNm})`);
          continue;
        }

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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
