/**
 * SCOURT XML 매핑 정의
 *
 * 사건유형별 필요한 XML 파일 매핑
 * API 응답 데이터를 기반으로 필요한 XML 파일 목록 결정
 */

import { parseCaseNumber } from "./case-number-utils";
import {
  getCaseCategoryByTypeName,
  getCaseTypeCodeByName,
  getCaseTypeInfoByCode,
  type CaseTypeInfo,
} from "./case-type-codes";

// ============================================================================
// 사건유형별 XML 매핑
// ============================================================================

/**
 * 사건유형 코드
 * SCOURT URL 패턴에서 추출: /ssgo/ui/ssgo102/... → ssgo102
 */
export type ScourtCaseType =
  | "ssgo101" // 민사
  | "ssgo102" // 가사
  | "ssgo105" // 신청/보전 (행정신청 포함)
  | "ssgo106" // 기타/신청
  | "ssgo107" // 회생/파산
  | "ssgo10a" // 집행
  | "ssgo10c" // 전자독촉/지급명령
  | "ssgo108" // 항고/재항고
  | "ssgo10i" // 보호
  | "ssgo10g"; // 형사

/**
 * 데이터 리스트 ID (API 응답 키)
 */
export type DataListId =
  | "basic_info" // 기본정보 (항상 필수)
  | "dlt_btprtCttLst" // 당사자
  | "dlt_agntCttLst" // 대리인
  | "dlt_atrnyCttLst" // 변호인 (형사)
  | "dlt_rcntDxdyLst" // 최근기일
  | "dlt_rcntSbmsnDocmtLst" // 제출서류
  | "dlt_reltCsLst" // 관련사건
  | "dlt_inscrtDtsLst" // 심급내용
  | "dlt_hrngProgCurst" // 심리진행현황 (형사)
  | "dlt_acsCttLst" // 피고인/죄명 (형사)
  | "dlt_mergeCttLst" // 병합사건
  | "dlt_gurdnCttLst"; // 후견인 (가사)

/**
 * dataList ID 별칭 (API 응답 키 → 표준 key)
 */
export const DATA_LIST_ALIASES: Record<string, DataListId> = {
  dlt_btprLst: "dlt_btprtCttLst",
  dlt_agntLst: "dlt_agntCttLst",
};

const DATA_LIST_ID_LOOKUP: Record<DataListId, true> = {
  basic_info: true,
  dlt_btprtCttLst: true,
  dlt_agntCttLst: true,
  dlt_atrnyCttLst: true,
  dlt_rcntDxdyLst: true,
  dlt_rcntSbmsnDocmtLst: true,
  dlt_reltCsLst: true,
  dlt_inscrtDtsLst: true,
  dlt_hrngProgCurst: true,
  dlt_acsCttLst: true,
  dlt_mergeCttLst: true,
  dlt_gurdnCttLst: true,
};

/**
 * dataList ID 정규화 (alias → canonical)
 */
export function normalizeDataListId(dataListId: string): string {
  return DATA_LIST_ALIASES[dataListId] || dataListId;
}

/**
 * 표준 dataList ID 여부 확인
 */
export function isKnownDataListId(dataListId: string): dataListId is DataListId {
  return !!(DATA_LIST_ID_LOOKUP as Record<string, true>)[dataListId];
}

// ============================================================================
// 템플릿 ID 추출 (SCOURT API 응답)
// ============================================================================

const TEMPLATE_ID_REGEX = /SSGO[0-9A-Z]{3,}F[0-9A-Z]{2}/i;
const TEMPLATE_KEY_REGEX = /^(scrnId|pgmId|screenId|programId)$/i;

function normalizeTemplateId(value: string): string | null {
  const match = value.match(TEMPLATE_ID_REGEX);
  return match ? match[0].toUpperCase() : null;
}

function findTemplateIdDeep(value: unknown, depth: number): string | null {
  if (depth < 0 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return normalizeTemplateId(value);
  }
  if (typeof value !== 'object') return null;

  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, item] of entries) {
    if (TEMPLATE_KEY_REGEX.test(key) && typeof item === 'string') {
      const normalized = normalizeTemplateId(item);
      if (normalized) return normalized;
    }
  }

  for (const [, item] of entries) {
    const normalized = findTemplateIdDeep(item, depth - 1);
    if (normalized) return normalized;
  }

  return null;
}

export function extractTemplateIdFromResponse(
  apiResponse?: Record<string, unknown>
): string | null {
  if (!apiResponse || typeof apiResponse !== 'object') return null;
  return findTemplateIdDeep(apiResponse, 3);
}

export function templateIdToXmlPath(templateId: string): string | null {
  const normalized = normalizeTemplateId(templateId);
  if (!normalized || normalized.length < 7) return null;
  const folder = normalized.slice(0, 7).toLowerCase();
  return `${folder}/${normalized}.xml`;
}

function isBasicInfoTemplateId(templateId: string): boolean {
  return /F01$/i.test(templateId);
}

export function detectCaseTypeFromTemplateId(
  templateId: string
): ScourtCaseType | null {
  const normalized = normalizeTemplateId(templateId);
  if (!normalized || normalized.length < 7) return null;
  const prefix = normalized.slice(0, 7).toLowerCase();
  if ((CASE_TYPE_XML_MAP as Record<string, unknown>)[prefix]) {
    return prefix as ScourtCaseType;
  }
  return null;
}

export function getApiDataFromResponse(
  apiResponse: Record<string, unknown>
): Record<string, unknown> {
  const dataCandidate = (apiResponse as { data?: Record<string, unknown> }).data;
  if (dataCandidate && typeof dataCandidate === 'object') {
    return dataCandidate;
  }
  return apiResponse;
}

export function resolveBasicInfoXmlPath(params: {
  caseType: ScourtCaseType;
  apiResponse?: Record<string, unknown>;
  templateId?: string | null;
}): string | null {
  const templateId =
    params.templateId || extractTemplateIdFromResponse(params.apiResponse);
  const templatePath = templateId ? templateIdToXmlPath(templateId) : null;
  if (templateId && templatePath && isBasicInfoTemplateId(templateId)) {
    return templatePath;
  }
  return CASE_TYPE_XML_MAP[params.caseType]?.basic_info || null;
}

// ============================================================================
// 데이터 리스트 XML 경로 선택
// ============================================================================

const INSOLVENCY_PARTY_WITH_ULTMT_CODES = new Set(["253", "254", "255", "290"]);
const APPEAL_CASE_TYPES = new Set([
  "스",
  "브",
  "그",
  "재스",
  "재브",
  "재그",
  "준재스",
  "준재브",
  "준재그",
]);
const ADMIN_APPLICATION_CASE_TYPES = new Set(["아", "재아", "준재아"]);

/**
 * dataList ID에 대한 XML 경로 결정
 */
export function resolveDataListXmlPath(params: {
  caseType: ScourtCaseType;
  dataListId: string;
  apiData?: Record<string, unknown>;
  dynamicPaths?: Record<string, string>;
}): string | null {
  const normalizedId = normalizeDataListId(params.dataListId);

  if (params.caseType === "ssgo107" && normalizedId === "dlt_btprtCttLst") {
    const source =
      ((params.apiData?.dma_csBasCtt ||
        params.apiData?.dma_csBsCtt ||
        params.apiData?.dma_gnrlCtt ||
        params.apiData) as Record<string, any>) || {};
    const code = getCaseTypeCodeFromData(source);
    if (code && INSOLVENCY_PARTY_WITH_ULTMT_CODES.has(code)) {
      return "ssgo003/SSGO003F64.xml";
    }
    return "ssgo003/SSGO003F63.xml";
  }

  return (
    params.dynamicPaths?.[normalizedId] ||
    CASE_TYPE_XML_MAP[params.caseType]?.[normalizedId as DataListId] ||
    null
  );
}

/**
 * 사건유형별 XML 파일 매핑
 * key: 사건유형 코드
 * value: 데이터 리스트 ID → XML 파일 경로
 *
 * 일부 데이터 리스트는 특정 사건유형에만 존재함
 */
export const CASE_TYPE_XML_MAP: Record<
  ScourtCaseType,
  Partial<Record<DataListId, string>>
> = {
  // 가사 (ssgo102)
  ssgo102: {
    basic_info: "ssgo102/SSGO102F01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F61.xml", // 당사자(가사용)
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml", // 대리인
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml", // 최근기일
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml", // 제출서류
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml", // 관련사건
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml", // 심급내용
    dlt_gurdnCttLst: "ssgo003/SSGO003F90.xml", // 후견인(가사)
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml", // 심리진행현황(상고심 등)
  },
  // 민사 (ssgo101)
  ssgo101: {
    basic_info: "ssgo101/SSGO101F01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F60.xml", // 당사자(민사용)
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml", // 심리진행현황(상고심 등)
  },
  // 신청/보전 (ssgo105) - 신청사건 전용 XML 사용 (행정신청 포함)
  ssgo105: {
    basic_info: "ssgo105/SSGO105F01.xml", // 신청사건 일반내용 조회
    dlt_btprtCttLst: "ssgo003/SSGO003F63.xml", // 당사자(기타용) - 신청인/피신청인
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml",
  },
  // 회생/파산 (ssgo107)
  ssgo107: {
    basic_info: "ssgo107/SSGO107F01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F63.xml", // 당사자(기타용)
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml",
  },
  // 기타/신청 (ssgo106)
  ssgo106: {
    basic_info: "ssgo106/SSGO106F01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F63.xml", // 당사자(기타용)
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml", // 심리진행현황(상고심 등)
  },
  // 형사 (ssgo10g)
  ssgo10g: {
    basic_info: "ssgo10g/SSGO10GF01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F6C.xml", // 당사자(형사용) - F6C
    dlt_acsCttLst: "ssgo003/SSGO003F6B.xml", // 피고인/죄명(형사) - F6B
    dlt_atrnyCttLst: "ssgo003/SSGO003F71.xml", // 변호인(형사)
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml", // 심리진행현황(형사)
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    // dlt_mergeCttLst: XML 파일 미확인 - FallbackGridTable로 처리
  },
  // 집행 (ssgo10a)
  ssgo10a: {
    basic_info: "ssgo10a/SSGO10AF01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F62.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
  },
  // 전자독촉/지급명령 (ssgo10c)
  ssgo10c: {
    basic_info: "ssgo10c/SSGO10CF01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F67.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
  },
  // 항고/재항고 (ssgo108)
  ssgo108: {
    basic_info: "ssgo108/SSGO108F01.xml",
    dlt_btprtCttLst: "ssgo003/SSGO003F65.xml",
    dlt_agntCttLst: "ssgo003/SSGO003F70.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
    dlt_inscrtDtsLst: "ssgo003/SSGO003F10.xml",
    dlt_hrngProgCurst: "ssgo003/SSGO003F20.xml",
    dlt_gurdnCttLst: "ssgo003/SSGO003F90.xml",
  },
  // 보호 (ssgo10i)
  ssgo10i: {
    basic_info: "ssgo10i/SSGO10IF01.xml",
    dlt_rcntDxdyLst: "ssgo003/SSGO003F32.xml",
    dlt_rcntSbmsnDocmtLst: "ssgo003/SSGO003F40.xml",
    dlt_reltCsLst: "ssgo003/SSGO003F50.xml",
  },
};

/**
 * dataList별 XML 후보 (매칭 보강용)
 */
export const DATA_LIST_XML_CANDIDATES: Record<string, string[]> = {
  dlt_rcntDxdyLst: [
    "ssgo003/SSGO003F30.xml",
    "ssgo003/SSGO003F32.xml",
  ],
  dlt_inscrtDtsLst: [
    "ssgo003/SSGO003F10.xml",
    "ssgo003/SSGO003F11.xml",
  ],
  dlt_btprtCttLst: [
    "ssgo003/SSGO003F60.xml", // 민사
    "ssgo003/SSGO003F61.xml", // 가사
    "ssgo003/SSGO003F62.xml", // 집행
    "ssgo003/SSGO003F63.xml", // 기타/신청/집행/회생(결정문송달일)
    "ssgo003/SSGO003F64.xml", // 회생/파산(종국결과)
    "ssgo003/SSGO003F65.xml", // 항고/재항고
    "ssgo003/SSGO003F66.xml", // 기타 단순
    "ssgo003/SSGO003F67.xml", // 전자독촉
    "ssgo003/SSGO003F6C.xml", // 형사
  ],
  dlt_acsCttLst: [
    "ssgo003/SSGO003F6A.xml",
    "ssgo003/SSGO003F6B.xml",
    "ssgo003/SSGO003F68.xml",
  ],
  dlt_actorCttLst: ["ssgo003/SSGO003F69.xml"],
  dlt_lwstRltnrCttLst: ["ssgo003/SSGO003F80.xml"],
  dlt_prtctDspsLst: ["ssgo003/SSGO003FG0.xml"],
  dlt_tmprActnLst: ["ssgo003/SSGO003FH0.xml"],
  dlt_csNmLst: ["ssgo003/SSGO003FF0.xml"],
};

// ============================================================================
// 사건유형 판별
// ============================================================================

function resolveCaseTypeFromInfo(info?: CaseTypeInfo): ScourtCaseType | null {
  if (!info) return null;

  const description = info.description || "";
  if (APPEAL_CASE_TYPES.has(info.name)) {
    return "ssgo108";
  }
  if (description.includes("항고") && info.category !== "행정") {
    return "ssgo108";
  }

  switch (info.category) {
    case "비송도산":
      return "ssgo107";
    case "집행":
      return "ssgo10a";
    case "지급명령":
      return "ssgo10c";
    case "보호":
      return "ssgo10i";
    case "감치":
      return "ssgo106";
    case "형사":
      return "ssgo10g";
    case "가사":
      return "ssgo102";
    case "민사":
      return "ssgo101";
    case "행정":
      if (ADMIN_APPLICATION_CASE_TYPES.has(info.name) || description.includes("신청")) {
        return "ssgo105";
      }
      return "ssgo101";
    case "신청":
      return "ssgo105";
    default:
      return null;
  }
}

/**
 * 사건번호에서 사건유형 추정
 *
 * 사건번호 패턴 (SCOURT API 기준):
 * - ssgo101 (민사): 가단, 가합, 가소, 나, 다, 라, 마, 바, 사, 자, 차
 * - ssgo102 (가사): 드단, 드합, 느단, 느합, 므, 머, 으, 즈, 흐
 * - ssgo105 (신청/보전): 아(행정신청), 카(가압류), 타(가처분)
 * - ssgo106 (기타): 거, 버, 서, 어, 저, 처
 * - ssgo10g (형사): 고단, 고합, 고정, 노, 도, 로, 모, 소, 조, 초
 *
 * 주의:
 * - 카/타/파: 민사 신청사건 → ssgo105 (가압류, 가처분, 회생 등)
 * - 브/스: 가정보호/소년보호 → ssgo102 (보호사건도 가사로 분류)
 * - 보: 형사가 아닌 보호사건일 수 있음 → 문맥에 따라 다름
 */
export function detectCaseTypeFromCaseNumber(
  caseNumber: string
): ScourtCaseType {
  // 공통 유틸리티로 사건번호 파싱
  const parsed = parseCaseNumber(caseNumber);
  if (!parsed.valid) return "ssgo102"; // 기본값: 가사

  const caseCode = parsed.caseType;
  const caseTypeCode = getCaseTypeCodeByName(caseCode);
  const caseTypeInfo = caseTypeCode ? getCaseTypeInfoByCode(caseTypeCode) : undefined;
  const caseTypeFromInfo = resolveCaseTypeFromInfo(caseTypeInfo);
  if (caseTypeFromInfo) {
    return caseTypeFromInfo;
  }

  // 0. 사건유형 카테고리 기반 우선 판별 (회생/파산 포함)
  const category = getCaseCategoryByTypeName(caseCode);
  if (category === "비송도산") {
    return "ssgo107";
  }
  if (category === "집행") {
    return "ssgo10a";
  }
  if (category === "지급명령") {
    return "ssgo10c";
  }
  if (category === "보호") {
    return "ssgo10i";
  }
  if (category === "감치") {
    return "ssgo106";
  }

  // 1. 신청/보전 사건 (ssgo105)
  if (/^(재|준재)?아/.test(caseCode) || /^(카|타)/.test(caseCode)) {
    return "ssgo105";
  }

  // 1-1. 행정 본안/항고 사건 → ssgo101 (민사 엔드포인트 사용)
  if (/^(재|준재)?(구단|구합|구|누|두|루|무|부|사)/.test(caseCode)) {
    return "ssgo101";
  }

  // 2. 가사 사건 (드, 느, 므 등)
  // 브: 가정보호, 스: 소년보호 - 보호사건도 가사로 분류
  if (/^(드단|드합|드|느단|느합|느|므|머|브|스|으|즈|흐)/.test(caseCode)) {
    return "ssgo102";
  }

  // 3. 형사 사건 (고, 노 등)
  // 보: 형사에서는 보호관찰 등, 소: 소년형사
  if (/^(고단|고합|고정|고약|고|노|도|로|모|보|소|오|조|초)/.test(caseCode)) {
    return "ssgo10g";
  }

  // 4. 민사 사건 (가, 나, 다 등)
  if (/^(가단|가합|가소|가|나|다|라|마|바|사|자|차)/.test(caseCode)) {
    return "ssgo101";
  }

  // 5. 기타 사건
  if (/^(거|버|서|어|저|처)/.test(caseCode)) {
    return "ssgo106";
  }

  // 기본값
  return "ssgo102";
}

// ============================================================================
// API 응답 기반 사건유형 판별
// ============================================================================

/**
 * 일반내용 API 응답에서 사건유형 추정
 *
 * - userCsNo/csNo가 있으면 사건번호 기반으로 판별
 * - csDvsNm이 있으면 사건유형명 기반으로 판별
 */
export function detectCaseTypeFromApiResponse(
  apiResponse: Record<string, unknown>
): ScourtCaseType | null {
  if (!apiResponse || typeof apiResponse !== "object") return null;

  const data = (apiResponse as { data?: Record<string, unknown> }).data || apiResponse;
  const caseInfo = (data as Record<string, unknown>)?.dma_csBasCtt ||
    (data as Record<string, unknown>)?.dma_csBsCtt ||
    (data as Record<string, unknown>)?.dma_gnrlCtt ||
    data;

  if (!caseInfo || typeof caseInfo !== "object") return null;

  const csDvsCd = (caseInfo as { csDvsCd?: string }).csDvsCd;
  if (csDvsCd && /^\d{3}$/.test(csDvsCd)) {
    const info = getCaseTypeInfoByCode(csDvsCd);
    const detected = resolveCaseTypeFromInfo(info);
    if (detected) return detected;
  }

  const userCsNo = (caseInfo as { userCsNo?: string; csNo?: string }).userCsNo ||
    (caseInfo as { csNo?: string }).csNo;
  if (userCsNo && /[가-힣]/.test(userCsNo)) {
    return detectCaseTypeFromCaseNumber(userCsNo);
  }

  const csDvsNm = (caseInfo as { csDvsNm?: string; csDvsCdNm?: string; csDvsName?: string }).csDvsNm ||
    (caseInfo as { csDvsCdNm?: string }).csDvsCdNm ||
    (caseInfo as { csDvsName?: string }).csDvsName;

  if (csDvsNm) {
    const category = getCaseCategoryByTypeName(csDvsNm);
    if (category === "비송도산") {
      return "ssgo107";
    }
    const code = getCaseTypeCodeByName(csDvsNm);
    const info = code ? getCaseTypeInfoByCode(code) : undefined;
    const detected = resolveCaseTypeFromInfo(info);
    if (detected) return detected;
    return detectCaseTypeFromCaseNumber(`2000${csDvsNm}1`);
  }

  return null;
}

// ============================================================================
// 필요한 XML 목록 결정
// ============================================================================

/**
 * API 응답에서 필요한 XML 파일 목록 추출
 *
 * @param caseType 사건유형 코드
 * @param apiResponse SCOURT API 응답 데이터
 * @returns 필요한 XML 파일 경로 배열
 */
export function getRequiredXmlFiles(
  caseType: ScourtCaseType,
  apiResponse: Record<string, unknown>
): string[] {
  const mapping = CASE_TYPE_XML_MAP[caseType];
  if (!mapping) {
    console.warn(`Unknown case type: ${caseType}, using ssgo102 as default`);
    return getRequiredXmlFiles("ssgo102", apiResponse);
  }

  const required: string[] = [];

  // 기본정보는 항상 필수
  if (mapping.basic_info) {
    required.push(mapping.basic_info);
  }

  // API 응답에서 dlt_* 키 동적 감지하여 해당 XML 추가
  const dataListKeys = Object.keys(apiResponse).filter(
    (key) => key.startsWith("dlt_") && hasData(apiResponse[key])
  );

  for (const key of dataListKeys) {
    const normalizedKey = normalizeDataListId(key);
    if (isKnownDataListId(normalizedKey)) {
      const xmlPath = mapping[normalizedKey];
      if (xmlPath) {
        required.push(xmlPath);
      }
    }
  }

  // 중복 제거
  return [...new Set(required)];
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

/**
 * XML 파일 경로에서 데이터 리스트 ID 추출
 */
export function getDataListIdFromXmlPath(xmlPath: string): DataListId | null {
  for (const [caseType, mapping] of Object.entries(CASE_TYPE_XML_MAP)) {
    for (const [dataListId, path] of Object.entries(mapping)) {
      if (path === xmlPath) {
        return dataListId as DataListId;
      }
    }
  }
  return null;
}

// ============================================================================
// Expression 규칙 (XML JavaScript 로직 재현)
// ============================================================================

/**
 * expression 컬럼에서 조합할 필드 목록
 *
 * XML의 JavaScript 함수를 분석하여 필드 조합 규칙 정의
 * - XML 자체는 그대로 파싱
 * - JavaScript 로직만 여기서 별도 정의
 *
 * 새로운 expression 패턴 발견시 여기에 추가
 */
export const EXPRESSION_RULES: Record<string, string[]> = {
  // 심리진행현황: "내용" = progDvsNm + progDts + progRslt
  // scwin.setCttappltHrngProgLst() 함수 참고
  dlt_hrngProgCurst: ["progDvsNm", "progDts", "progRslt"],

  // 심급내용: "결과" = ultmtYmd + ultmtDvsNm
  // scwin.setCttRcntDxdyLst() 함수 참고
  dlt_inscrtDtsLst: ["ultmtYmd", "ultmtDvsNm"],

  // 제출서류: "내용" = content1 + content2 + content3
  // scwin.setExpressOfdocCtt() 함수 참고
  dlt_rcntSbmsnDocmtLst: ["content1", "content2", "content3"],
};

/**
 * 데이터 리스트의 expression 필드 조합 규칙 조회
 */
export function getExpressionFields(dataListId: string): string[] | null {
  return EXPRESSION_RULES[dataListId] || null;
}

// ============================================================================
// View 필드 매핑 규칙
// ============================================================================

/**
 * View 필드 → 원본 필드 매핑
 *
 * SCOURT의 JavaScript가 생성하는 xxxView 필드는 API에 없음
 * 원본 필드를 찾아서 포맷팅하여 표시
 *
 * 예: btprtCfmtnYmdView → btprtCfmtnYmd (날짜 포맷 적용)
 */
export const VIEW_FIELD_MAPPINGS: Record<
  string,
  { sourceField: string; format?: string }
> = {
  // 피고인 및 죄명내용: 확정일 표시
  // SCOURT에서는 체크박스로 제어하지만, 우리는 항상 표시
  btprtCfmtnYmdView: {
    sourceField: "btprtCfmtnYmd",
    format: "####.##.##",
  },
};

/**
 * View 필드에 대한 원본 필드 매핑 조회
 */
export function getViewFieldMapping(
  fieldId: string
): { sourceField: string; format?: string } | null {
  return VIEW_FIELD_MAPPINGS[fieldId] || null;
}

// ============================================================================
// 행 표시 조건 규칙
// ============================================================================

/**
 * 행 표시 조건 (Row Visibility Rules)
 *
 * XML의 JavaScript 로직 (tr.show()/tr.hide())을 재현
 * key: 행 ID (XML의 tr id 속성)
 * value: 조건 함수 (true면 표시, false면 숨김)
 *
 * 예:
 * - tr_aplPrpndCtt: 대법원(cortCd=000100)이 아닐 때만 상소제기내용 표시
 * - tr_prsvCtt: prsvCtt 값이 있을 때만 보존/폐기 여부 표시
 */
export const ROW_VISIBILITY_RULES: Record<
  string,
  (data: Record<string, any>) => boolean
> = {
  // 상소제기내용: 대법원(000100)이 아닐 때만 표시
  // XML 로직: if("000100" !== dma_csBasCtt.get("cortCd")) { tr_aplPrpndCtt.show(""); }
  tr_aplPrpndCtt: (data) => data.cortCd !== "000100",

  // 보존여부/폐기여부: prsvCtt 값이 있을 때만 표시
  // XML 로직: if(!scutilo.isEmpty(dma_csBasCtt.get("prsvCtt"))) { tr_prsvCtt.show(""); }
  tr_prsvCtt: (data) =>
    data.prsvCtt !== null &&
    data.prsvCtt !== undefined &&
    data.prsvCtt !== "",

  // 재판부 (가사조사관 있을 때): exmnrNm이 있으면 표시
  // XML 로직: if(!scutilo.isEmpty(exmnrNm)) { tr_jdbnUp.show(""); }
  tr_jdbnUp: (data) =>
    data.exmnrNm !== null &&
    data.exmnrNm !== undefined &&
    data.exmnrNm !== "",

  // 재판부 (가사조사관 없을 때): exmnrNm이 없으면 표시
  // XML 로직: if(scutilo.isEmpty(exmnrNm)) { tr_jdbnDw.show(""); }
  tr_jdbnDw: (data) =>
    data.exmnrNm === null ||
    data.exmnrNm === undefined ||
    data.exmnrNm === "",

  // 회생/파산(SSGO107) 기본내용 행 토글
  tr_dvs1_1: (data) => isInsolvencyDvs1(data),
  tr_dvs1_2: (data) => isInsolvencyDvs1(data),
  tr_dvs1_3: (data) => isInsolvencyDvs1(data),
  tr_dvs1_4: (data) => isInsolvencyDvs1(data),
  tr_dvs1_5: (data) => isInsolvencyDvs1(data),
  tr_dvs2_1: (data) => isInsolvencyDvs2(data),
  tr_dvs2_2: (data) => isInsolvencyDvs2(data),
  tr_dvs2_3: (data) => isInsolvencyDvs2(data),
  tr_dvs3_1: (data) => isInsolvencyDvs3(data),
  tr_dvs3_2: (data) => isInsolvencyDvs3(data),
  tr_dvs3_3: (data) => isInsolvencyDvs3(data),
  // 변제현황조회는 개회(253) + amtYn !== 'Y'일 때만 표시
  tr_lqdtCurstInq: (data) =>
    data.amtYn !== "Y" && isInsolvencyDvs1(data),
};

const INSOLVENCY_DVS1_CODES = new Set(["253"]); // 개회
const INSOLVENCY_DVS2_CODES = new Set(["254", "255", "290"]); // 개확/개보/개기

function getCaseTypeCodeFromData(data: Record<string, any>): string | null {
  const csNoValue = data.csNo;
  const csNo = typeof csNoValue === "number" ? String(csNoValue) : csNoValue;
  if (typeof csNo === "string" && /^\d{14}$/.test(csNo)) {
    return csNo.substring(4, 7);
  }

  const csDvsCdValue = data.csDvsCd;
  const csDvsCd = typeof csDvsCdValue === "number" ? String(csDvsCdValue) : csDvsCdValue;
  if (typeof csDvsCd === "string" && /^\d{3}$/.test(csDvsCd)) {
    return csDvsCd;
  }

  const userCsNo = data.userCsNo;
  if (typeof userCsNo === "string") {
    const parsed = parseCaseNumber(userCsNo);
    if (parsed.valid) {
      const code = getCaseTypeCodeByName(parsed.caseType);
      if (code) return code;
    }
  }

  const csDvsNm =
    data.csDvsNm || data.csDvsCdNm || data.csDvsName || null;
  if (typeof csDvsNm === "string") {
    const code = getCaseTypeCodeByName(csDvsNm);
    if (code) return code;
  }

  return null;
}

function isInsolvencyDvs1(data: Record<string, any>): boolean {
  const code = getCaseTypeCodeFromData(data);
  return code ? INSOLVENCY_DVS1_CODES.has(code) : false;
}

function isInsolvencyDvs2(data: Record<string, any>): boolean {
  const code = getCaseTypeCodeFromData(data);
  return code ? INSOLVENCY_DVS2_CODES.has(code) : false;
}

function isInsolvencyDvs3(data: Record<string, any>): boolean {
  const code = getCaseTypeCodeFromData(data);
  if (!code) return false;
  return !INSOLVENCY_DVS1_CODES.has(code) && !INSOLVENCY_DVS2_CODES.has(code);
}

/**
 * 행 표시 여부 확인
 *
 * @param rowId 행 ID (XML의 tr id 속성)
 * @param data API 데이터
 * @returns true면 표시, false면 숨김, null이면 규칙 없음 (항상 표시)
 */
export function checkRowVisibility(
  rowId: string | undefined,
  data: Record<string, any>
): boolean | null {
  if (!rowId) return null; // 규칙 없음 - 항상 표시

  const rule = ROW_VISIBILITY_RULES[rowId];
  if (!rule) return null; // 규칙 없음 - 항상 표시

  return rule(data);
}
