/**
 * SCOURT 필드 렌더링 유틸리티
 *
 * - 필드 키 → 한글 라벨 매핑
 * - 값이 있는 필드만 동적으로 필터링
 * - 날짜 포맷팅
 *
 * 참고: docs/scourt-field-mapping.md
 */

/**
 * SCOURT API 필드명 → 한글 라벨 매핑
 * 실제 API 응답의 필드명을 UI에 표시할 라벨로 변환
 */
export const API_FIELD_LABELS: Record<string, string> = {
  // 기본 정보
  cortNm: '법원',
  userCsNo: '사건번호',
  csNo: '사건번호(내부)',
  csNm: '사건명',
  jdbnNm: '재판부',
  jdbnTelno: '재판부전화번호',
  telNo: '전화번호',

  // 당사자 - API 필드명
  rprsClmntNm: '원고',
  rprsAcsdNm: '피고',
  rprsPtnrNm: '채권자',
  rprsRqstrNm: '채무자',
  rprsAplcntNm: '신청인',
  rprsRspndnNm: '상대방',
  btprtNm: '피고인명',
  thrdDbtrNm: '제3채무자',
  rprsGrnshNm: '압류채권자',
  titRprsPtnr: '원고측라벨',
  titRprsRqstr: '피고측라벨',

  // 일자 필드 - API 필드명
  csRcptYmd: '접수일',
  csUltmtYmd: '종국일',
  csCfmtnYmd: '확정일',
  adjdocRchYmd: '판결도달일',
  aplYmd: '상소일',
  aplRjctnYmd: '상소각하일',
  dcsnstDlvrYmd: '결정송달일',
  prwcChgYmd: '절차변경일',

  // 회생/파산 일자
  csCmdcYmd: '개시결정일',
  crdtrDdlnYmd: '채권이의마감일',
  repayKjDay: '변제계획안인가일',

  // 결과/상태
  csUltmtDvsNm: '종국결과',
  csUltmtDtlCtt: '종국상세',
  csPrsrvYn: '보존여부',

  // 금액
  stmpAtchAmt: '인지액',
  clmntVsml: '원고소가',
  acsdVsml: '피고소가',
  csClmAmt: '청구금액',

  // 구분
  csTkpDvsNm: '수리구분',
  csTkpDvsCdNm: '수리구분',
  csMrgTypNm: '병합구분',

  // 형사 전용
  prsctrCsNoLstCtt: '검찰사건번호',
  btprtUltmtThrstCtt: '선고형량',
  acsApelPrpndYmd: '피고인상소일',
  aplPrpndRsltYmd: '상소결과일',

  // 회생 전용
  rhblCmsnrNm: '회생위원',
  rhblCmsnrTelno: '회생위원전화번호',

  // 당사자 수
  clmntCnt: '원고수',
  acsdCnt: '피고수',
  ptnrCnt: '채권자수',
  rqstrCnt: '채무자수',
  grnshCnt: '피압류자수',
  prwlCnt: '관계인수',

  // 재판부/법원 상세
  ultmtJdbnNm: '종국재판부',
  jdbnTphnGdncCtt: '재판부안내',
  cortCd: '법원코드',
  jdbnCd: '재판부코드',

  // 형사 전용 추가
  acsFullNm: '피고인성명',
  acsdDvsNm: '피고인구분',
  crmcsRcptDvsCdNm: '수리구분',
  crmcsUltmtDvsNm: '형사종국결과',
  btprtUltmtYmd: '피고인종국일',
  btprtCfmtnYmd: '피고인확정일',
  btprtUltmtDvsCd: '피고인종국구분',
  prstrNm: '검사명',
  aplPrpndRsltNm: '상소결과',
  rcrdSndYmd: '기록송부일',

  // 가사 전용 추가
  cfupMarkNm: '담당기호',
  csDstrtYn: '분산여부',
  aplRcrdSndYmd: '상소기록송부일',
  prsvCtt: '보존내용',
  rcrdPrsrvTkovYmd: '기록보존인수일',

  // 신청 전용
  aplyCsNmCd: '신청사건명코드',
  clmAmtCrnyNm: '청구금액통화',
  scrtyKndCd: '담보종류',
  dlvrblFlag: '송달가능여부',

  // 기타 상태 플래그
  amtYn: '금액유무',
  csMrgTypCd: '병합유형코드',
  csTkpDvsCd: '수리구분코드',
  lwstDvsCd: '심급구분코드',
  dxdyRqrdSchdTimeRlsYn: '기일시간공개여부',
  vdeoJdcpcProgYn: '영상재판진행여부',
  isHrngProgCurst: '심리진행현황여부',
  intgInscrtMtjrCd: '통합불복주요코드',
  elctnDplCsYn: '전자중복사건여부',
  enbncCsDsgnYn: '대법원지정여부',
  prwcCsYn: '관계인사건여부',
  prwcRmvYn: '관계인삭제여부',
  ultmtIndctYn: '종국표시여부',
  jdbnDstrtYn: '재판부분산여부',
};

/**
 * SCOURT 스크래퍼 필드 키 → 한글 라벨 매핑
 * progress-scraper.ts에서 저장하는 형식 기준 (한글 키)
 */
export const FIELD_LABELS: Record<string, string> = {
  // 기본 정보 (한글 키)
  법원: '법원',
  사건번호: '사건번호',
  사건명: '사건명',
  재판부: '재판부',
  접수일: '접수일',
  심급: '심급',
  재판부전화번호: '재판부전화번호',
  전화번호: '전화번호',

  // 당사자 - 사건유형별 다양한 라벨
  원고: '원고',
  피고: '피고',
  채권자: '채권자',
  채무자: '채무자',
  신청인: '신청인',
  피신청인: '피신청인',
  피고인명: '피고인명',
  항고인: '항고인',
  상대방: '상대방',
  청구인: '청구인',
  제3채무자: '제3채무자',
  압류채권자: '압류채권자',
  // 보호사건 전용
  조사관명: '조사관명',
  행위자명: '행위자명',
  보호소년명: '보호소년명',
  // 회생/파산 전용
  회생위원: '회생위원',
  회생위원전화번호: '회생위원전화번호',

  // 결과/상태
  종국결과: '종국결과',
  종국상세: '종국상세',
  종국일: '종국일',
  확정일: '확정일',
  보존여부: '보존여부',
  폐기여부: '폐기여부',
  항고신청결과: '항고신청결과',
  재항고결과: '재항고결과',

  // 금액
  인지액: '인지액',
  청구금액: '청구금액',
  담보내용: '담보내용',
  해제내용: '해제내용',
  원고소가: '원고소가',
  피고소가: '피고소가',

  // 상소
  상소인: '상소인',
  상소일: '상소일',
  판결도달일: '판결도달일',
  상소각하일: '상소각하일',
  결정송달일: '결정송달일',

  // 일자
  신청일: '신청일',
  발송일: '발송일',
  결정일: '결정일',
  인계일: '인계일',
  절차변경일: '절차변경일',
  // 회생/파산 전용 결정일
  개시결정일: '개시결정일',
  채권이의마감일: '채권이의마감일',
  변제계획안인가일: '변제계획안인가일',
  면책결정일: '면책결정일',
  절차폐지결정일: '절차폐지결정일',

  // 구분
  병합구분: '병합구분',
  수리구분: '수리구분',
  형제사건번호: '형제사건번호',
  비고: '비고',

  // 형사 전용
  검찰사건번호: '검찰사건번호',
  선고형량: '선고형량',
  피고인상소일: '피고인상소일',
  상소결과일: '상소결과일',

  // API 필드명도 fallback으로 지원
  ...API_FIELD_LABELS,
};

/**
 * LIST 타입 필드 라벨 매핑
 * progress-scraper.ts에서 저장하는 형식 기준
 */
export const LIST_FIELD_LABELS: Record<string, string> = {
  parties: '당사자',
  representatives: '대리인',
  hearings: '기일',
  progress: '진행내용',
  documents: '제출서류',
  lowerCourt: '하심사건',
  relatedCases: '관련사건',
  // 추가 LIST 타입 (제공필드.csv 기반)
  correctionOrders: '보정명령',
  crimeNames: '죄명내용',
  creditors: '채권자',
  repayments: '변제',
  custodians: '후견인',
  defendants: '피고인',
  collaterals: '담보내용',
  instanceContents: '심급내용',
};

/**
 * LIST 아이템 내부 필드 라벨
 */
export const LIST_ITEM_LABELS: Record<string, string> = {
  // 공통
  구분: '구분',
  일자: '일자',
  시간: '시간',
  내용: '내용',
  결과: '결과',
  장소: '장소',
  이름: '이름',
  법원명: '법원명',
  사건번호: '사건번호',
  사건명: '사건명',
  상태: '상태',
};

/**
 * 표시하지 않을 내부 필드 (메타데이터, 내부 코드 등)
 */
const EXCLUDED_FIELDS = new Set([
  // 시스템 메타데이터
  'caseCategory',
  'caseType',
  'id',
  'legal_case_id',
  'scraped_at',
  'created_at',
  'updated_at',
  // API 내부 코드 (사용자에게 의미 없음)
  'encCsNo',           // 암호화된 사건번호
  'today',             // 오늘 날짜 (시스템용)
  'csDvsCd',           // 사건구분코드
  'lcrtCsNo',          // 하심사건번호 코드
  'crmcsIntgCsNmCd',   // 형사 통합사건명코드
  'crmcsRcptDvsCd',    // 형사 수리구분코드
  'apelCrmcsLwstRltnrDvsCd', // 항소 형사 하심관계코드
  'aplKndCd',          // 상소종류코드
  'aplPrpndRsltCd',    // 상소결과코드
  'btprtCrmcsUltmtDvsCd', // 피고인 형사종국구분코드
  'btprtSeq',          // 피고인 순번
  'clmAmtCrnyCd',      // 청구금액 통화코드
  'prsctrAdjdCrtcpSndYmd', // 검찰 판결등본 송부일
  'stmpRfndAmt',       // 인지 환급액 (보통 0)
]);

export interface VisibleField {
  key: string;
  label: string;
  value: any;
  isDate?: boolean;
}

export interface ListField {
  key: string;
  label: string;
  items: any[];
}

/**
 * 값이 유효한지 확인 (null, undefined, 빈 문자열, '-' 제외)
 */
function isValidValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed !== '-';
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * 날짜 필드인지 확인
 */
function isDateField(key: string): boolean {
  const datePatterns = ['Date', 'date', '일', 'Dt'];
  return datePatterns.some(pattern => key.includes(pattern));
}

/**
 * YYYYMMDD 형식 날짜를 YY.MM.DD로 변환
 */
export function formatDateValue(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // YYYYMMDD 형식
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
  }

  // YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
  }

  // YYYY.MM.DD 형식
  if (/^\d{4}\.\d{2}\.\d{2}/.test(value)) {
    return `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
  }

  return value;
}

/**
 * 값이 있는 기본 필드만 추출
 *
 * @param data - basicInfo 객체
 * @returns 표시할 필드 배열
 */
export function getVisibleFields(data: Record<string, any>): VisibleField[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, value]) => {
      // 제외 필드
      if (EXCLUDED_FIELDS.has(key)) return false;
      // LIST 타입은 별도 처리
      if (key.endsWith('List') || Array.isArray(value)) return false;
      // 객체는 별도 처리 (parties, representatives 등)
      if (typeof value === 'object' && value !== null) return false;
      // 유효한 값만
      return isValidValue(value);
    })
    .map(([key, value]) => {
      const isDate = isDateField(key);
      return {
        key,
        label: FIELD_LABELS[key] || key,
        value: isDate ? formatDateValue(String(value)) : value,
        isDate,
      };
    });
}

/**
 * LIST 타입 필드 추출
 *
 * @param data - basicInfo 객체
 * @returns LIST 필드 배열
 */
export function getListFields(data: Record<string, any>): ListField[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, value]) => {
      // LIST 타입이거나 배열인 경우
      return (key.endsWith('List') || Array.isArray(value)) &&
             Array.isArray(value) &&
             value.length > 0;
    })
    .map(([key, items]) => ({
      key,
      label: LIST_FIELD_LABELS[key] || key,
      items: items as any[],
    }));
}

/**
 * LIST 아이템 필드 라벨 조회
 */
export function getListItemLabel(key: string): string {
  return LIST_ITEM_LABELS[key] || FIELD_LABELS[key] || key;
}

/**
 * 필드 정렬 순서 (우선순위 높은 순)
 * 한글 라벨 + API 필드명 모두 포함 (getVisibleFields에서 키로 사용)
 */
const FIELD_ORDER = [
  // 기본 정보 (한글 + API 필드명)
  '법원', 'cortNm',
  '사건번호', 'userCsNo',
  '사건명', 'csNm',
  '심급',
  '재판부', 'jdbnNm',
  '재판부전화번호', 'jdbnTelno',
  '전화번호', 'telNo',
  // 당사자 (사건유형별 우선순위)
  '원고', 'rprsClmntNm',
  '피고', 'rprsAcsdNm',
  '채권자', 'rprsPtnrNm',
  '채무자', 'rprsRqstrNm',
  '신청인', 'rprsAplcntNm',
  '피신청인',
  '항고인',
  '상대방', 'rprsRspndnNm',
  '청구인',
  '제3채무자', 'thrdDbtrNm',
  '압류채권자', 'rprsGrnshNm',
  '피고인명', 'btprtNm',
  // 회생 전용
  '회생위원', 'rhblCmsnrNm',
  '회생위원전화번호', 'rhblCmsnrTelno',
  // 금액
  '청구금액', 'csClmAmt',
  '인지액', 'stmpAtchAmt',
  '원고소가', 'clmntVsml',
  '피고소가', 'acsdVsml',
  // 결과/상태
  '종국결과', 'csUltmtDvsNm',
  '종국상세', 'csUltmtDtlCtt',
  '항고신청결과',
  '재항고결과',
  '보존여부', 'csPrsrvYn',
  '폐기여부',
  // 형사 전용
  '선고형량', 'btprtUltmtThrstCtt',
  '검찰사건번호', 'prsctrCsNoLstCtt',
  // 일자
  '접수일', 'csRcptYmd',
  '신청일',
  '결정일',
  '발송일',
  '결정송달일', 'dcsnstDlvrYmd',
  '인계일',
  '판결도달일', 'adjdocRchYmd',
  '종국일', 'csUltmtYmd',
  '확정일', 'csCfmtnYmd',
  '상소일', 'aplYmd',
  '상소각하일', 'aplRjctnYmd',
  '피고인상소일', 'acsApelPrpndYmd',
  '상소결과일', 'aplPrpndRsltYmd',
  // 회생/파산 전용
  '개시결정일', 'csCmdcYmd',
  '채권이의마감일', 'crdtrDdlnYmd',
  '변제계획안인가일', 'repayKjDay',
  '면책결정일',
  '절차폐지결정일',
  // 구분
  '수리구분', 'csTkpDvsNm', 'csTkpDvsCdNm',
  '병합구분', 'csMrgTypNm',
  '상소인',
  '형제사건번호',
  '담보내용',
  '해제내용',
  '비고',
];

/**
 * 필드를 우선순위에 따라 정렬
 */
export function sortFields(fields: VisibleField[]): VisibleField[] {
  return [...fields].sort((a, b) => {
    const aIndex = FIELD_ORDER.indexOf(a.key);
    const bIndex = FIELD_ORDER.indexOf(b.key);

    // 둘 다 우선순위 목록에 있으면 순서대로
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    // 하나만 있으면 그것이 우선
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // 둘 다 없으면 알파벳 순
    return a.key.localeCompare(b.key);
  });
}
