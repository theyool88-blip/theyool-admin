/**
 * SCOURT 일반내용 XML 기반 렌더링 컴포넌트
 *
 * 100% XML 기반 동적 렌더링
 * - XML 레이아웃(layout.rows) 기반 테이블 렌더링
 * - API 응답의 dlt_* 데이터 리스트 자동 감지 & 렌더링
 * - 하드코딩 ZERO
 */

"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  parseWebSquareXml,
  parseGridXml,
  BasicInfoLayout,
  GridLayout,
} from "@/lib/scourt/xml-parser";
import {
  BasicInfoTable,
  GridTable,
  preprocessBasicInfo,
} from "@/lib/scourt/xml-renderer";
import { DLT_COLUMN_LABELS, DLT_TABLE_COLUMNS } from "@/lib/scourt/field-renderer";
import {
  CASE_TYPE_XML_MAP,
  ScourtCaseType,
  detectCaseTypeFromApiResponse,
  detectCaseTypeFromTemplateId,
  extractTemplateIdFromResponse,
  normalizeDataListId,
  resolveBasicInfoXmlPath,
  resolveDataListXmlPath,
  DATA_LIST_XML_CANDIDATES,
} from "@/lib/scourt/xml-mapping";
import { extractSubXmlPaths, normalizeDataListPaths } from "@/lib/scourt/xml-utils";
import { getPartyLabels as getPartyLabelsFromSchema } from "@/lib/scourt/party-labels";
import { normalizeCaseNumber } from "@/lib/scourt/case-number-utils";
import { normalizePartyLabel, PARTY_TYPE_LABELS } from "@/types/case-party";

// ============================================================================
// 타입 정의
// ============================================================================

interface ScourtGeneralInfoXmlProps {
  /** API 응답 데이터 (dma_csBasCtt, dlt_* 포함) */
  apiData: {
    dma_csBasCtt?: Record<string, any>;
    [key: string]: any;
  };
  /** 사건 유형 코드 (ssgo102, ssgo101, ssgo10g, ssgo106) */
  caseType?: ScourtCaseType;
  /** 사건번호 (당사자 라벨 판단용) */
  caseNumber?: string;
  /** 의뢰인명 (기본내용/당사자 반영) */
  clientName?: string | null;
  /** 상대방명 (기본내용/당사자 반영) */
  opponentName?: string | null;
  /** 의뢰인 역할 */
  clientRole?: "plaintiff" | "defendant" | null;
  /** 사용자 입력 당사자 목록 */
  partyOverrides?: PartyOverride[];
  /** 사용자 입력 대리인 목록 */
  representativeOverrides?: RepresentativeOverride[];
  /** 관련사건 링크 맵 (사건번호 -> caseId) */
  relatedCaseLinks?: Record<string, string>;
  /** 컴팩트 모드 (기본정보만 표시) */
  compact?: boolean;
}

interface DataListEntry {
  dataKey: string;
  layoutKey: string;
}

function getLayoutMatchScore(layout: GridLayout, dataRows: any[]): number {
  if (!layout?.columns?.length || !Array.isArray(dataRows) || dataRows.length === 0) {
    return 0;
  }

  const dataKeys = new Set<string>();
  dataRows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => dataKeys.add(key));
  });
  const columnIds = layout.columns.map((col) => col.id).filter(Boolean);
  if (columnIds.length === 0) return 0;

  const matches = columnIds.filter((id) => dataKeys.has(id)).length;
  return matches / columnIds.length;
}

async function pickBestCandidateLayout(
  dataListId: string,
  dataRows: any[],
  fetchXml: (xmlPath: string) => Promise<string | null>
): Promise<GridLayout | null> {
  if (!Array.isArray(dataRows) || dataRows.length === 0) return null;

  const candidates = DATA_LIST_XML_CANDIDATES[dataListId] || [];
  if (candidates.length === 0) return null;

  let bestLayout: GridLayout | null = null;
  let bestScore = 0;

  for (const xmlPath of candidates) {
    const xmlText = await fetchXml(xmlPath);
    if (!xmlText) continue;
    const layout = parseGridXml(xmlText);
    if (!layout) continue;

    const score = getLayoutMatchScore(layout, dataRows);
    if (score > bestScore) {
      bestLayout = layout;
      bestScore = score;
    }
  }

  return bestLayout;
}

// ============================================================================
// XML 로드 헬퍼 (DB 캐시 우선, 정적 파일 fallback)
// ============================================================================

const XML_BASE_PATH = "/scourt-xml";

function isInvalidXmlContent(xmlContent: string): boolean {
  const preview = xmlContent.trim().slice(0, 500).toLowerCase();
  const hasWebSquareMarkers =
    /<w2:|<xf:|<xforms:|<w2:dataMap|<dataMap|<w2:wframe/i.test(xmlContent);

  if (!hasWebSquareMarkers) {
    if (preview.startsWith("<!doctype html") || preview.includes("<html")) {
      return true;
    }
  }

  return !xmlContent.includes("<?xml") && !hasWebSquareMarkers;
}

async function fetchXmlWithFallback(
  xmlPath: string,
  caseType?: ScourtCaseType
): Promise<string | null> {
  const encodedPath = encodeURIComponent(xmlPath);
  // 1. DB 캐시에서 조회 시도
  try {
    const cacheResponse = await fetch(
      `/api/scourt/xml-cache?path=${encodedPath}`
    );
    let shouldRefresh = cacheResponse.status === 404;
    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json();
      if (cacheData.xml_content) {
        if (isInvalidXmlContent(cacheData.xml_content)) {
          console.warn(`[XML] Invalid cached XML, refreshing: ${xmlPath}`);
          shouldRefresh = true;
        } else {
          console.log(`[XML] Cache hit: ${xmlPath}`);
          return cacheData.xml_content;
        }
      }
    }
    if (shouldRefresh) {
      try {
        const downloadResponse = await fetch("/api/scourt/xml-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xmlPath, caseType, forceRefresh: true }),
        });

        if (downloadResponse.ok) {
          const retryResponse = await fetch(
            `/api/scourt/xml-cache?path=${encodedPath}`
          );
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.xml_content && !isInvalidXmlContent(retryData.xml_content)) {
              console.log(`[XML] Cache refreshed: ${xmlPath}`);
              return retryData.xml_content;
            }
          }
        }
      } catch (e) {
        console.warn(`[XML] Download failed for ${xmlPath}:`, e);
      }
    }
  } catch (e) {
    console.warn(`[XML] Cache lookup failed for ${xmlPath}:`, e);
  }

  // 2. Fallback: 정적 파일에서 로드
  try {
    const staticResponse = await fetch(`${XML_BASE_PATH}/${xmlPath}`);
    if (staticResponse.ok) {
      const staticText = await staticResponse.text();
      if (!isInvalidXmlContent(staticText)) {
        console.log(`[XML] Static file loaded: ${xmlPath}`);
        return staticText;
      }
      console.warn(`[XML] Invalid static XML: ${xmlPath}`);
    }
  } catch (e) {
    console.warn(`[XML] Static file not found: ${xmlPath}`);
  }

  return null;
}

type ClientRole = "plaintiff" | "defendant";

interface PartyOverride {
  party_name: string;
  party_type: string;
  party_type_label?: string | null;
  party_order?: number | null;
  is_our_client?: boolean | null;
}

interface RepresentativeOverride {
  representative_name: string;
  representative_type_label?: string | null;
  law_firm_name?: string | null;
  is_our_firm?: boolean | null;
}

const PARTY_NAME_FIELDS: Record<ClientRole, string[]> = {
  plaintiff: [
    "rprsClmntNm",
    "rprsPtnrNm",
    "rprsAplcntNm",
    "rprsGrnshNm",
    "aplNm",
    "clmntNm",
    "ptnrNm",
  ],
  defendant: [
    "rprsAcsdNm",
    "rprsRqstrNm",
    "rprsRspndnNm",
    "acsdNm",
    "rspNm",
    "rqstrNm",
    "dfndtNm",
    "btprtNm",
    "acsFullNm",
    "acsNm",
  ],
};

const LABEL_FIELD_FALLBACK: Record<string, string> = {
  원고: "rprsClmntNm",
  피고: "rprsAcsdNm",
  채권자: "rprsPtnrNm",
  채무자: "rprsRqstrNm",
  신청인: "rprsAplcntNm",
  피신청인: "rprsRspndnNm",
  항고인: "rprsAplcntNm",
  상대방: "rprsRspndnNm",
  항소인: "rprsClmntNm",
  피항소인: "rprsAcsdNm",
  상고인: "rprsClmntNm",
  피상고인: "rprsAcsdNm",
  피고인: "acsFullNm",
  제3채무자: "thrdDbtrNm",
  압류채권자: "rprsGrnshNm",
};

const COUNT_FIELD_BY_LABEL: Record<string, string> = {
  원고: "clmntCnt",
  피고: "acsdCnt",
  채권자: "ptnrCnt",
  채무자: "rqstrCnt",
  신청인: "ptnrCnt",
  피신청인: "rqstrCnt",
  항고인: "clmntCnt",
  상대방: "acsdCnt",
  항소인: "clmntCnt",
  피항소인: "acsdCnt",
  상고인: "clmntCnt",
  피상고인: "acsdCnt",
};

const PARTY_LIST_LABEL_FIELDS = [
  "btprtDvsNm",
  "btprtStndngNm",
  "btprtDvsCdNm",
  "btprtRltnCtt",
];

const PARTY_LIST_NAME_FIELDS = [
  "btprtNm",
  "btprtNmOrg",
  "acsFullNm",
  "acsdNm",
  "dfndtNm",
  "partyNm",
];

const PARTY_LABEL_ALIASES: Record<string, string[]> = {
  항고인: ["원고"],
  상대방: ["피고"],
  피고인: ["피고"],
  항소인: ["원고"],
  피항소인: ["피고"],
  상고인: ["원고"],
  피상고인: ["피고"],
};

const FALLBACK_CASE_NUMBER_PATTERN = /\d{4}\s*[가-힣]+\s*\d+/;
const FALLBACK_NORMALIZED_CASE_NUMBER_PATTERN = /^\d{4}[가-힣]+\d+$/;

function getPartyLabelsForCase(
  caseNumber?: string,
  basicInfoData?: Record<string, any>
): { plaintiffLabel: string; defendantLabel: string; isCriminal: boolean } {
  const source = caseNumber || basicInfoData?.userCsNo || "";
  const labels = getPartyLabelsFromSchema(source);
  const plaintiffLabel = labels.plaintiff || (labels.isCriminal ? "" : "원고");
  const defendantLabel = labels.defendant || (labels.isCriminal ? "피고인" : "피고");
  return { plaintiffLabel, defendantLabel, isCriminal: labels.isCriminal };
}

interface PartyOverrideGroup {
  label: string;
  displayLabel: string;
  names: string[];
  overrides: PartyOverride[];
}

interface RepresentativeOverrideGroup {
  label: string;
  displayLabel: string;
  names: string[];
  overrides: RepresentativeOverride[];
}

function resolvePartyOverrideLabel(party: PartyOverride): { label: string; displayLabel: string } | null {
  const rawLabel = (party.party_type_label || PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] || "").trim();
  const normalized = normalizePartyLabel(rawLabel);
  if (!normalized) return null;
  return { label: normalized, displayLabel: rawLabel || normalized };
}

function buildPartyOverrideGroups(parties?: PartyOverride[]): PartyOverrideGroup[] {
  if (!Array.isArray(parties) || parties.length === 0) return [];

  const groupMap = new Map<string, PartyOverrideGroup>();
  parties.forEach((party) => {
    const resolved = resolvePartyOverrideLabel(party);
    if (!resolved) return;
    if (!party.party_name || !party.party_name.trim()) return;

    const existing = groupMap.get(resolved.label);
    if (existing) {
      existing.overrides.push(party);
    } else {
      groupMap.set(resolved.label, {
        label: resolved.label,
        displayLabel: resolved.displayLabel,
        overrides: [party],
        names: [],
      });
    }
  });

  return Array.from(groupMap.values())
    .map((group) => {
      const sorted = [...group.overrides].sort((a, b) => {
        const aOrder = a.party_order ?? 9999;
        const bOrder = b.party_order ?? 9999;
        return aOrder - bOrder;
      });
      const names = sorted
        .map((party) => party.party_name.trim())
        .filter((name) => name);
      return { ...group, overrides: sorted, names };
    })
    .filter((group) => group.names.length > 0);
}

function formatRepresentativeName(rep: RepresentativeOverride): string {
  const name = rep.representative_name?.trim() || "";
  const firm = rep.law_firm_name?.trim() || "";
  if (firm && name) {
    return `${firm} (담당변호사 : ${name})`;
  }
  return name || firm;
}

function resolveRepresentativeLabel(
  rep: RepresentativeOverride
): { label: string; displayLabel: string } | null {
  const rawLabel = (rep.representative_type_label || "대리인").trim();
  const normalized = normalizePartyLabel(rawLabel);
  if (!normalized) return null;
  return { label: normalized, displayLabel: rawLabel || normalized };
}

function buildRepresentativeOverrideGroups(
  representatives?: RepresentativeOverride[]
): RepresentativeOverrideGroup[] {
  if (!Array.isArray(representatives) || representatives.length === 0) return [];

  const groupMap = new Map<string, RepresentativeOverrideGroup>();
  representatives.forEach((rep) => {
    const resolved = resolveRepresentativeLabel(rep);
    if (!resolved) return;
    const displayName = formatRepresentativeName(rep);
    if (!displayName) return;

    const existing = groupMap.get(resolved.label);
    if (existing) {
      existing.overrides.push(rep);
    } else {
      groupMap.set(resolved.label, {
        label: resolved.label,
        displayLabel: resolved.displayLabel,
        overrides: [rep],
        names: [],
      });
    }
  });

  return Array.from(groupMap.values())
    .map((group) => {
      const names = group.overrides
        .map((rep) => formatRepresentativeName(rep))
        .filter((name) => name);
      return { ...group, names };
    })
    .filter((group) => group.names.length > 0);
}

function getFirstFieldValue(data: Record<string, any>, fields: string[]): string {
  for (const field of fields) {
    const value = data[field];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function inferClientRole(
  data: Record<string, any> | null,
  clientName?: string | null,
  opponentName?: string | null
): ClientRole | null {
  if (!data || !clientName || !opponentName) return null;

  const clientInitial = clientName.trim().charAt(0);
  const opponentInitial = opponentName.trim().charAt(0);
  if (!clientInitial) return null;

  const plaintiffValue = getFirstFieldValue(data, PARTY_NAME_FIELDS.plaintiff);
  const defendantValue = getFirstFieldValue(data, PARTY_NAME_FIELDS.defendant);

  const clientMatchesPlaintiff = plaintiffValue.trim().startsWith(clientInitial);
  const clientMatchesDefendant = defendantValue.trim().startsWith(clientInitial);

  if (clientMatchesPlaintiff && !clientMatchesDefendant) return "plaintiff";
  if (clientMatchesDefendant && !clientMatchesPlaintiff) return "defendant";

  const opponentMatchesPlaintiff = opponentInitial
    ? plaintiffValue.trim().startsWith(opponentInitial)
    : false;
  const opponentMatchesDefendant = opponentInitial
    ? defendantValue.trim().startsWith(opponentInitial)
    : false;

  if (opponentMatchesPlaintiff && !opponentMatchesDefendant) return "defendant";
  if (opponentMatchesDefendant && !opponentMatchesPlaintiff) return "plaintiff";

  return null;
}

function resolveClientRole(
  clientRole: ClientRole | null | undefined,
  isCriminal: boolean,
  basicInfoData: Record<string, any> | null,
  clientName?: string | null,
  opponentName?: string | null
): ClientRole | null {
  if (clientRole) return clientRole;
  if (isCriminal) return "defendant";
  return inferClientRole(basicInfoData, clientName, opponentName);
}

function pickPartyField(
  data: Record<string, any>,
  side: ClientRole,
  label: string
): string | null {
  const candidates = PARTY_NAME_FIELDS[side];
  const existing = candidates.find((field) =>
    Object.prototype.hasOwnProperty.call(data, field)
  );
  if (existing) return existing;

  if (label && LABEL_FIELD_FALLBACK[label]) {
    return LABEL_FIELD_FALLBACK[label];
  }

  return candidates[0] || null;
}

function applyPartyNameOverride(
  data: Record<string, any>,
  side: ClientRole,
  name: string,
  label: string
): boolean {
  if (!name || !label) return false;
  const targetField = pickPartyField(data, side, label);
  if (!targetField) return false;
  if (data[targetField] === name) return false;
  data[targetField] = name;
  return true;
}

function applyPartyNameByLabel(
  data: Record<string, any>,
  label: string,
  name: string
): boolean {
  if (!label || !name) return false;
  const normalized = normalizePartyLabel(label);
  const targetField = LABEL_FIELD_FALLBACK[normalized];
  if (!targetField) return false;
  if (data[targetField] === name) return false;
  data[targetField] = name;
  return true;
}

function applyIndexedName(originalValue: any, name: string): string {
  if (typeof originalValue !== "string") return name;
  const match = originalValue.match(/^(\d+\.\s*)/);
  if (!match) return name;
  return `${match[1]}${name}`;
}

function updatePartyRowName(row: Record<string, any>, name: string): Record<string, any> {
  let updated = false;
  const next = { ...row };

  if ("btprtNm" in row) {
    next.btprtNm = applyIndexedName(row.btprtNm, name);
    updated = true;
  }

  if ("btprtNmOrg" in row) {
    next.btprtNmOrg = name;
    updated = true;
  }

  if (!updated) {
    const fallbackField = PARTY_LIST_NAME_FIELDS.find((field) =>
      Object.prototype.hasOwnProperty.call(row, field)
    );
    if (fallbackField) {
      next[fallbackField] = name;
      updated = true;
    }
  }

  return updated ? next : row;
}

function getPartyRowLabel(row: Record<string, any>): string {
  for (const field of PARTY_LIST_LABEL_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function updatePartyListRows(
  list: any[] | undefined,
  label: string,
  name: string
): any[] | undefined {
  if (!Array.isArray(list) || !label || !name) return list;
  const normalizedTarget = normalizePartyLabel(label);
  if (!normalizedTarget) return list;
  const aliasCandidates = PARTY_LABEL_ALIASES[normalizedTarget] || [];
  const candidateLabels = [normalizedTarget, ...aliasCandidates]
    .map((candidate) => normalizePartyLabel(candidate))
    .filter(Boolean);

  const matches = list
    .map((row, index) => ({
      row,
      index,
      label: normalizePartyLabel(getPartyRowLabel(row)),
    }))
    .filter((item) => {
      if (!item.label) return false;
      return candidateLabels.some((candidate) => {
        return (
          item.label === candidate ||
          item.label.includes(candidate) ||
          candidate.includes(item.label)
        );
      });
    });

  if (matches.length !== 1) return list;

  const { row, index } = matches[0];
  const updatedRow = updatePartyRowName(row, name);
  if (updatedRow === row) return list;

  return list.map((item, idx) => (idx === index ? updatedRow : item));
}

function updatePartyListRowsWithNames(
  list: any[],
  label: string,
  names: string[],
  displayLabel?: string
): { list: any[]; updated: boolean } {
  if (!Array.isArray(list) || !label) return { list, updated: false };
  const normalizedTarget = normalizePartyLabel(label);
  if (!normalizedTarget) return { list, updated: false };

  const trimmedNames = names
    .map((name) => name.trim())
    .filter((name) => name);
  if (trimmedNames.length === 0) return { list, updated: false };

  const aliasCandidates = PARTY_LABEL_ALIASES[normalizedTarget] || [];
  const candidateLabels = [normalizedTarget, ...aliasCandidates]
    .map((candidate) => normalizePartyLabel(candidate))
    .filter(Boolean);

  const matches = list
    .map((row, index) => ({
      row,
      index,
      label: normalizePartyLabel(getPartyRowLabel(row)),
    }))
    .filter((item) => {
      if (!item.label) return false;
      return candidateLabels.some((candidate) => {
        return (
          item.label === candidate ||
          item.label.includes(candidate) ||
          candidate.includes(item.label)
        );
      });
    });

  const next = [...list];
  let updated = false;

  const updateCount = Math.min(matches.length, trimmedNames.length);
  for (let i = 0; i < updateCount; i += 1) {
    const match = matches[i];
    const updatedRow = updatePartyRowName(match.row, trimmedNames[i]);
    if (updatedRow !== match.row) {
      next[match.index] = updatedRow;
      updated = true;
    }
  }

  if (trimmedNames.length > matches.length) {
    const labelValue = displayLabel || label;
    trimmedNames.slice(matches.length).forEach((name) => {
      next.push({
        btprtDvsNm: labelValue,
        btprtNm: name,
        btprtNmOrg: name,
      });
    });
    updated = true;
  }

  return { list: updated ? next : list, updated };
}

function applyPartyOverridesToList(
  list: any[] | undefined,
  groups: PartyOverrideGroup[]
): { list: any[] | undefined; updated: boolean } {
  if (!groups || groups.length === 0) return { list, updated: false };

  let next = Array.isArray(list) ? [...list] : [];
  let updated = false;

  groups.forEach((group) => {
    const result = updatePartyListRowsWithNames(
      next,
      group.label,
      group.names,
      group.displayLabel
    );
    if (result.updated) {
      next = result.list;
      updated = true;
    }
  });

  if (!Array.isArray(list) && next.length > 0) {
    updated = true;
  }

  return { list: updated ? next : list, updated };
}

const REPRESENTATIVE_LABEL_FIELDS = ["agntDvsNm", "agntDvsCdNm", "btprtRltnCtt"];
const REPRESENTATIVE_NAME_FIELDS = ["agntNm", "athrzNm", "representative_name"];

function getRepresentativeRowLabel(row: Record<string, any>): string {
  for (const field of REPRESENTATIVE_LABEL_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function updateRepresentativeRowName(row: Record<string, any>, name: string): Record<string, any> {
  const next = { ...row };
  let updated = false;

  if ("agntNm" in row) {
    next.agntNm = name;
    updated = true;
  } else {
    const fallbackField = REPRESENTATIVE_NAME_FIELDS.find((field) =>
      Object.prototype.hasOwnProperty.call(row, field)
    );
    if (fallbackField) {
      next[fallbackField] = name;
      updated = true;
    }
  }

  return updated ? next : row;
}

function updateRepresentativeListRowsWithNames(
  list: any[],
  label: string,
  displayLabel: string,
  names: string[]
): { list: any[]; updated: boolean } {
  if (!Array.isArray(list) || !label) return { list, updated: false };
  const normalizedTarget = normalizePartyLabel(label);
  if (!normalizedTarget) return { list, updated: false };

  const trimmedNames = names
    .map((name) => name.trim())
    .filter((name) => name);
  if (trimmedNames.length === 0) return { list, updated: false };

  const matches = list
    .map((row, index) => ({
      row,
      index,
      label: normalizePartyLabel(getRepresentativeRowLabel(row)),
    }))
    .filter((item) => {
      if (!item.label) return false;
      return (
        item.label === normalizedTarget ||
        item.label.includes(normalizedTarget) ||
        normalizedTarget.includes(item.label)
      );
    });

  const next = [...list];
  let updated = false;

  const updateCount = Math.min(matches.length, trimmedNames.length);
  for (let i = 0; i < updateCount; i += 1) {
    const match = matches[i];
    const updatedRow = updateRepresentativeRowName(match.row, trimmedNames[i]);
    if (updatedRow !== match.row) {
      next[match.index] = updatedRow;
      updated = true;
    }
  }

  if (trimmedNames.length > matches.length) {
    trimmedNames.slice(matches.length).forEach((name) => {
      next.push({
        agntDvsNm: displayLabel,
        agntNm: name,
      });
    });
    updated = true;
  }

  return { list: updated ? next : list, updated };
}

function applyRepresentativeOverridesToList(
  list: any[] | undefined,
  groups: RepresentativeOverrideGroup[]
): { list: any[] | undefined; updated: boolean } {
  if (!groups || groups.length === 0) return { list, updated: false };

  let next = Array.isArray(list) ? [...list] : [];
  let updated = false;

  groups.forEach((group) => {
    const result = updateRepresentativeListRowsWithNames(
      next,
      group.label,
      group.displayLabel,
      group.names
    );
    if (result.updated) {
      next = result.list;
      updated = true;
    }
  });

  if (!Array.isArray(list) && next.length > 0) {
    updated = true;
  }

  return { list: updated ? next : list, updated };
}

function getFallbackCaseLink(
  value: string,
  caseLinkMap?: Record<string, string>
): string | null {
  if (!caseLinkMap || !value) return null;
  const rawValue = String(value);
  const match = rawValue.match(FALLBACK_CASE_NUMBER_PATTERN);
  let normalized = "";

  if (match) {
    normalized = normalizeCaseNumber(match[0]);
  } else {
    const candidate = normalizeCaseNumber(rawValue);
    if (FALLBACK_NORMALIZED_CASE_NUMBER_PATTERN.test(candidate)) {
      normalized = candidate;
    }
  }

  if (!normalized) return null;
  const caseId = caseLinkMap[normalized] || caseLinkMap[match?.[0] ?? ""] || caseLinkMap[rawValue];
  return caseId ? `/cases/${caseId}` : null;
}

// ============================================================================
// 컴포넌트
// ============================================================================

export function ScourtGeneralInfoXml({
  apiData,
  caseType,
  caseNumber,
  clientName,
  opponentName,
  clientRole,
  partyOverrides,
  representativeOverrides,
  relatedCaseLinks,
  compact = false,
}: ScourtGeneralInfoXmlProps) {
  const apiEnvelope = useMemo(() => {
    if (!apiData) return {} as Record<string, any>;
    if (typeof apiData === "string") {
      try {
        const parsed = JSON.parse(apiData);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, any>;
        }
      } catch (e) {
        console.warn("[XML] Failed to parse apiData JSON string", e);
      }
      return {} as Record<string, any>;
    }
    return apiData as Record<string, any>;
  }, [apiData]);

  const resolvedApiData = useMemo(() => {
    const dataCandidate = (apiEnvelope as { data?: Record<string, any> }).data;
    if (dataCandidate && typeof dataCandidate === "object") {
      return dataCandidate;
    }
    const rawCandidate = (apiEnvelope as { raw?: { data?: Record<string, any> } }).raw?.data;
    if (rawCandidate && typeof rawCandidate === "object") {
      return rawCandidate;
    }
    return apiEnvelope as Record<string, any>;
  }, [apiEnvelope]);

  const [basicInfoLayout, setBasicInfoLayout] = useState<BasicInfoLayout | null>(null);
  const [gridLayouts, setGridLayouts] = useState<Record<string, GridLayout>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const templateId = useMemo(() => {
    return extractTemplateIdFromResponse(apiEnvelope);
  }, [apiEnvelope]);

  const caseTypeFromTemplate = useMemo(() => {
    return templateId ? detectCaseTypeFromTemplateId(templateId) : null;
  }, [templateId]);

  const resolvedCaseType = useMemo(() => {
    return (
      caseTypeFromTemplate ||
      detectCaseTypeFromApiResponse(resolvedApiData || {}) ||
      caseType ||
      "ssgo102"
    );
  }, [caseTypeFromTemplate, resolvedApiData, caseType]);

  const basicInfoKey = useMemo(() => {
    if (!resolvedApiData) return null;
    if (resolvedApiData.dma_csBasCtt) return "dma_csBasCtt";
    if (resolvedApiData.dma_csBsCtt) return "dma_csBsCtt";
    if (resolvedApiData.dma_gnrlCtt) return "dma_gnrlCtt";
    return null;
  }, [resolvedApiData]);

  const basicInfoData = useMemo(() => {
    if (!resolvedApiData || !basicInfoKey) return null;
    return resolvedApiData[basicInfoKey] || null;
  }, [resolvedApiData, basicInfoKey]);

  const normalizedClientName = clientName?.trim() || "";
  const normalizedOpponentName = opponentName?.trim() || "";

  const partyOverrideGroups = useMemo(() => {
    return buildPartyOverrideGroups(partyOverrides);
  }, [partyOverrides]);

  const representativeOverrideGroups = useMemo(() => {
    return buildRepresentativeOverrideGroups(representativeOverrides);
  }, [representativeOverrides]);

  const partyLabels = useMemo(() => {
    return getPartyLabelsForCase(caseNumber, basicInfoData || undefined);
  }, [caseNumber, basicInfoData]);

  const effectiveClientRole = useMemo(() => {
    return resolveClientRole(
      clientRole,
      partyLabels.isCriminal,
      basicInfoData,
      normalizedClientName,
      normalizedOpponentName
    );
  }, [
    clientRole,
    partyLabels.isCriminal,
    basicInfoData,
    normalizedClientName,
    normalizedOpponentName,
  ]);

  const overriddenBasicInfo = useMemo(() => {
    if (!basicInfoData) return basicInfoData;

    const next = { ...basicInfoData };
    let updated = false;
    const appliedLabels = new Set<string>();

    partyOverrideGroups.forEach((group) => {
      if (group.names.length === 0) return;
      const name = group.names[0];
      if (applyPartyNameByLabel(next, group.label, name)) {
        updated = true;
      }

      const countField = COUNT_FIELD_BY_LABEL[group.label];
      if (countField) {
        const nextCount = group.names.length;
        if (next[countField] !== nextCount) {
          next[countField] = nextCount;
          updated = true;
        }
      }

      appliedLabels.add(group.label);
    });

    if (effectiveClientRole && (normalizedClientName || normalizedOpponentName)) {
      const clientSide = effectiveClientRole;
      const opponentSide = clientSide === "plaintiff" ? "defendant" : "plaintiff";

      if (normalizedClientName) {
        const label = clientSide === "plaintiff"
          ? partyLabels.plaintiffLabel
          : partyLabels.defendantLabel;
        const normalizedLabel = normalizePartyLabel(label);
        if (!normalizedLabel || !appliedLabels.has(normalizedLabel)) {
          if (applyPartyNameOverride(next, clientSide, normalizedClientName, label)) {
            updated = true;
          }
        }
      }

      if (normalizedOpponentName) {
        const label = opponentSide === "plaintiff"
          ? partyLabels.plaintiffLabel
          : partyLabels.defendantLabel;
        const normalizedLabel = normalizePartyLabel(label);
        if (!normalizedLabel || !appliedLabels.has(normalizedLabel)) {
          if (applyPartyNameOverride(next, opponentSide, normalizedOpponentName, label)) {
            updated = true;
          }
        }
      }
    }

    return updated ? next : basicInfoData;
  }, [
    basicInfoData,
    partyOverrideGroups,
    normalizedClientName,
    normalizedOpponentName,
    effectiveClientRole,
    partyLabels.plaintiffLabel,
    partyLabels.defendantLabel,
  ]);

  const effectiveApiData = useMemo(() => {
    if (!resolvedApiData) return resolvedApiData;

    let updated = false;
    const next = { ...resolvedApiData };

    if (basicInfoKey && overriddenBasicInfo && overriddenBasicInfo !== basicInfoData) {
      next[basicInfoKey] = overriddenBasicInfo;
      updated = true;
    }

    const partyOverrideLabels = new Set(partyOverrideGroups.map((group) => group.label));

    if (partyOverrideGroups.length > 0) {
      const partiesResult = applyPartyOverridesToList(
        next.dlt_btprtCttLst,
        partyOverrideGroups
      );
      if (partiesResult.updated) {
        next.dlt_btprtCttLst = partiesResult.list;
        updated = true;
      }

      const accusedResult = applyPartyOverridesToList(
        next.dlt_acsCttLst,
        partyOverrideGroups
      );
      if (accusedResult.updated) {
        next.dlt_acsCttLst = accusedResult.list;
        updated = true;
      }
    }

    if ((normalizedClientName || normalizedOpponentName) && effectiveClientRole) {
      const clientSide = effectiveClientRole;
      const opponentSide = clientSide === "plaintiff" ? "defendant" : "plaintiff";
      const clientLabel = clientSide === "plaintiff"
        ? partyLabels.plaintiffLabel
        : partyLabels.defendantLabel;
      const opponentLabel = opponentSide === "plaintiff"
        ? partyLabels.plaintiffLabel
        : partyLabels.defendantLabel;
      const normalizedClientLabel = normalizePartyLabel(clientLabel);
      const normalizedOpponentLabel = normalizePartyLabel(opponentLabel);

      if (normalizedClientName && clientLabel && !partyOverrideLabels.has(normalizedClientLabel)) {
        const updatedParties = updatePartyListRows(
          next.dlt_btprtCttLst,
          clientLabel,
          normalizedClientName
        );
        const updatedAccused = updatePartyListRows(
          next.dlt_acsCttLst,
          clientLabel,
          normalizedClientName
        );
        if (updatedParties !== next.dlt_btprtCttLst) {
          next.dlt_btprtCttLst = updatedParties;
          updated = true;
        }
        if (updatedAccused !== next.dlt_acsCttLst) {
          next.dlt_acsCttLst = updatedAccused;
          updated = true;
        }
      }

      if (normalizedOpponentName && opponentLabel && !partyOverrideLabels.has(normalizedOpponentLabel)) {
        const updatedParties = updatePartyListRows(
          next.dlt_btprtCttLst,
          opponentLabel,
          normalizedOpponentName
        );
        const updatedAccused = updatePartyListRows(
          next.dlt_acsCttLst,
          opponentLabel,
          normalizedOpponentName
        );
        if (updatedParties !== next.dlt_btprtCttLst) {
          next.dlt_btprtCttLst = updatedParties;
          updated = true;
        }
        if (updatedAccused !== next.dlt_acsCttLst) {
          next.dlt_acsCttLst = updatedAccused;
          updated = true;
        }
      }
    }

    if (representativeOverrideGroups.length > 0) {
      const repsResult = applyRepresentativeOverridesToList(
        next.dlt_agntCttLst,
        representativeOverrideGroups
      );
      if (repsResult.updated) {
        next.dlt_agntCttLst = repsResult.list;
        updated = true;
      }
    }

    return updated ? next : resolvedApiData;
  }, [
    resolvedApiData,
    basicInfoKey,
    overriddenBasicInfo,
    basicInfoData,
    partyOverrideGroups,
    representativeOverrideGroups,
    normalizedClientName,
    normalizedOpponentName,
    effectiveClientRole,
    partyLabels.plaintiffLabel,
    partyLabels.defendantLabel,
  ]);

  // API 응답에서 dlt_* 데이터 리스트 동적 감지 (alias 정규화 포함)
  const dataListEntries = useMemo<DataListEntry[]>(() => {
    const sourceData = effectiveApiData || resolvedApiData;
    if (!sourceData) return [];
    const keys = Object.keys(sourceData).filter(
      (key) => key.startsWith("dlt_") && Array.isArray(sourceData[key]) && sourceData[key].length > 0
    );

    if (keys.length === 0) return [];

    const keySet = new Set(keys);

    return keys.reduce<DataListEntry[]>((entries, key) => {
      const normalizedKey = normalizeDataListId(key);

      // 표준 key가 이미 있으면 alias는 스킵
      if (normalizedKey !== key && keySet.has(normalizedKey)) {
        return entries;
      }

      entries.push({ dataKey: key, layoutKey: normalizedKey });
      return entries;
    }, []);
  }, [effectiveApiData, resolvedApiData]);

  // XML 파일 로드 및 파싱
  useEffect(() => {
    async function loadXml() {
      setLoading(true);
      setError(null);

      try {
        const mapping = CASE_TYPE_XML_MAP[resolvedCaseType];
        if (!mapping) {
          throw new Error(`Unknown case type: ${resolvedCaseType}`);
        }

        const dataSource = effectiveApiData || resolvedApiData;

        // 1. 기본정보 XML 로드 (API 응답의 템플릿 ID 우선)
        const basicXmlPath = resolveBasicInfoXmlPath({
          caseType: resolvedCaseType,
          apiResponse: apiEnvelope as Record<string, unknown>,
        });
        if (!basicXmlPath) {
          throw new Error(`No basic_info XML mapping for case type: ${resolvedCaseType}`);
        }
        let basicXmlText = await fetchXmlWithFallback(basicXmlPath, resolvedCaseType);
        if (!basicXmlText && mapping.basic_info && mapping.basic_info !== basicXmlPath) {
          console.warn(`[XML] Basic info fallback: ${basicXmlPath} → ${mapping.basic_info}`);
          basicXmlText = await fetchXmlWithFallback(mapping.basic_info, resolvedCaseType);
        }

        // 동적 XML 경로 추출 (기본정보 XML에서 .setSrc() 파싱)
        let dynamicPaths: Record<string, string> = {};
        const gridLayoutsTemp: Record<string, GridLayout> = {};

        if (basicXmlText) {
          const parsed = parseWebSquareXml(basicXmlText);
          setBasicInfoLayout(parsed.basicInfo);
          dynamicPaths = normalizeDataListPaths(extractSubXmlPaths(basicXmlText));
          console.log("[XML Render] Dynamic paths:", Object.keys(dynamicPaths));

          // 기본정보 XML 내 gridView 레이아웃도 활용 (mapping 누락 대비)
          for (const [gridId, layout] of Object.entries(parsed.grids || {})) {
            const normalizedId = normalizeDataListId(gridId);
            gridLayoutsTemp[normalizedId] = {
              ...layout,
              dataListId: normalizedId,
            };
          }
        }

        // 2. 각 dlt_* 데이터 리스트에 대해 해당 XML 로드
        for (const entry of dataListEntries) {
          const listData = dataSource?.[entry.dataKey];
          // 동적 추출 경로 우선, 없으면 하드코딩 매핑 fallback
          const xmlPath = resolveDataListXmlPath({
            caseType: resolvedCaseType,
            dataListId: entry.layoutKey,
            apiData: dataSource || {},
            dynamicPaths,
          });
          let resolvedLayout: GridLayout | null = null;

          if (xmlPath) {
            try {
              const gridXmlText = await fetchXmlWithFallback(xmlPath, resolvedCaseType);
              if (gridXmlText) {
                const gridLayout = parseGridXml(gridXmlText);
                if (gridLayout) {
                  resolvedLayout = gridLayout;
                }
              }
            } catch (e) {
              console.warn(`[XML] Grid XML load failed: ${xmlPath}`, e);
            }
          }

          const matchScore = resolvedLayout
            ? getLayoutMatchScore(resolvedLayout, Array.isArray(listData) ? listData : [])
            : 0;

          if (!resolvedLayout || matchScore < 0.4) {
            const fallbackLayout = await pickBestCandidateLayout(
              entry.layoutKey,
              Array.isArray(listData) ? listData : [],
              (path) => fetchXmlWithFallback(path, resolvedCaseType)
            );

            if (fallbackLayout) {
              resolvedLayout = fallbackLayout;
            }
          }

          if (!resolvedLayout) {
            if (!gridLayoutsTemp[entry.layoutKey]) {
              console.warn(`[XML] No mapping for data list: ${entry.layoutKey}`);
            }
            continue;
          }

          // 타이틀이 없으면 dataListId로 대체
          if (!resolvedLayout.title) {
            resolvedLayout.title = getDataListTitle(entry.layoutKey);
          }
          resolvedLayout.dataListId = entry.layoutKey;
          gridLayoutsTemp[entry.layoutKey] = resolvedLayout;
        }

        setGridLayouts(gridLayoutsTemp);
      } catch (e) {
        console.error("XML 로드 오류:", e);
        setError(e instanceof Error ? e.message : "XML 로드 실패");
      } finally {
        setLoading(false);
      }
    }

    loadXml();
  }, [resolvedCaseType, dataListEntries, resolvedApiData, effectiveApiData, apiEnvelope]);

  // 기본정보 데이터 전처리 (원고/피고명 조합, 종국결과 등)
  // 주의: Hook은 early return 전에 호출되어야 함
  const processedBasicInfo = useMemo(() => {
    return preprocessBasicInfo(overriddenBasicInfo || {});
  }, [overriddenBasicInfo]);

  // 로딩 중
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-gray-100 rounded-lg"></div>
        <div className="h-32 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        XML 로드 오류: {error}
      </div>
    );
  }

  // 데이터 없음
  if (!basicInfoData) {
    return (
      <div className="text-gray-500 text-sm p-4 bg-gray-50 rounded-lg">
        SCOURT 연동 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기본내용 - XML layout.rows 기반 렌더링 */}
      {basicInfoLayout && (
        <BasicInfoTable
          layout={basicInfoLayout}
          data={processedBasicInfo}
          className="bg-white rounded-lg border border-gray-200 p-4"
        />
      )}

      {/* 동적 그리드 렌더링 - API 응답의 모든 dlt_* 리스트 */}
      {!compact && dataListEntries.map((entry) => {
        const gridLayout = gridLayouts[entry.layoutKey];
        const gridData = (effectiveApiData || resolvedApiData)[entry.dataKey];

        // 레이아웃이 없으면 fallback 테이블 렌더링
        if (!gridLayout) {
          return (
            <FallbackGridTable
              key={entry.layoutKey}
              title={getDataListTitle(entry.layoutKey)}
              data={gridData}
              dataListId={entry.layoutKey}
              caseLinkMap={relatedCaseLinks}
            />
          );
        }

        return (
          <GridTable
            key={entry.layoutKey}
            layout={gridLayout}
            data={gridData}
            className="bg-white rounded-lg border border-gray-200 p-4"
            caseLinkMap={relatedCaseLinks}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// 데이터 리스트 타이틀 매핑
// ============================================================================

function getDataListTitle(dataListId: string): string {
  const normalizedId = normalizeDataListId(dataListId);
  const titles: Record<string, string> = {
    dlt_btprtCttLst: "당사자내용",
    dlt_agntCttLst: "대리인내용",
    dlt_atrnyCttLst: "변호인내용",
    dlt_rcntDxdyLst: "최근기일내용",
    dlt_rcntSbmsnDocmtLst: "최근 제출서류 접수내용",
    dlt_reltCsLst: "관련사건내용",
    dlt_inscrtDtsLst: "심급내용",
    dlt_hrngProgCurst: "심리진행현황",
    dlt_acsCttLst: "피고인 및 죄명내용",
    dlt_mergeCttLst: "병합사건내용",
    dlt_crctnOrdLst: "보정명령",
    dlt_scrtyCttLst: "담보내용",
  };
  return titles[normalizedId] || dataListId;
}

// ============================================================================
// Fallback 그리드 테이블 (XML 없을 때)
// ============================================================================

interface FallbackGridTableProps {
  title: string;
  data: any[];
  dataListId?: string;
  caseLinkMap?: Record<string, string>;
}

function FallbackGridTable({ title, data, dataListId, caseLinkMap }: FallbackGridTableProps) {
  if (!data || data.length === 0) return null;

  // 첫 번째 행에서 컬럼 추출
  const normalizedId = dataListId ? normalizeDataListId(dataListId) : "";
  const dataKeys = new Set<string>();
  data.forEach((row) => {
    Object.keys(row || {}).forEach((key) => dataKeys.add(key));
  });

  const preferredColumns = normalizedId ? DLT_TABLE_COLUMNS[normalizedId] : undefined;
  const filteredPreferred = preferredColumns
    ? preferredColumns.filter((col) => dataKeys.has(col))
    : [];
  const columns =
    filteredPreferred.length > 0
      ? filteredPreferred
      : Object.keys(data[0]).filter(
          (key) => !key.startsWith("_") && key !== "id"
        );
  const enableCaseLinks =
    dataListId === "dlt_reltCsLst" &&
    caseLinkMap &&
    Object.keys(caseLinkMap).length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-sage-600 rounded"></span>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-full">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-sm font-medium text-gray-700 text-left"
                >
                  {DLT_COLUMN_LABELS[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50">
                {columns.map((col, colIndex) => {
                  const displayValue = formatCellValue(row[col]);
                  const caseLink = enableCaseLinks
                    ? getFallbackCaseLink(displayValue, caseLinkMap)
                    : null;

                  return (
                    <td
                      key={colIndex}
                      className="px-3 py-2 text-sm text-gray-900"
                    >
                      {caseLink ? (
                        <a href={caseLink} className="text-sage-700 hover:underline">
                          {displayValue}
                        </a>
                      ) : (
                        displayValue
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    // 날짜 포맷 (YYYYMMDD -> YYYY.MM.DD)
    if (/^\d{8}$/.test(value)) {
      return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
    }
    // 시간 포맷 (HHMM -> HH:MM)
    if (/^\d{4}$/.test(value) && parseInt(value.slice(0, 2)) < 24) {
      return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
    }
    return value;
  }
  return String(value);
}

export default ScourtGeneralInfoXml;
