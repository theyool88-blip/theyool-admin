/**
 * SCOURT XML 다운로드 & 캐싱
 *
 * SCOURT에서 XML 파일을 다운로드하고 DB에 캐시
 */

import { createClient } from "@/lib/supabase/server";
import {
  ScourtCaseType,
  CASE_TYPE_XML_MAP,
  DataListId,
  getDataListIdFromXmlPath,
} from "./xml-mapping";

// ============================================================================
// 상수
// ============================================================================

const SCOURT_XML_BASE_URL = "https://ssgo.scourt.go.kr/ssgo/ui";

// User-Agent 헤더 (SCOURT WAF 우회 필수)
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ============================================================================
// XML 캐시 타입
// ============================================================================

export interface XmlCacheEntry {
  id: string;
  xml_path: string;
  xml_content: string;
  case_type: string | null;
  data_list_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// XML 다운로드 함수
// ============================================================================

/**
 * SCOURT에서 XML 파일 다운로드
 *
 * @param xmlPath XML 파일 경로 (예: "ssgo003/SSGO003F70.xml")
 * @returns XML 파일 내용
 */
export async function downloadXmlFromScourt(xmlPath: string): Promise<string> {
  const url = `${SCOURT_XML_BASE_URL}/${xmlPath}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download XML: ${url} (${response.status})`);
  }

  const xmlContent = await response.text();

  // XML 유효성 검사 (기본적인 체크)
  if (!xmlContent.includes("<?xml") && !xmlContent.includes("<html")) {
    throw new Error(`Invalid XML content from: ${url}`);
  }

  return xmlContent;
}

// ============================================================================
// 캐시 조회/저장
// ============================================================================

/**
 * DB에서 캐시된 XML 조회
 */
export async function getCachedXml(
  xmlPath: string
): Promise<XmlCacheEntry | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scourt_xml_cache")
    .select("*")
    .eq("xml_path", xmlPath)
    .single();

  if (error) {
    // 데이터가 없는 경우는 에러가 아님
    if (error.code === "PGRST116") return null;
    console.error("Error fetching cached XML:", error);
    return null;
  }

  return data as XmlCacheEntry;
}

/**
 * DB에 XML 캐시 저장
 */
export async function saveCachedXml(
  xmlPath: string,
  xmlContent: string,
  caseType?: string
): Promise<XmlCacheEntry | null> {
  const supabase = await createClient();

  const dataListId = getDataListIdFromXmlPath(xmlPath);

  const { data, error } = await supabase
    .from("scourt_xml_cache")
    .upsert(
      {
        xml_path: xmlPath,
        xml_content: xmlContent,
        case_type: caseType || null,
        data_list_id: dataListId || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "xml_path",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error saving XML cache:", error);
    return null;
  }

  return data as XmlCacheEntry;
}

// ============================================================================
// 통합 함수: 캐시 확인 → 없으면 다운로드 → 저장
// ============================================================================

/**
 * XML 파일 가져오기 (캐시 우선, 없으면 다운로드)
 *
 * @param xmlPath XML 파일 경로
 * @param caseType 사건유형 코드 (캐시 저장 시 참고용)
 * @returns XML 파일 내용
 */
export async function fetchXml(
  xmlPath: string,
  caseType?: string
): Promise<string> {
  // 1. 캐시 확인
  const cached = await getCachedXml(xmlPath);
  if (cached) {
    console.log(`[XML Cache] Hit: ${xmlPath}`);
    return cached.xml_content;
  }

  // 2. 캐시 없음 → SCOURT에서 다운로드
  console.log(`[XML Cache] Miss: ${xmlPath}, downloading...`);
  const xmlContent = await downloadXmlFromScourt(xmlPath);

  // 3. 캐시에 저장
  await saveCachedXml(xmlPath, xmlContent, caseType);
  console.log(`[XML Cache] Saved: ${xmlPath}`);

  return xmlContent;
}

/**
 * 여러 XML 파일 가져오기 (병렬 처리)
 */
export async function fetchMultipleXml(
  xmlPaths: string[],
  caseType?: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  await Promise.all(
    xmlPaths.map(async (xmlPath) => {
      try {
        results[xmlPath] = await fetchXml(xmlPath, caseType);
      } catch (error) {
        console.error(`Failed to fetch XML: ${xmlPath}`, error);
      }
    })
  );

  return results;
}

// ============================================================================
// 기본정보 XML에서 하위 XML 경로 동적 추출
// ============================================================================

/**
 * 기본정보 XML에서 하위 XML 경로 동적 추출
 *
 * 지원 패턴:
 * 1. JavaScript .setSrc(): wfScrtyCttLst.setSrc("/ui/ssgo003/SSGO003FA0.xml")
 *    - 큰따옴표, 작은따옴표 모두 지원
 * 2. XML wframe src: <w2:wframe id="wfRcntDxdyLst" src="SSGO003F32.xml">
 *    - 속성 순서 무관 (id가 먼저든 src가 먼저든)
 *    - 큰따옴표, 작은따옴표 모두 지원
 *
 * @param basicInfoXml 기본정보 XML 내용
 * @returns 데이터 리스트 ID → XML 경로 매핑
 */
function extractSubXmlPaths(basicInfoXml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 패턴 1: JavaScript .setSrc() 호출
  // 예: wfScrtyCttLst.setSrc("/ui/ssgo003/SSGO003FA0.xml")
  // 예: wfScrtyCttLst.setSrc('/ui/ssgo003/SSGO003FA0.xml')
  const jsSrcRegex = /wf(\w+)\.setSrc\([^"']*["']\/ui\/([^"']+)["']/g;
  let match;
  while ((match = jsSrcRegex.exec(basicInfoXml)) !== null) {
    const varName = match[1]; // "ScrtyCttLst"
    const xmlPath = match[2]; // "ssgo003/SSGO003FA0.xml"
    const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
    result[dataListId] = xmlPath;
  }

  // 패턴 2: XML wframe src 속성 (속성 순서 무관)
  // 예: <w2:wframe id="wfRcntDxdyLst" src="SSGO003F32.xml">
  // 예: <w2:wframe src="SSGO003F32.xml" id="wfRcntDxdyLst">
  // 예: <w2:wframe id='wfRcntDxdyLst' src='SSGO003F32.xml'>
  const wframeRegex = /<w2:wframe\s+([^>]+)>/g;
  while ((match = wframeRegex.exec(basicInfoXml)) !== null) {
    const attrs = match[1];

    // id 속성 추출 (wf로 시작하는 것만)
    const idMatch = attrs.match(/id=["']wf(\w+)["']/);
    // src 속성 추출
    const srcMatch = attrs.match(/src=["']([^"']+)["']/);

    if (idMatch && srcMatch) {
      const varName = idMatch[1]; // "RcntDxdyLst"
      const xmlFileName = srcMatch[1]; // "SSGO003F32.xml"
      const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;

      // ssgo003/ 경로 prefix 추가 (상대 경로인 경우)
      const xmlPath = xmlFileName.startsWith("ssgo") || xmlFileName.includes("/")
        ? xmlFileName
        : `ssgo003/${xmlFileName}`;
      result[dataListId] = xmlPath;
    }
  }

  return result;
}

/**
 * 데이터 존재 여부 확인
 */
function hasData(data: unknown): boolean {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return true;
}

// ============================================================================
// 사건 등록 시 호출할 함수
// ============================================================================

/**
 * 사건 등록 시 필요한 XML 파일 캐시 확보
 *
 * 1. 기본정보 XML 먼저 다운로드
 * 2. 기본정보 XML에서 .setSrc() 파싱하여 하위 XML 경로 동적 추출
 * 3. 첫 연동: 모든 동적 추출 경로 캐시 (데이터 유무 무관)
 *    갱신: 데이터가 있는 dlt_* 항목 중 미캐시된 것만 다운로드
 * 4. 누락된 XML 다운로드
 *
 * @param caseType 사건유형 코드
 * @param apiResponse SCOURT API 응답 데이터
 * @param cacheAllOnFirstLink 첫 연동 시 모든 XML 캐시 (기본 true)
 */
export async function ensureXmlCacheForCase(
  caseType: ScourtCaseType,
  apiResponse: Record<string, unknown>,
  cacheAllOnFirstLink: boolean = true
): Promise<void> {
  // 1. 기본정보 XML 경로 확인
  const basicInfoPath = CASE_TYPE_XML_MAP[caseType]?.basic_info;
  if (!basicInfoPath) {
    console.warn(`[XML Cache] No basic_info XML for ${caseType}`);
    return;
  }

  // 2. 기본정보 XML 먼저 다운로드/캐시
  console.log(`[XML Cache] Fetching basic info XML: ${basicInfoPath}`);
  const basicInfoXml = await fetchXml(basicInfoPath, caseType);

  // 3. 기본정보 XML에서 하위 XML 경로 동적 추출 (핵심!)
  const dynamicPaths = extractSubXmlPaths(basicInfoXml);
  console.log(
    `[XML Cache] Dynamic paths extracted:`,
    Object.keys(dynamicPaths)
  );

  // 4. 캐시할 XML 결정
  const requiredXmls: string[] = [basicInfoPath];

  if (cacheAllOnFirstLink) {
    // 첫 연동: 동적 추출된 모든 XML 경로 캐시 (데이터 유무 무관)
    // → 나중에 데이터가 생겨도 XML이 이미 캐시되어 있음
    for (const xmlPath of Object.values(dynamicPaths)) {
      requiredXmls.push(xmlPath);
    }
    console.log(`[XML Cache] First link: caching all ${Object.keys(dynamicPaths).length} dynamic paths`);
  } else {
    // 갱신: 데이터가 있는 dlt_* 항목만 캐시
    const dataListKeys = Object.keys(apiResponse).filter(
      (key) => key.startsWith("dlt_") && hasData(apiResponse[key])
    );

    for (const key of dataListKeys) {
      const xmlPath =
        dynamicPaths[key] || CASE_TYPE_XML_MAP[caseType]?.[key as DataListId];
      if (xmlPath) {
        requiredXmls.push(xmlPath);
      }
    }
  }

  // 5. 중복 제거
  const uniqueXmls = [...new Set(requiredXmls)];

  // 6. 캐시에 없는 파일만 필터링
  const missingXmls: string[] = [];
  for (const xmlPath of uniqueXmls) {
    // 기본정보 XML은 이미 다운로드함, 스킵
    if (xmlPath === basicInfoPath) continue;

    const cached = await getCachedXml(xmlPath);
    if (!cached) {
      missingXmls.push(xmlPath);
    }
  }

  if (missingXmls.length === 0) {
    console.log(`[XML Cache] All XMLs already cached for ${caseType}`);
    return;
  }

  // 7. 없는 파일만 다운로드 & 저장
  console.log(`[XML Cache] Downloading ${missingXmls.length} missing XMLs...`);
  await fetchMultipleXml(missingXmls, caseType);
}

// ============================================================================
// 클라이언트용 API (정적 파일 fallback 포함)
// ============================================================================

/**
 * 클라이언트에서 XML 가져오기 (API 경유 또는 정적 파일 fallback)
 *
 * @param xmlPath XML 파일 경로
 * @returns XML 파일 내용
 */
export async function fetchXmlForClient(xmlPath: string): Promise<string> {
  // 1. API를 통해 캐시된 XML 조회 시도
  try {
    const response = await fetch(
      `/api/scourt/xml-cache?path=${encodeURIComponent(xmlPath)}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.xml_content) {
        return data.xml_content;
      }
    }
  } catch (error) {
    console.warn(`[XML] API cache miss for ${xmlPath}:`, error);
  }

  // 2. Fallback: 정적 파일에서 로드
  try {
    const staticResponse = await fetch(`/scourt-xml/${xmlPath}`);
    if (staticResponse.ok) {
      return await staticResponse.text();
    }
  } catch (error) {
    console.warn(`[XML] Static file fallback failed for ${xmlPath}:`, error);
  }

  throw new Error(`Failed to fetch XML: ${xmlPath}`);
}
