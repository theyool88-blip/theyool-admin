/**
 * SCOURT XML 공용 유틸
 *
 * 서버 캐싱/클라이언트 렌더링에서 동일 로직 재사용
 */

import { normalizeDataListId } from "./xml-mapping";

/**
 * XML 경로 정규화
 *
 * - "/ui/ssgo003/SSGO003F60.xml" → "ssgo003/SSGO003F60.xml"
 * - "/ssgo/ui/ssgo003/SSGO003F60.xml" → "ssgo003/SSGO003F60.xml"
 * - "ui/ssgo003/SSGO003F60.xml" → "ssgo003/SSGO003F60.xml"
 */
export function normalizeXmlPath(xmlPath: string): string {
  if (!xmlPath) return xmlPath;

  let normalized = xmlPath.trim();

  const uiIndex = normalized.lastIndexOf("/ui/");
  if (uiIndex !== -1) {
    normalized = normalized.slice(uiIndex + 4);
  }

  normalized = normalized.replace(/^\/+/, "");
  normalized = normalized.replace(/^ssgo\/ui\//, "");
  normalized = normalized.replace(/^ui\//, "");

  return normalized;
}

/**
 * 기본정보 XML에서 하위 XML 경로 동적 추출
 *
 * 지원 패턴:
 * 1. JavaScript .setSrc(): wfScrtyCttLst.setSrc("/ui/ssgo003/SSGO003FA0.xml")
 *    - 큰따옴표, 작은따옴표 모두 지원
 * 2. XML wframe src: <w2:wframe id="wfRcntDxdyLst" src="SSGO003F32.xml">
 *    - 속성 순서 무관 (id가 먼저든 src가 먼저든)
 *    - 큰따옴표, 작은따옴표 모두 지원
 */
export function extractSubXmlPaths(basicInfoXml: string): Record<string, string> {
  const result: Record<string, string> = {};

  // 패턴 1: JavaScript .setSrc() 호출
  const jsSrcRegex = /wf(\w+)\.setSrc\([^"']*["']([^"']+\.xml)["']/g;
  let match;
  while ((match = jsSrcRegex.exec(basicInfoXml)) !== null) {
    const varName = match[1];
    const rawPath = match[2];
    const xmlPath = rawPath.startsWith("ssgo") || rawPath.includes("/")
      ? rawPath
      : `ssgo003/${rawPath}`;
    const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;
    result[dataListId] = normalizeXmlPath(xmlPath);
  }

  // 패턴 2: XML wframe src 속성 (속성 순서 무관)
  const wframeRegex = /<w2:wframe\s+([^>]+)>/g;
  while ((match = wframeRegex.exec(basicInfoXml)) !== null) {
    const attrs = match[1];
    const idMatch = attrs.match(/id=["']wf(\w+)["']/);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/);

    if (idMatch && srcMatch) {
      const varName = idMatch[1];
      const xmlFileName = srcMatch[1];
      const dataListId = `dlt_${varName.charAt(0).toLowerCase()}${varName.slice(1)}`;

      // ssgo003/ 경로 prefix 추가 (상대 경로인 경우)
      const xmlPath = xmlFileName.startsWith("ssgo") || xmlFileName.includes("/")
        ? xmlFileName
        : `ssgo003/${xmlFileName}`;
      result[dataListId] = normalizeXmlPath(xmlPath);
    }
  }

  return result;
}

/**
 * dataList alias를 정규화하여 경로 키 보강
 */
export function normalizeDataListPaths(
  paths: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(paths)) {
    const normalizedKey = normalizeDataListId(key);
    const normalizedValue = normalizeXmlPath(value);
    normalized[key] = normalizedValue;
    normalized[normalizedKey] = normalizedValue;
  }

  return normalized;
}
