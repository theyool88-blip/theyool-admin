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
import { DLT_COLUMN_LABELS, DLT_TABLE_COLUMNS, DLT_COLUMN_FORMATS } from "@/lib/scourt/field-renderer";
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
import { normalizeCaseNumber } from "@/lib/scourt/case-number-utils";
import {
  isMaskedPartyName,
  normalizePartyLabel,
  PARTY_TYPE_LABELS,
  getNameFieldsByLabel,
  normalizePartyName as normalizePartyNameUtil,
  preservePrefix,
  ConfirmedParty,
  getPartySide,
  PartyType,
} from "@/types/case-party";

// ============================================================================
// 타입 정의
// ============================================================================

/** 당사자 정보 (DB) */
interface CasePartyInfo {
  id: string;
  party_name: string;
  party_type: string;
  party_type_label?: string | null;
  scourt_party_index?: number | null;
  scourt_label_raw?: string | null;
  scourt_name_raw?: string | null;
  // NOTE: is_our_client 컬럼이 스키마에서 제거됨 - is_primary 사용
  is_primary?: boolean;
  clients?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null;
}

interface ScourtGeneralInfoXmlProps {
  /** API 응답 데이터 (dma_csBasCtt, dlt_* 포함) */
  apiData: {
    dma_csBasCtt?: Record<string, unknown>;
    [key: string]: unknown;
  };
  /** 사건 유형 코드 (ssgo102, ssgo101, ssgo10g, ssgo106) */
  caseType?: ScourtCaseType;
  /** 사건번호 (당사자 라벨 판단용) */
  caseNumber?: string;
  /** 사용자 입력 대리인 목록 */
  representativeOverrides?: RepresentativeOverride[];
  /** 관련사건 링크 맵 (사건번호 -> caseId) */
  relatedCaseLinks?: Record<string, string>;
  /** 컴팩트 모드 (기본정보만 표시) */
  compact?: boolean;
  /** 당사자 수정 콜백 (partyId, partyLabel, currentName) */
  onPartyEdit?: (partyId: string, partyLabel: string, currentName: string) => void;
  /** DB 당사자 목록 (마스킹 치환 및 수정 시 사용) */
  caseParties?: CasePartyInfo[];
  /** 의뢰인 이름 (linked_party_id 없이도 마스킹 해제 가능) */
  clientName?: string;
  /** 의뢰인 측 (plaintiff | defendant) */
  clientSide?: 'plaintiff' | 'defendant';
}

interface DataListEntry {
  dataKey: string;
  layoutKey: string;
}

function getLayoutMatchScore(layout: GridLayout, dataRows: Record<string, unknown>[]): number {
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
  dataRows: Record<string, unknown>[],
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

// 모듈 레벨 캐시 (세션 동안 유지) - 동일 XML 재요청 방지
const xmlContentCache = new Map<string, string>();
// 진행 중인 요청 추적 (중복 요청 방지)
const pendingRequests = new Map<string, Promise<string | null>>();

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
  // 1. 모듈 레벨 메모리 캐시 확인 (가장 빠름)
  const cached = xmlContentCache.get(xmlPath);
  if (cached) {
    return cached;
  }

  // 2. 진행 중인 동일 요청이 있으면 그 Promise 반환 (중복 요청 방지)
  const pending = pendingRequests.get(xmlPath);
  if (pending) {
    return pending;
  }

  // 3. 새 요청 시작
  const fetchPromise = (async (): Promise<string | null> => {
    const encodedPath = encodeURIComponent(xmlPath);

    // NEW: 정적 파일 우선 확인 (80-90% 트래픽 여기서 종료)
    try {
      const staticResponse = await fetch(`${XML_BASE_PATH}/${xmlPath}`);
      if (staticResponse.ok) {
        const staticText = await staticResponse.text();
        if (!isInvalidXmlContent(staticText)) {
          xmlContentCache.set(xmlPath, staticText);
          return staticText;
        }
      }
    } catch {
      // 정적 파일 없음 - 다음 단계로
    }

    // DB 캐시에서 조회 시도 (기존 로직 유지)
    try {
      const cacheResponse = await fetch(
        `/api/scourt/xml-cache?path=${encodedPath}`
      );
      let shouldRefresh = cacheResponse.status === 404;
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.xml_content) {
          if (isInvalidXmlContent(cacheData.xml_content)) {
            shouldRefresh = true;
          } else {
            xmlContentCache.set(xmlPath, cacheData.xml_content);
            return cacheData.xml_content;
          }
        }
      }
      if (shouldRefresh) {
        try {
          // POST 요청으로 대법원 다운로드 트리거 (기존 로직 유지)
          const downloadResponse = await fetch("/api/scourt/xml-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xmlPath, caseType, forceRefresh: true }),
          });

          // POST 성공 후 GET 재시도 (retry-after-POST, 기존 로직 보존)
          if (downloadResponse.ok) {
            const retryResponse = await fetch(
              `/api/scourt/xml-cache?path=${encodedPath}`
            );
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              if (retryData.xml_content && !isInvalidXmlContent(retryData.xml_content)) {
                xmlContentCache.set(xmlPath, retryData.xml_content);
                return retryData.xml_content;
              }
            }
          }
        } catch {
          // Download failed - 정적 파일은 이미 위에서 시도함
        }
      }
    } catch {
      // Cache lookup failed - 정적 파일은 이미 위에서 시도함
    }

    // 모든 시도 실패
    return null;
  })();

  // 진행 중인 요청 등록
  pendingRequests.set(xmlPath, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    // 완료 후 pending 목록에서 제거
    pendingRequests.delete(xmlPath);
  }
}

interface RepresentativeOverride {
  representative_name: string;
  representative_type_label?: string | null;
  law_firm_name?: string | null;
  is_our_firm?: boolean | null;
}

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


const PLAINTIFF_SIDE_LABELS = new Set([
  "원고",
  "채권자",
  "신청인",
  "항고인",
  "항소인",
  "상고인",
  "행위자",
  "청구인",
]);

const DEFENDANT_SIDE_LABELS = new Set([
  "피고",
  "채무자",
  "피신청인",
  "상대방",
  "피항고인",
  "피항소인",
  "피상고인",
  "보호소년",
  "피고인",
  "피고인명",
  "제3채무자",
  "피청구인",
  "피해아동",
  "피해자",
]);

function getSideFromLabel(label: string): "plaintiff" | "defendant" | null {
  const normalized = normalizePartyLabel(label);
  if (PLAINTIFF_SIDE_LABELS.has(normalized)) return "plaintiff";
  if (DEFENDANT_SIDE_LABELS.has(normalized)) return "defendant";
  return null;
}


const FALLBACK_CASE_NUMBER_PATTERN = /\d{4}\s*[가-힣]+\s*\d+/;
const FALLBACK_NORMALIZED_CASE_NUMBER_PATTERN = /^\d{4}[가-힣]+\d+$/;

interface RepresentativeOverrideGroup {
  label: string;
  displayLabel: string;
  names: string[];
  overrides: RepresentativeOverride[];
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

function applyIndexedName(originalValue: unknown, name: string): string {
  if (typeof originalValue !== "string") return name;
  return preservePrefix(originalValue, name);
}

function updatePartyRowName(row: Record<string, unknown>, name: string): Record<string, unknown> {
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

function getPartyRowLabel(row: Record<string, unknown>): string {
  for (const field of PARTY_LIST_LABEL_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function resolveCasePartyName(
  party: CasePartyInfo,
  propClientName?: string,
  propClientSide?: 'plaintiff' | 'defendant'
): string | null {
  // 1순위: party.clients.name (linked_party_id가 연결된 경우)
  const linkedClientName = party.clients?.name?.trim();
  if (linkedClientName && !isMaskedPartyName(linkedClientName)) {
    return linkedClientName;
  }

  // 2순위: party_name이 마스킹 안된 경우
  const partyName = party.party_name?.trim();
  if (partyName && !isMaskedPartyName(partyName)) {
    return normalizePartyNameUtil(partyName);
  }

  // 3순위: prop으로 전달받은 clientName을 해당 측 당사자에 적용
  if (propClientName && !isMaskedPartyName(propClientName) && propClientSide) {
    // 3a: 라벨 기반 측 판단
    const partyLabel = normalizePartyLabel(
      party.scourt_label_raw ||
      party.party_type_label ||
      PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
      ''
    );
    let partySide = getSideFromLabel(partyLabel);

    // 3b: 라벨로 안되면 party_type 기반 판단
    if (!partySide && party.party_type) {
      partySide = getPartySide(party.party_type as PartyType);
    }

    // 3c: is_primary 플래그가 있으면 이 당사자가 의뢰인 측임
    if (!partySide && party.is_primary) {
      partySide = propClientSide;  // is_primary면 의뢰인 측으로 간주
    }

    if (partySide === propClientSide) {
      return propClientName;
    }
  }

  return null;
}

/**
 * 당사자 리스트의 마스킹된 이름을 확정된 당사자 정보로 치환
 *
 * 로직:
 * 1. scourt_party_index가 일치하는 행 대상 (1순위)
 * 2. scourt_party_index가 없으면 label 기반 측 매칭 (2순위)
 * 3. resolveCasePartyName으로 이름 해결 (clients.name → party_name → clientName fallback)
 * 4. 풀네임이 있는 경우에만 치환
 */
function substitutePartyListNames(
  list: Record<string, unknown>[] | undefined,
  caseParties?: CasePartyInfo[],
  clientName?: string,
  clientSide?: 'plaintiff' | 'defendant'
): { list: Record<string, unknown>[] | undefined; updated: boolean } {
  if (!Array.isArray(list) || list.length === 0) return { list, updated: false };
  if (!caseParties || caseParties.length === 0) return { list, updated: false };

  // 1순위: scourt_party_index로 매칭
  const partiesByIndex = new Map<number, CasePartyInfo>();
  caseParties.forEach((party) => {
    if (party.scourt_party_index === null || party.scourt_party_index === undefined) return;
    partiesByIndex.set(party.scourt_party_index, party);
  });

  // 2순위 준비: label 기반 매칭 (scourt_party_index가 없는 경우 사용)
  const partiesBySide = new Map<'plaintiff' | 'defendant', CasePartyInfo[]>();
  partiesBySide.set('plaintiff', []);
  partiesBySide.set('defendant', []);

  caseParties.forEach((party) => {
    const partyLabel = normalizePartyLabel(
      party.scourt_label_raw ||
      party.party_type_label ||
      PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
      ''
    );
    let side = getSideFromLabel(partyLabel);
    if (!side && party.party_type) {
      side = getPartySide(party.party_type as PartyType);
    }
    if (side) {
      partiesBySide.get(side)!.push(party);
    }
  });

  // 사용된 clientName fallback 추적 (한 번만 사용)
  let usedClientNameFallback = false;

  let updated = false;
  const next = list.map((row, index) => {
    // 1순위: scourt_party_index로 매칭
    let matchedParty = partiesByIndex.get(index);

    // 2순위: scourt_party_index 매칭 실패 시 label 기반 측 매칭
    // NOTE: 이전에는 partiesByIndex.size === 0 조건이 있어서 하나라도 index가 있으면 fallback 안됨
    //       이제는 각 행에서 매칭 실패 시 항상 fallback 시도
    if (!matchedParty) {
      const rowLabel = getPartyRowLabel(row);
      const rowSide = getSideFromLabel(normalizePartyLabel(rowLabel));
      if (rowSide) {
        const sideParties = partiesBySide.get(rowSide) || [];
        // primary 당사자 우선, 없으면 첫 번째
        matchedParty = sideParties.find(p => p.is_primary) || sideParties[0];
      }
    }

    if (!matchedParty) {
      // 3순위: clientName/clientSide fallback (측이 일치하면 직접 치환)
      if (clientName && !isMaskedPartyName(clientName) && clientSide && !usedClientNameFallback) {
        const rowLabel = getPartyRowLabel(row);
        const rowSide = getSideFromLabel(normalizePartyLabel(rowLabel));
        if (rowSide === clientSide) {
          const nameField = PARTY_LIST_NAME_FIELDS.find((field) =>
            Object.prototype.hasOwnProperty.call(row, field)
          );
          if (nameField) {
            const currentName = String(row[nameField] || '');
            if (isMaskedPartyName(currentName)) {
              usedClientNameFallback = true;
              updated = true;
              return updatePartyRowName(row, clientName);
            }
          }
        }
      }
      return row;
    }

    const resolvedName = resolveCasePartyName(matchedParty, clientName, clientSide);
    if (!resolvedName) return row;

    const nameField = PARTY_LIST_NAME_FIELDS.find((field) =>
      Object.prototype.hasOwnProperty.call(row, field)
    );
    if (!nameField) return row;

    const currentName = String(row[nameField] || '');
    if (!isMaskedPartyName(currentName)) return row;

    updated = true;
    return updatePartyRowName(row, resolvedName);
  });

  return { list: updated ? next : list, updated };
}

const REPRESENTATIVE_LABEL_FIELDS = ["agntDvsNm", "agntDvsCdNm", "btprtRltnCtt"];
const REPRESENTATIVE_NAME_FIELDS = ["agntNm", "athrzNm", "representative_name"];

function getRepresentativeRowLabel(row: Record<string, unknown>): string {
  for (const field of REPRESENTATIVE_LABEL_FIELDS) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "";
}

function updateRepresentativeRowName(row: Record<string, unknown>, name: string): Record<string, unknown> {
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
  list: Record<string, unknown>[],
  label: string,
  displayLabel: string,
  names: string[]
): { list: Record<string, unknown>[]; updated: boolean } {
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
  list: Record<string, unknown>[] | undefined,
  groups: RepresentativeOverrideGroup[]
): { list: Record<string, unknown>[] | undefined; updated: boolean } {
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
  representativeOverrides,
  relatedCaseLinks,
  compact = false,
  onPartyEdit,
  caseParties,
  clientName,
  clientSide,
}: ScourtGeneralInfoXmlProps) {
  const apiEnvelope = useMemo(() => {
    if (!apiData) return {} as Record<string, unknown>;
    if (typeof apiData === "string") {
      try {
        const parsed = JSON.parse(apiData);
        if (parsed && typeof parsed === "object") {
          return parsed as Record<string, unknown>;
        }
      } catch (e) {
        console.warn("[XML] Failed to parse apiData JSON string", e);
      }
      return {} as Record<string, unknown>;
    }
    return apiData as Record<string, unknown>;
  }, [apiData]);

  const resolvedApiData = useMemo(() => {
    const dataCandidate = (apiEnvelope as { data?: Record<string, unknown> }).data;
    if (dataCandidate && typeof dataCandidate === "object") {
      return dataCandidate;
    }
    const rawCandidate = (apiEnvelope as { raw?: { data?: Record<string, unknown> } }).raw?.data;
    if (rawCandidate && typeof rawCandidate === "object") {
      return rawCandidate;
    }
    return apiEnvelope as Record<string, unknown>;
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

  const basicInfoData = useMemo((): Record<string, unknown> | null => {
    if (!resolvedApiData || !basicInfoKey) return null;
    const data = resolvedApiData[basicInfoKey];
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  }, [resolvedApiData, basicInfoKey]);

  const scourtPartyRows = useMemo(() => {
    const list = resolvedApiData?.dlt_btprtCttLst;
    return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  }, [resolvedApiData]);

  const scourtPartyLabelsByIndex = useMemo(() => {
    return scourtPartyRows.map((row) => normalizePartyLabel(getPartyRowLabel(row)));
  }, [scourtPartyRows]);

  const representativeOverrideGroups = useMemo(() => {
    return buildRepresentativeOverrideGroups(representativeOverrides);
  }, [representativeOverrides]);

  /**
   * 확정된 당사자 정보 추출
   * - party_name이 마스킹 해제되었거나
   * - clients.name이 있거나
   * - clientName prop fallback이 적용되면 확정된 것으로 간주
   * { label: "신청인", name: "이명규", isClient: true }
   */
  const confirmedParties = useMemo((): ConfirmedParty[] => {
    if (!caseParties || caseParties.length === 0) return [];

    const primaryParties = caseParties.filter(p => p.is_primary);
    const sourceParties = primaryParties.length > 0 ? primaryParties : caseParties;

    return sourceParties
      .map((party) => {
        const resolvedName = resolveCasePartyName(party, clientName, clientSide);
        if (!resolvedName) return null;
        const fallbackLabel = normalizePartyLabel(
          party.scourt_label_raw ||
          party.party_type_label ||
          PARTY_TYPE_LABELS[party.party_type as keyof typeof PARTY_TYPE_LABELS] ||
          ''
        );
        const indexedLabel =
          party.scourt_party_index !== null && party.scourt_party_index !== undefined
            ? scourtPartyLabelsByIndex[party.scourt_party_index] || ''
            : '';
        const resolvedLabel = indexedLabel || fallbackLabel;
        if (!resolvedLabel) return null;
        return {
          label: resolvedLabel,
          name: resolvedName,
          isClient: party.is_primary || false,  // NOTE: is_our_client → is_primary
        };
      })
      .filter((party): party is ConfirmedParty => Boolean(party));
  }, [caseParties, scourtPartyLabelsByIndex, clientName, clientSide]);

  /**
   * 기본정보 마스킹 치환
   *
   * 단순 로직:
   * 1. 확정된 당사자의 라벨(지위)을 가져옴 (예: "신청인")
   * 2. 그 라벨에 해당하는 필드들을 찾음 (예: rprsAplcntNm, aplNm)
   * 3. 해당 필드에 확정된 이름을 넣음
   */
  const overriddenBasicInfo = useMemo(() => {
    if (!basicInfoData) return basicInfoData;
    if (confirmedParties.length === 0) return basicInfoData;

    const next = { ...basicInfoData };
    let updated = false;

    // 각 확정된 당사자에 대해
    for (const party of confirmedParties) {
      // 라벨에 해당하는 필드들 가져오기
      const targetFields = getNameFieldsByLabel(party.label);

      // 해당 필드들에 이름 치환
      for (const field of targetFields) {
        const value = next[field];
        if (typeof value !== 'string') continue;

        // 마스킹된 값이면 치환, 아니어도 치환 (확정된 이름이 우선)
        next[field] = preservePrefix(value, party.name);
        updated = true;
      }
    }

    return updated ? next : basicInfoData;
  }, [basicInfoData, confirmedParties]);

  /**
   * 전체 API 데이터 마스킹 치환
   * - 기본정보: overriddenBasicInfo
   * - 당사자 리스트: substitutePartyListNames
   * - 대리인 리스트: 기존 로직 유지
   */
  const effectiveApiData = useMemo(() => {
    if (!resolvedApiData) return resolvedApiData;

    let updated = false;
    const next: Record<string, unknown> = { ...resolvedApiData };

    // 1. 기본정보 치환
    if (basicInfoKey && overriddenBasicInfo && overriddenBasicInfo !== basicInfoData) {
      next[basicInfoKey] = overriddenBasicInfo;
      updated = true;
    }

    // Helper to safely extract array from unknown
    const getRecordArray = (key: string): Record<string, unknown>[] | undefined => {
      const val = next[key];
      return Array.isArray(val) ? val as Record<string, unknown>[] : undefined;
    };

    // 2. 당사자 리스트 치환 (caseParties + clientName/clientSide fallback 사용)
    if (caseParties && caseParties.length > 0) {
      const partiesResult = substitutePartyListNames(
        getRecordArray('dlt_btprtCttLst'),
        caseParties,
        clientName,
        clientSide
      );
      if (partiesResult.updated) {
        next.dlt_btprtCttLst = partiesResult.list;
        updated = true;
      }

      const accusedResult = substitutePartyListNames(
        getRecordArray('dlt_acsCttLst'),
        caseParties,
        clientName,
        clientSide
      );
      if (accusedResult.updated) {
        next.dlt_acsCttLst = accusedResult.list;
        updated = true;
      }
    }

    // 3. 대리인 리스트 치환 (기존 로직 유지)
    if (representativeOverrideGroups.length > 0) {
      const repsResult = applyRepresentativeOverridesToList(
        getRecordArray('dlt_agntCttLst'),
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
    caseParties,
    clientName,
    clientSide,
    representativeOverrideGroups,
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

        // 2. 각 dlt_* 데이터 리스트에 대해 XML 병렬 로드
        const xmlLoadPromises = dataListEntries.map(async (entry) => {
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
            } catch {
              // Grid XML load failed, try fallback
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

          return { entry, resolvedLayout };
        });

        // 모든 XML 로드 병렬 실행
        const xmlResults = await Promise.all(xmlLoadPromises);

        // 결과 처리
        for (const { entry, resolvedLayout } of xmlResults) {
          if (!resolvedLayout) {
            if (!gridLayoutsTemp[entry.layoutKey]) {
              // No mapping for data list (silent)
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
    return preprocessBasicInfo(overriddenBasicInfo ?? {});
  }, [overriddenBasicInfo]);

  // 로딩 중
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-[var(--bg-tertiary)] rounded-lg"></div>
        <div className="h-32 bg-[var(--bg-tertiary)] rounded-lg"></div>
      </div>
    );
  }

  // 에러
  if (error) {
    return (
      <div className="text-[var(--color-danger)] p-4 bg-[var(--color-danger-muted)] rounded-lg">
        XML 로드 오류: {error}
      </div>
    );
  }

  // 데이터 없음
  if (!basicInfoData) {
    return (
      <div className="text-[var(--text-tertiary)] text-sm p-4 bg-[var(--bg-primary)] rounded-lg">
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
        />
      )}

      {/* 동적 그리드 렌더링 - API 응답의 모든 dlt_* 리스트 */}
      {!compact && dataListEntries.map((entry) => {
        const gridLayout = gridLayouts[entry.layoutKey];
        const rawGridData = (effectiveApiData || resolvedApiData)?.[entry.dataKey];
        const gridData = Array.isArray(rawGridData) ? rawGridData as Record<string, unknown>[] : [];
        const normalizedLayoutKey = normalizeDataListId(entry.layoutKey);
        const isPartyTable = normalizedLayoutKey === "dlt_btprtCttLst" || normalizedLayoutKey === "dlt_acsCttLst";
        const showEditButtons = isPartyTable && onPartyEdit && caseParties && caseParties.length > 0;

        // 레이아웃이 없으면 fallback 테이블 렌더링
        if (!gridLayout) {
          return (
            <FallbackGridTable
              key={entry.layoutKey}
              title={getDataListTitle(entry.layoutKey)}
              data={gridData}
              dataListId={entry.layoutKey}
              caseLinkMap={relatedCaseLinks}
              onPartyEdit={isPartyTable ? onPartyEdit : undefined}
              caseParties={isPartyTable ? caseParties : undefined}
            />
          );
        }

        return (
          <GridTable
            key={entry.layoutKey}
            layout={gridLayout}
            data={gridData}
            caseLinkMap={relatedCaseLinks}
            renderRowAction={showEditButtons ? (row, rowIndex) => {
              const partyName = String(row.btprtNm || row.btprtNmOrg || '');
              const partyLabel = String(row.btprtDvsNm || row.btprtStndngNm || row.btprtDvsCdNm || '');
              const matchedParty = findMatchingParty(row, rowIndex, caseParties);
              const canEdit = Boolean(matchedParty);
              if (!canEdit || !matchedParty) return null;
              return (
                <button
                  onClick={() => onPartyEdit(matchedParty.id, partyLabel, partyName)}
                  className="text-[var(--sage-primary)] hover:text-[var(--sage-hover)] text-xs"
                  title="이름 수정"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              );
            } : undefined}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// 마스킹된 이름 감지 및 당사자 매칭
// ============================================================================

/**
 * XML 당사자 행과 DB 당사자를 매칭
 *
 * 매칭 우선순위:
 * 1. scourt_party_index 정확 매칭
 * 2. 라벨 기반 측 매칭 (같은 측의 is_primary 우선)
 */
function findMatchingParty(
  row: Record<string, unknown>,
  rowIndex: number,
  caseParties?: CasePartyInfo[]
): CasePartyInfo | null {
  if (!caseParties || caseParties.length === 0) return null;

  // 1순위: scourt_party_index 매칭
  const indexMatch = caseParties.find(p => p.scourt_party_index === rowIndex);
  if (indexMatch) return indexMatch;

  // 2순위: 라벨 기반 측 매칭 + is_primary 우선순위
  const rowLabel = getPartyRowLabel(row);
  const normalizedLabel = normalizePartyLabel(rowLabel);
  const rowSide = getSideFromLabel(normalizedLabel);

  if (rowSide) {
    // 같은 측의 당사자들 필터링
    const sideParties = caseParties.filter(p => {
      const partyLabel = normalizePartyLabel(
        p.scourt_label_raw || p.party_type_label || ''
      );
      const partySide = getSideFromLabel(partyLabel) || getPartySide(p.party_type as PartyType);
      return partySide === rowSide;
    });

    if (sideParties.length > 0) {
      // is_primary 우선, 그 다음 첫 번째
      const sorted = [...sideParties].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return 0;
      });
      return sorted[0];
    }
  }

  // 매칭 실패 시 null 반환 (잘못된 party_type 반환 방지)
  return null;
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
  data: Record<string, unknown>[];
  dataListId?: string;
  caseLinkMap?: Record<string, string>;
  /** 당사자 수정 콜백 (partyId, partyLabel, currentName) */
  onPartyEdit?: (partyId: string, partyLabel: string, currentName: string) => void;
  /** DB 당사자 목록 (수정 시 ID 매칭용) */
  caseParties?: CasePartyInfo[];
}

function FallbackGridTable({
  title,
  data,
  dataListId,
  caseLinkMap,
  onPartyEdit,
  caseParties,
}: FallbackGridTableProps) {
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
    ['dlt_reltCsLst', 'dlt_inscrtDtsLst'].includes(normalizedId) &&
    caseLinkMap &&
    Object.keys(caseLinkMap).length > 0;

  // 당사자 테이블인지 확인 (수정 버튼 표시용)
  const isPartyTable = normalizedId === "dlt_btprtCttLst" || normalizedId === "dlt_acsCttLst";
  const showEditButtons = isPartyTable && onPartyEdit && caseParties && caseParties.length > 0;

  return (
    <div>
      <h3 className="text-base md:text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-[var(--sage-primary)] rounded"></span>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bg-primary)] border-y border-[var(--border-default)]">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[var(--text-secondary)] text-left"
                >
                  {DLT_COLUMN_LABELS[col] || col}
                </th>
              ))}
              {showEditButtons && (
                <th className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-[var(--text-secondary)] text-center w-16">
                  수정
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => {
              // 당사자 테이블: 매칭된 당사자 및 마스킹 여부 확인
              const partyName = String(row.btprtNm || row.btprtNmOrg || '');
              const partyLabel = String(row.btprtDvsNm || row.btprtStndngNm || row.btprtDvsCdNm || '');
              const matchedParty = showEditButtons ? findMatchingParty(row, rowIndex, caseParties) : null;
              const canEdit = Boolean(matchedParty);

              return (
                <tr key={rowIndex} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
                  {columns.map((col, colIndex) => {
                    const displayValue = formatCellValue(row[col], col);
                    const caseLink = enableCaseLinks
                      ? getFallbackCaseLink(displayValue, caseLinkMap)
                      : null;

                    return (
                      <td
                        key={colIndex}
                        className="px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-[var(--text-primary)]"
                      >
                        {caseLink ? (
                          <a href={caseLink} className="text-[var(--sage-primary)] hover:underline">
                            {displayValue}
                          </a>
                        ) : (
                          displayValue
                        )}
                      </td>
                    );
                  })}
                  {showEditButtons && (
                    <td className="px-2 md:px-3 py-1.5 md:py-2 text-center">
                      {canEdit && matchedParty && (
                        <button
                          onClick={() => onPartyEdit(matchedParty.id, partyLabel, partyName)}
                          className="text-[var(--sage-primary)] hover:text-[var(--sage-hover)] text-xs"
                          title="이름 수정"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCellValue(value: unknown, columnId?: string): string {
  if (value === null || value === undefined) return "";

  // 컬럼별 displayFormat 적용
  const format = columnId ? DLT_COLUMN_FORMATS[columnId] : undefined;
  if (format === '#,###' && (typeof value === 'number' || /^\d+$/.test(String(value)))) {
    return Number(value).toLocaleString('ko-KR');
  }

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

export default React.memo(ScourtGeneralInfoXml);
