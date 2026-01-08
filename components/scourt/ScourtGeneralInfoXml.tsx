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
  ParsedLayout,
} from "@/lib/scourt/xml-parser";
import {
  BasicInfoTable,
  GridTable,
  preprocessBasicInfo,
} from "@/lib/scourt/xml-renderer";
import {
  CASE_TYPE_XML_MAP,
  ScourtCaseType,
  getRequiredXmlFiles,
} from "@/lib/scourt/xml-mapping";

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

// ============================================================================
// XML 로드 헬퍼 (DB 캐시 우선, 정적 파일 fallback)
// ============================================================================

const XML_BASE_PATH = "/scourt-xml";

/**
 * 기본정보 XML에서 하위 XML 경로 동적 추출
 *
 * 지원 패턴:
 * 1. JavaScript .setSrc(): wfScrtyCttLst.setSrc("/ui/ssgo003/SSGO003FA0.xml")
 * 2. XML wframe src: <w2:wframe id="wfRcntDxdyLst" src="SSGO003F32.xml">
 */
function extractSubXmlPaths(basicInfoXml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 패턴 1: JavaScript .setSrc() 호출
  const jsSrcRegex = /wf(\w+)\.setSrc\([^"']*["']\/ui\/([^"']+)["']/g;
  let match;
  while ((match = jsSrcRegex.exec(basicInfoXml)) !== null) {
    const varName = match[1];
    const xmlPath = match[2];
    const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
    result[dataListId] = xmlPath;
  }

  // 패턴 2: XML wframe src 속성
  const wframeRegex = /<w2:wframe\s+([^>]+)>/g;
  while ((match = wframeRegex.exec(basicInfoXml)) !== null) {
    const attrs = match[1];
    const idMatch = attrs.match(/id=["']wf(\w+)["']/);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/);

    if (idMatch && srcMatch) {
      const varName = idMatch[1];
      const xmlFileName = srcMatch[1];
      const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
      const xmlPath = xmlFileName.startsWith("ssgo") || xmlFileName.includes("/")
        ? xmlFileName
        : `ssgo003/${xmlFileName}`;
      result[dataListId] = xmlPath;
    }
  }

  return result;
}

async function fetchXmlWithFallback(xmlPath: string): Promise<string | null> {
  // 1. DB 캐시에서 조회 시도
  try {
    const cacheResponse = await fetch(
      `/api/scourt/xml-cache?path=${encodeURIComponent(xmlPath)}`
    );
    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json();
      if (cacheData.xml_content) {
        console.log(`[XML] Cache hit: ${xmlPath}`);
        return cacheData.xml_content;
      }
    }
  } catch (e) {
    console.warn(`[XML] Cache lookup failed for ${xmlPath}:`, e);
  }

  // 2. Fallback: 정적 파일에서 로드
  try {
    const staticResponse = await fetch(`${XML_BASE_PATH}/${xmlPath}`);
    if (staticResponse.ok) {
      console.log(`[XML] Static file loaded: ${xmlPath}`);
      return await staticResponse.text();
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
  caseType = "ssgo102",
  compact = false,
}: ScourtGeneralInfoXmlProps) {
  const [basicInfoLayout, setBasicInfoLayout] = useState<BasicInfoLayout | null>(null);
  const [gridLayouts, setGridLayouts] = useState<Record<string, GridLayout>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API 응답에서 dlt_* 데이터 리스트 동적 감지
  const dataLists = useMemo(() => {
    if (!apiData) return [];
    return Object.keys(apiData).filter(
      (key) => key.startsWith("dlt_") && Array.isArray(apiData[key]) && apiData[key].length > 0
    );
  }, [apiData]);

  // XML 파일 로드 및 파싱
  useEffect(() => {
    async function loadXml() {
      setLoading(true);
      setError(null);

      try {
        const mapping = CASE_TYPE_XML_MAP[caseType];
        if (!mapping) {
          throw new Error(`Unknown case type: ${caseType}`);
        }

        // 1. 기본정보 XML 로드
        const basicXmlPath = mapping.basic_info;
        if (!basicXmlPath) {
          throw new Error(`No basic_info XML mapping for case type: ${caseType}`);
        }
        const basicXmlText = await fetchXmlWithFallback(basicXmlPath);

        // 동적 XML 경로 추출 (기본정보 XML에서 .setSrc() 파싱)
        let dynamicPaths: Record<string, string> = {};
        if (basicXmlText) {
          const parsed = parseWebSquareXml(basicXmlText);
          setBasicInfoLayout(parsed.basicInfo);
          dynamicPaths = extractSubXmlPaths(basicXmlText);
          console.log("[XML Render] Dynamic paths:", Object.keys(dynamicPaths));
        }

        // 2. 각 dlt_* 데이터 리스트에 대해 해당 XML 로드
        const gridLayoutsTemp: Record<string, GridLayout> = {};

        for (const dataListId of dataLists) {
          // 동적 추출 경로 우선, 없으면 하드코딩 매핑 fallback
          const xmlPath = dynamicPaths[dataListId] || (mapping as Record<string, string>)[dataListId];
          if (!xmlPath) {
            console.warn(`[XML] No mapping for data list: ${dataListId}`);
            continue;
          }

          try {
            const gridXmlText = await fetchXmlWithFallback(xmlPath);
            if (gridXmlText) {
              const gridLayout = parseGridXml(gridXmlText);
              if (gridLayout) {
                // 타이틀이 없으면 dataListId로 대체
                if (!gridLayout.title) {
                  gridLayout.title = getDataListTitle(dataListId);
                }
                gridLayoutsTemp[dataListId] = gridLayout;
              }
            }
          } catch (e) {
            console.warn(`[XML] Grid XML load failed: ${xmlPath}`, e);
          }
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
  }, [caseType, dataLists]);

  // 기본정보 데이터 전처리 (원고/피고명 조합, 종국결과 등)
  // 주의: Hook은 early return 전에 호출되어야 함
  const processedBasicInfo = useMemo(() => {
    return preprocessBasicInfo(apiData?.dma_csBasCtt || {});
  }, [apiData?.dma_csBasCtt]);

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
  if (!apiData?.dma_csBasCtt) {
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
      {!compact && dataLists.map((dataListId) => {
        const gridLayout = gridLayouts[dataListId];
        const gridData = apiData[dataListId];

        // 레이아웃이 없으면 fallback 테이블 렌더링
        if (!gridLayout) {
          return (
            <FallbackGridTable
              key={dataListId}
              title={getDataListTitle(dataListId)}
              data={gridData}
            />
          );
        }

        return (
          <GridTable
            key={dataListId}
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
  return titles[dataListId] || dataListId;
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
