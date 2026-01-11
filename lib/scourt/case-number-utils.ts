/**
 * 사건번호 정규화 및 파싱 유틸리티
 *
 * SCOURT API 호출 전 사건번호를 표준화하여 검색 실패를 줄임
 */

/**
 * 사건번호에서 법원명 접두사 제거
 *
 * 입력된 사건번호가 "서울가정법원 2024드합12345" 형태인 경우
 * 법원명 부분을 제거하고 순수 사건번호만 반환
 *
 * @example
 * stripCourtPrefix("서울가정법원 2024드합12345") // "2024드합12345"
 * stripCourtPrefix("인천지방법원 2024가단123") // "2024가단123"
 * stripCourtPrefix("서울중앙지방법원부천지원 2024나1234") // "2024나1234"
 * stripCourtPrefix("서울중앙지방법원 부천지원 2024나1234") // "2024나1234"
 * stripCourtPrefix("2024가단12345") // "2024가단12345" (변화 없음)
 */
export function stripCourtPrefix(caseNumber: string): string {
  // 법원명 패턴: 한글로 시작하여 "법원" 또는 "지원"으로 끝나는 부분
  // 여러 번 반복될 수 있음 (예: "서울중앙지방법원 부천지원")
  // 반복적으로 제거하여 모든 법원명/지원 접두사 처리
  let result = caseNumber
  const courtPrefixPattern = /^[가-힣]+(?:법원|지원)\s*/

  // 최대 3번까지 반복 (법원 + 지원 + 추가)
  for (let i = 0; i < 3; i++) {
    const newResult = result.replace(courtPrefixPattern, '').trim()
    if (newResult === result) break  // 더 이상 변화 없으면 종료
    result = newResult
  }

  return result
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
