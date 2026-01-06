/**
 * SCOURT API 응답 필드 변환 유틸리티
 *
 * 대법원 API 필드명 → UI 필드명 변환을 일관되게 처리
 */

/**
 * 변환된 기일 정보
 */
export interface TransformedHearing {
  date: string;
  time: string;
  type: string;
  location: string;
  result: string;
  // 원본 필드 (테이블 렌더링 호환용)
  trmDt?: string;
  trmHm?: string;
  trmNm?: string;
  trmPntNm?: string;
  rslt?: string;
}

/**
 * 변환된 진행사항 정보
 */
export interface TransformedProgress {
  date: string;
  content: string;
  result: string;
  // SCOURT 진행구분 코드: 0=법원(검정), 1=기일(파랑), 2=명령(녹색), 3=제출(진빨강), 4=송달(주황)
  progCttDvs?: string;
}

/**
 * 변환된 기본정보
 */
export interface TransformedBasicInfo {
  caseNumber: string;
  caseName: string;
  courtName: string;
  plaintiffName: string;
  defendantName: string;
  judgeName?: string;
  caseResult?: string;
  resultDate?: string;
}

/**
 * 기일 데이터 변환 (SCOURT API → UI)
 *
 * SCOURT 필드:
 * - trmDt: 기일일자 (YYYYMMDD)
 * - trmHm: 기일시간 (HHMM)
 * - trmNm: 기일명 (변론기일, 조정기일 등)
 * - trmPntNm: 기일장소
 * - rslt: 결과 (속행, 종결 등)
 */
export function transformHearings(apiHearings: unknown[]): TransformedHearing[] {
  if (!Array.isArray(apiHearings)) {
    return [];
  }

  return apiHearings.map((h: any) => ({
    // 변환된 필드
    date: h.trmDt || h.date || '',
    time: h.trmHm || h.time || '',
    type: h.trmNm || h.type || '',
    location: h.trmPntNm || h.location || '',
    result: h.rslt || h.result || '',
    // 원본 필드 유지 (하위 호환성)
    trmDt: h.trmDt || h.date,
    trmHm: h.trmHm || h.time,
    trmNm: h.trmNm || h.type,
    trmPntNm: h.trmPntNm || h.location,
    rslt: h.rslt || h.result,
  }));
}

/**
 * 진행사항 데이터 변환 (SCOURT API → UI)
 *
 * SCOURT 필드:
 * - prcdDt: 진행일자 (YYYYMMDD)
 * - prcdNm: 진행내용
 * - prcdRslt: 결과
 * - progCttDvs: 진행구분 코드 (0=법원, 1=기일, 2=명령, 3=제출, 4=송달)
 */
export function transformProgress(apiProgress: unknown[]): TransformedProgress[] {
  if (!Array.isArray(apiProgress)) {
    return [];
  }

  return apiProgress.map((p: any) => ({
    date: p.prcdDt || p.date || '',
    content: p.prcdNm || p.content || '',
    result: p.prcdRslt || p.result || '',
    progCttDvs: p.progCttDvs,
  }));
}

/**
 * 기본정보 데이터 변환 (SCOURT API → UI)
 *
 * SCOURT 필드:
 * - csNo: 사건번호
 * - csNm: 사건명
 * - cortNm: 법원명
 * - aplNm: 원고명
 * - rspNm: 피고명
 * - rslt: 종국결과
 * - rsltDt: 종국일자
 */
export function transformBasicInfo(apiInfo: Record<string, any>): TransformedBasicInfo {
  return {
    caseNumber: apiInfo.csNo || '',
    caseName: apiInfo.csNm || '',
    courtName: apiInfo.cortNm || '',
    plaintiffName: apiInfo.aplNm || '',
    defendantName: apiInfo.rspNm || '',
    judgeName: apiInfo.jdgNm || apiInfo.judge,
    caseResult: apiInfo.rslt,
    resultDate: apiInfo.rsltDt,
  };
}

/**
 * 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
 */
export function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) {
    return yyyymmdd || '';
  }
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * 시간 포맷 변환 (HHMM → HH:MM)
 */
export function formatTime(hhmm: string): string {
  if (!hhmm || hhmm.length < 4) {
    return hhmm || '';
  }
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}

/**
 * 기일 날짜+시간을 ISO 형식으로 변환
 */
export function toISODateTime(date: string, time: string): string {
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(time);

  if (!formattedDate) {
    return '';
  }

  if (!formattedTime) {
    return `${formattedDate}T00:00:00+09:00`;
  }

  return `${formattedDate}T${formattedTime}:00+09:00`;
}
