/**
 * SCOURT XML 매핑 정의
 *
 * 사건유형별 필요한 XML 파일 매핑
 * API 응답 데이터를 기반으로 필요한 XML 파일 목록 결정
 */

import { parseCaseNumber } from "./case-number-utils";

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
  | "ssgo105" // 행정신청
  | "ssgo106" // 기타/신청
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
  // 행정신청 (ssgo105) - 신청사건 전용 XML 사용
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
};

// ============================================================================
// 사건유형 판별
// ============================================================================

/**
 * 사건번호에서 사건유형 추정
 *
 * 사건번호 패턴 (SCOURT API 기준):
 * - ssgo101 (민사): 가단, 가합, 가소, 나, 다, 라, 마, 바, 사, 자, 차
 * - ssgo102 (가사): 드단, 드합, 느단, 느합, 므, 머, 으, 즈, 흐
 * - ssgo105 (신청/행정): 아, 구, 카(가압류), 타(가처분), 파(회생)
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

  // 1. 행정/신청 사건 (가장 먼저 체크 - 민사와 구분)
  // 아: 항고/재항고, 구: 행정, 카: 가압류, 타: 가처분, 파: 회생/파산
  if (/^(아|구단|구합|구|카|타|파|하)/.test(caseCode)) {
    return "ssgo105";
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
    const xmlPath = mapping[key as DataListId];
    if (xmlPath) {
      required.push(xmlPath);
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
};

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
