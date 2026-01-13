/**
 * 사건번호 정규화 및 파싱 유틸리티
 *
 * SCOURT API 호출 전 사건번호를 표준화하여 검색 실패를 줄임
 */

/**
 * 사건번호에서 법원명 접두사 제거
 *
 * 입력된 사건번호가 "서울가정법원 2024드합12345" 또는 "평택지원2023타경864" 형태인 경우
 * 법원명 부분을 제거하고 순수 사건번호만 반환
 *
 * @example
 * stripCourtPrefix("서울가정법원 2024드합12345") // "2024드합12345"
 * stripCourtPrefix("인천지방법원 2024가단123") // "2024가단123"
 * stripCourtPrefix("서울중앙지방법원부천지원 2024나1234") // "2024나1234"
 * stripCourtPrefix("서울중앙지방법원 부천지원 2024나1234") // "2024나1234"
 * stripCourtPrefix("평택지원2023타경864") // "2023타경864" (공백 없는 경우도 처리)
 * stripCourtPrefix("평택가정2024드단25547") // "2024드단25547" (법원/지원 외 패턴)
 * stripCourtPrefix("2024가단12345") // "2024가단12345" (변화 없음)
 */
export function stripCourtPrefix(caseNumber: string): string {
  let result = caseNumber.trim()

  // 1. 기존 패턴: 법원/지원 + 공백
  // "서울가정법원 2024드합12345" → "2024드합12345"
  const courtWithSpacePattern = /^[가-힣]+(?:법원|지원)\s+/

  // 최대 3번까지 반복 (법원 + 지원 + 추가)
  for (let i = 0; i < 3; i++) {
    const newResult = result.replace(courtWithSpacePattern, '').trim()
    if (newResult === result) break
    result = newResult
  }

  // 2. 새 패턴: 법원/지원 뒤에 바로 숫자(연도)가 오는 경우
  // "평택지원2023타경864" → "2023타경864"
  const courtNoSpacePattern = /^[가-힣]+(?:법원|지원)(?=\d{4})/
  result = result.replace(courtNoSpacePattern, '')

  // 3. 일반 한글 접두사 + 숫자 패턴 (법원/지원 외: 평택가정, 수원고법 등)
  // "평택가정2024드단25547" → "2024드단25547"
  // 단, 사건번호 패턴(연도4자리+한글+숫자)이 확인되는 경우만
  const generalCourtPattern = /^[가-힣]+(?=\d{4}[가-힣]+\d+$)/
  result = result.replace(generalCourtPattern, '')

  return result.trim()
}

export interface ParsedCaseNumber {
  /** 원본 사건번호 */
  original: string;
  /** 정규화된 사건번호 (예: 2024가단12345) */
  normalized: string;
  /** 연도 (예: 2024) */
  year: string;
  /** 사건유형 (예: 가단, 드합) */
  caseType: string;
  /** 일련번호 (예: 12345) */
  serial: string;
  /** 파싱 성공 여부 */
  valid: boolean;
}

/**
 * 사건번호 정규화
 *
 * 처리 항목:
 * - 법원명 접두사 제거 (예: "서울가정법원 2024드합12345" → "2024드합12345")
 * - 공백, 하이픈, 괄호, 대괄호 제거
 * - 전각 숫자 → 반각 숫자 변환
 * - 앞뒤 공백 제거
 *
 * @example
 * normalizeCaseNumber("2024 가단 12345") // "2024가단12345"
 * normalizeCaseNumber("2024-가단-12345") // "2024가단12345"
 * normalizeCaseNumber("２０２４가단12345") // "2024가단12345" (전각→반각)
 * normalizeCaseNumber("서울가정법원 2024드합12345") // "2024드합12345" (법원명 제거)
 */
export function normalizeCaseNumber(caseNumber: string): string {
  // 먼저 법원명 접두사 제거
  const stripped = stripCourtPrefix(caseNumber)

  return stripped
    .trim()
    .replace(/[\s\-\(\)\[\]·]/g, '')  // 공백, 하이픈, 괄호, 가운뎃점 제거
    .replace(/[０-９]/g, (c: string) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30)  // 전각숫자→반각
    );
}

/**
 * 사건번호 파싱
 *
 * @example
 * parseCaseNumber("2024가단12345")
 * // { original: "2024가단12345", normalized: "2024가단12345",
 * //   year: "2024", caseType: "가단", serial: "12345", valid: true }
 */
export function parseCaseNumber(caseNumber: string): ParsedCaseNumber {
  const normalized = normalizeCaseNumber(caseNumber);
  const strictPattern = /^(\d{4})([가-힣]+)(\d+)$/;
  const loosePattern = /(\d{4})([가-힣]+)(\d+)/;
  const match = normalized.match(strictPattern) || normalized.match(loosePattern);

  if (!match) {
    return {
      original: caseNumber,
      normalized,
      year: '',
      caseType: '',
      serial: '',
      valid: false,
    };
  }

  return {
    original: caseNumber,
    normalized: match[0],
    year: match[1],
    caseType: match[2],
    serial: match[3],
    valid: true,
  };
}

/**
 * 일련번호 패딩 (SCOURT API용)
 *
 * 일부 API는 7자리 패딩 필요, 일부는 5자리
 *
 * @param serial 일련번호
 * @param length 패딩 길이 (기본 7)
 */
export function padSerial(serial: string, length: number = 7): string {
  return serial.padStart(length, '0');
}

/**
 * SCOURT 내부 사건번호 생성 (csNo 형식)
 *
 * 형식: 연도(4) + 사건유형코드(3) + 일련번호(7, 0패딩)
 * 예: 2024가단12345 → 20240010012345
 *
 * @param year 연도
 * @param caseTypeCode 사건유형 코드 (숫자)
 * @param serial 일련번호
 */
export function buildCsNo(year: string, caseTypeCode: string, serial: string): string {
  return `${year}${caseTypeCode.padStart(3, '0')}${serial.padStart(7, '0')}`;
}

/**
 * 사건번호 유효성 검사
 *
 * @param caseNumber 사건번호
 * @returns 유효하면 true
 */
export function isValidCaseNumber(caseNumber: string): boolean {
  return parseCaseNumber(caseNumber).valid;
}

/**
 * 사건번호 표시용 포맷
 *
 * DB에 저장된 사건번호를 보기 좋게 포맷
 * (현재는 그대로 반환, 필요시 포맷 추가)
 */
export function formatCaseNumber(caseNumber: string): string {
  const parsed = parseCaseNumber(caseNumber);
  if (!parsed.valid) return caseNumber;

  // 일련번호 앞의 불필요한 0 제거
  const serial = parseInt(parsed.serial, 10).toString();
  return `${parsed.year}${parsed.caseType}${serial}`;
}
