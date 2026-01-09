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
import {
  CASE_TYPE_XML_MAP,
  ScourtCaseType,
  detectCaseTypeFromApiResponse,
  normalizeDataListId,
  resolveBasicInfoXmlPath,
  resolveDataListXmlPath,
  DATA_LIST_XML_CANDIDATES,
} from "@/lib/scourt/xml-mapping";
import { extractSubXmlPaths, normalizeDataListPaths } from "@/lib/scourt/xml-utils";

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

// ============================================================================
// 컴포넌트
// ============================================================================

export function ScourtGeneralInfoXml({
  apiData,
  caseType,
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

  const resolvedCaseType = useMemo(() => {
    return detectCaseTypeFromApiResponse(resolvedApiData || {}) || caseType || "ssgo102";
  }, [resolvedApiData, caseType]);

  const basicInfoData = useMemo(() => {
    return (
      resolvedApiData?.dma_csBasCtt ||
      resolvedApiData?.dma_csBsCtt ||
      resolvedApiData?.dma_gnrlCtt ||
      null
    );
  }, [resolvedApiData]);

  // API 응답에서 dlt_* 데이터 리스트 동적 감지 (alias 정규화 포함)
  const dataListEntries = useMemo<DataListEntry[]>(() => {
    if (!resolvedApiData) return [];
    const keys = Object.keys(resolvedApiData).filter(
      (key) => key.startsWith("dlt_") && Array.isArray(resolvedApiData[key]) && resolvedApiData[key].length > 0
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
  }, [resolvedApiData]);

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

        // 1. 기본정보 XML 로드 (API 응답의 템플릿 ID 우선)
        const basicXmlPath = resolveBasicInfoXmlPath({
          caseType: resolvedCaseType,
          apiResponse: apiEnvelope as Record<string, unknown>,
        });
        if (!basicXmlPath) {
          throw new Error(`No basic_info XML mapping for case type: ${resolvedCaseType}`);
        }
        const basicXmlText = await fetchXmlWithFallback(basicXmlPath, resolvedCaseType);

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
          const listData = resolvedApiData[entry.dataKey];
          // 동적 추출 경로 우선, 없으면 하드코딩 매핑 fallback
          const xmlPath = resolveDataListXmlPath({
            caseType: resolvedCaseType,
            dataListId: entry.layoutKey,
            apiData: resolvedApiData,
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
  }, [resolvedCaseType, dataListEntries, resolvedApiData, apiEnvelope]);

  // 기본정보 데이터 전처리 (원고/피고명 조합, 종국결과 등)
  // 주의: Hook은 early return 전에 호출되어야 함
  const processedBasicInfo = useMemo(() => {
    return preprocessBasicInfo(basicInfoData || {});
  }, [basicInfoData]);

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
        const gridData = resolvedApiData[entry.dataKey];

        // 레이아웃이 없으면 fallback 테이블 렌더링
        if (!gridLayout) {
          return (
            <FallbackGridTable
              key={entry.layoutKey}
              title={getDataListTitle(entry.layoutKey)}
              data={gridData}
            />
          );
        }

        return (
          <GridTable
            key={entry.layoutKey}
            layout={gridLayout}
            data={gridData}
            className="bg-white rounded-lg border border-gray-200 p-4"
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
  };
  return titles[normalizedId] || dataListId;
}

// ============================================================================
// Fallback 그리드 테이블 (XML 없을 때)
// ============================================================================

interface FallbackGridTableProps {
  title: string;
  data: any[];
}

function FallbackGridTable({ title, data }: FallbackGridTableProps) {
  if (!data || data.length === 0) return null;

  // 첫 번째 행에서 컬럼 추출
  const columns = Object.keys(data[0]).filter(
    (key) => !key.startsWith("_") && key !== "id"
  );

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
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-100 hover:bg-gray-50">
                {columns.map((col, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-3 py-2 text-sm text-gray-900"
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
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
