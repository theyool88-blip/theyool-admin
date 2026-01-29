/**
 * SCOURT 당사자/대리인 동기화 모듈
 * SCOURT API에서 가져온 당사자/대리인 데이터를 case_parties 테이블에 저장
 * 대리인은 case_parties.representatives JSONB에 저장
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CaseGeneralData } from "./api-client";
import type {
  CaseParty,
  PartyRepresentative,
  PartyType,
} from "@/types/case-party";
import {
  isMaskedPartyName,
  mapScourtPartyType,
  normalizePartyNameForMatch,
  preservePrefix,
  getPartySide,
} from "@/types/case-party";
import { updatePartyDeadline } from "./deadline-auto-register";

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
  // NOTE: is_our_client, client_id, fee_allocation_amount 컬럼이 스키마에서 제거됨
  scourt_synced?: boolean;
  scourt_party_index?: number | null;
  manual_override?: boolean;
  is_primary?: boolean;
  adjdoc_rch_ymd?: string | null; // 판결도달일
}

/**
 * SCOURT 당사자 데이터를 case_parties 테이블에 동기화
 * 대리인은 case_parties.representatives JSONB에 저장
 */
export async function syncPartiesFromScourt(
  params: PartySyncParams
): Promise<PartySyncResult> {
  const { legalCaseId, tenantId, parties, representatives } = params;
  const supabase = createClient();

  let partiesUpserted = 0;
  let representativesUpserted = 0;

  try {
    const { data: existingParties } = await supabase
      .from("case_parties")
      .select("id, party_name, party_type, scourt_party_index, manual_override, is_primary, adjdoc_rch_ymd, representatives")
      .eq("case_id", legalCaseId);

    interface PartyRecord {
      id: string;
      party_name: string;
      party_type: PartyType;
      scourt_party_index?: number | null;
      manual_override?: boolean;
      is_primary?: boolean;
      adjdoc_rch_ymd?: string | null;
      representatives?: PartyRepresentative[];
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

    // 대리인 데이터를 JSONB 배열로 변환
    const representativesJsonb: PartyRepresentative[] = (representatives || []).map(rep => ({
      name: rep.agntNm,
      type_label: rep.agntDvsNm || null,
      law_firm: rep.jdafrCorpNm || null,
      is_our_firm: false, // 기본값, 사용자가 수동 설정
      scourt_synced: true,
    }));

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

        // 기존 대리인 보존 (is_our_firm 설정 유지)
        const existingReps = existingParty?.representatives || [];
        const mergedReps = mergeRepresentatives(existingReps, representativesJsonb);

        const partyData = {
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
          is_primary: isPrimary,
          adjdoc_rch_ymd: party.adjdocRchYmd || null,
          indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
          // 대리인 JSONB (첫 번째 당사자에만 저장)
          representatives: i === 0 ? mergedReps : (existingParty?.representatives || []),
        };

        let error;
        if (existingParty?.id) {
          // 기존 당사자 UPDATE
          const result = await supabase
            .from("case_parties")
            .update(partyData)
            .eq("id", existingParty.id);
          error = result.error;
        } else {
          // 새 당사자 INSERT
          const result = await supabase
            .from("case_parties")
            .insert(partyData);
          error = result.error;
        }

        if (error) {
          console.error(`당사자 ${existingParty ? 'update' : 'insert'} 오류 (${party.btprNm}):`, error.message);
        } else {
          partiesUpserted++;
        }
      }

      // 대리인 수 카운트 (첫 당사자에 저장된 대리인 기준)
      representativesUpserted = representativesJsonb.length;
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
 * 기존 대리인과 새 대리인 병합 (is_our_firm 설정 유지)
 */
function mergeRepresentatives(
  existing: PartyRepresentative[],
  incoming: PartyRepresentative[]
): PartyRepresentative[] {
  // 기존 대리인의 is_our_firm 설정을 키로 보관
  const existingOurFirmMap = new Map<string, boolean>();
  existing.forEach(rep => {
    const key = `${rep.type_label || ''}:${rep.name}`;
    existingOurFirmMap.set(key, rep.is_our_firm);
  });

  // 새 대리인에 기존 is_our_firm 설정 적용
  return incoming.map(rep => {
    const key = `${rep.type_label || ''}:${rep.name}`;
    return {
      ...rep,
      is_our_firm: existingOurFirmMap.get(key) || rep.is_our_firm,
    };
  });
}

/**
 * 서버 사이드용 당사자 동기화 (service role 사용)
 * - 기존 마이그레이션 데이터(scourt_synced=false)와 중복 방지
 * - 대리인은 case_parties.representatives JSONB에 저장
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
    manual_override?: boolean;
  }>();
  const legacyPartyIdsToDelete = new Set<string>();
  const existingByIndex = new Map<number, ExistingPartyRecord>();
  const primarySides = new Set<'plaintiff' | 'defendant'>();

  try {
    // 0. 기존 당사자 조회 (마이그레이션 + SCOURT 모두)
    const { data: existingParties } = await supabase
      .from("case_parties")
      .select("id, party_name, party_type, party_type_label, scourt_synced, scourt_party_index, manual_override, is_primary, scourt_label_raw, scourt_name_raw, adjdoc_rch_ymd, representatives")
      .eq("case_id", legalCaseId);

    // 판결도달일 변경 추적용
    const adjdocRchYmdChanges: Array<{
      partyId: string;
      oldValue: string | null;
      newValue: string;
    }> = [];

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

    // 대리인 데이터를 JSONB 배열로 변환
    const representativesJsonb: PartyRepresentative[] = (representatives || []).map(rep => ({
      name: rep.agntNm,
      type_label: rep.agntDvsNm || null,
      law_firm: rep.jdafrCorpNm || null,
      is_our_firm: false, // 기본값
      scourt_synced: true,
    }));

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

        let isPrimary = existingParty?.is_primary || false;
        if (!isPrimary && side && !primarySides.has(side)) {
          isPrimary = true;
          primarySides.add(side);
        }

        let manualOverride = existingParty?.manual_override || legacyOverride?.manual_override || false;
        if (!manualOverride && candidateName && !isMaskedPartyName(candidateName) && candidateName !== scourtName) {
          manualOverride = true;
        }

        // 판결도달일 변경 감지
        const newAdjdocRchYmd = party.adjdocRchYmd || null;
        const oldAdjdocRchYmd = existingParty?.adjdoc_rch_ymd || null;
        const adjdocRchYmdChanged = newAdjdocRchYmd !== null && newAdjdocRchYmd !== oldAdjdocRchYmd;

        // 기존 대리인 보존 (is_our_firm 설정 유지) - 첫 번째 당사자에만 저장
        const existingReps = (existingParty as ExistingPartyRecord & { representatives?: PartyRepresentative[] })?.representatives || [];
        const mergedReps = i === 0 ? mergeRepresentatives(existingReps, representativesJsonb) : existingReps;

        const partyData = {
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
          manual_override: manualOverride,
          is_primary: isPrimary,
          adjdoc_rch_ymd: newAdjdocRchYmd,
          indvd_cfmtn_ymd: party.indvdCfmtnYmd || null,
          // 대리인 JSONB
          representatives: mergedReps,
        };

        let resultPartyId: string | null = null;
        let error;

        if (existingParty?.id) {
          // 기존 당사자 UPDATE
          const result = await supabase
            .from("case_parties")
            .update(partyData)
            .eq("id", existingParty.id)
            .select('id')
            .single();
          error = result.error;
          resultPartyId = existingParty.id;
        } else {
          // 새 당사자 INSERT
          const result = await supabase
            .from("case_parties")
            .insert(partyData)
            .select('id')
            .single();
          error = result.error;
          resultPartyId = result.data?.id || null;
        }

        if (error) {
          console.error(`당사자 ${existingParty ? 'update' : 'insert'} 오류 (${party.btprNm}):`, error.message);
        } else {
          partiesUpserted++;

          // 판결도달일이 변경되었으면 기한 업데이트 예약
          if (adjdocRchYmdChanged && resultPartyId) {
            adjdocRchYmdChanges.push({
              partyId: resultPartyId,
              oldValue: oldAdjdocRchYmd,
              newValue: newAdjdocRchYmd,
            });
          }
        }
      }

      // 대리인 수 카운트
      representativesUpserted = representativesJsonb.length;

      // 판결도달일 변경된 당사자들의 기한 업데이트
      // 판결 결과(case_result)에 따라 항소 가능한 측에만 기한 생성
      for (const change of adjdocRchYmdChanges) {
        const result = await updatePartyDeadline(change.partyId, change.newValue, tenantId);
        if (result.error) {
          console.error(`기한 업데이트 오류 (${change.partyId}):`, result.error);
        } else if (result.filtered) {
          console.log(`  ⏭️ 항소 불가 당사자 - 기한 생성 스킵: ${change.partyId}`);
        } else if (result.created) {
          console.log(`  📅 당사자 기한 생성: ${change.partyId} (${change.newValue})`);
        } else if (result.updated) {
          console.log(`  📅 당사자 기한 업데이트: ${change.partyId} (${change.oldValue} → ${change.newValue})`);
        }
      }

      if (legacyPartyIdsToDelete.size > 0) {
        await supabase
          .from("case_parties")
          .delete()
          .in("id", Array.from(legacyPartyIdsToDelete));
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
 * 대리인은 각 당사자의 representatives JSONB 필드에 포함
 */
export async function getCaseParties(
  supabase: SupabaseClient,
  caseId: string
): Promise<{
  parties: CaseParty[];
}> {
  const { data: parties, error: partiesError } = await supabase
    .from("case_parties")
    .select("*")
    .eq("case_id", caseId)
    .order("party_type")
    .order("party_order");

  if (partiesError) {
    console.error("당사자 조회 오류:", partiesError.message);
  }

  return {
    parties: parties || [],
  };
}

/**
 * 당사자 이름 업데이트 (마스킹 해제)
 */
export async function updatePartyName(
  supabase: SupabaseClient,
  partyId: string,
  partyName: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("case_parties")
    .update({
      party_name: partyName,
      manual_override: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", partyId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
