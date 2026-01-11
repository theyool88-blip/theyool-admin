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
  stmpRfndAmt: '인지환급액',
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

  // 송달/결과
  dlvrCrtYmd: '송달증명일',
  lastDcsnstDlvrYmd: '최종결정송달일',
  entrsRsltTypNm: '결과유형',
  apalPrpndRsltNm: '상소결과',

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
  // 보호사건 전용 - 가정보호 (동버)
  행위자: '행위자',
  행위자명: '행위자명',
  피해아동: '피해아동',
  피해아동명: '피해아동명',
  보조인: '보조인',
  보조인명: '보조인명',
  // 보호사건 전용 - 소년보호 (푸)
  조사관: '조사관',
  조사관명: '조사관명',
  보호소년: '보호소년',
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
 * SCOURT API dlt_* 테이블명 → 한글 라벨 매핑
 * API 응답의 dlt_* 키를 UI 섹션 제목으로 변환
 */
export const DLT_TABLE_LABELS: Record<string, string> = {
  dlt_btprtCttLst: '당사자',
  dlt_agntCttLst: '대리인',
  dlt_rcntDxdyLst: '최근기일',
  dlt_rcntSbmsnDocmtLst: '최근제출서류',
  dlt_reltCsLst: '관련사건',
  dlt_inscrtDtsLst: '심급내용',
  dlt_crctnOrdLst: '보정명령',
  dlt_scrtyCttLst: '담보내용',
  dlt_gurdnCttLst: '후견인',
  dlt_lwstRltnrCttLst: '소송관계인',
  dlt_aplntCttLst: '항소인',
};

/**
 * dlt_* 테이블 컬럼명 → 한글 라벨 매핑
 */
export const DLT_COLUMN_LABELS: Record<string, string> = {
  // 당사자 테이블 (dlt_btprtCttLst)
  btprtStndngNm: '구분',
  btprtDvsNm: '유형',
  btprtNm: '이름',
  btprtRnk: '순번',
  btprtTelno: '전화번호',
  btprtFaxno: '팩스',
  btprtEmlAddr: '이메일',
  csUltmtDvsNm: '종국결과',
  csUltmtYmd: '종국일',
  dcsnstDlvrYmd: '결정송달일',
  ultmtDvsNm: '종국결과',
  dlvrMthdCd: '송달방법',
  aplntStndngCd: '항소인지위',
  btprtPrsnlDvsCd: '개인법인구분',
  jdcpcAtnTypCd: '소송참가유형',
  prtcpnDvsCd: '참가인구분',

  // 대리인 테이블 (dlt_agntCttLst)
  btprtRltnCtt: '당사자관계',
  agntDvsNm: '대리인유형',
  agntNm: '대리인',
  jdafrCorpNm: '법무법인',
  agntTelno: '전화번호',
  agntFaxno: '팩스',
  agntEmlAddr: '이메일',
  chargLwyrNm: '담당변호사',
  agntIdxNm: '대리인번호',
  agntSeq: '순번',
  allBtprtAgntSeniYn: '전체대리여부',
  seniKndCd: '수임종류',

  // 기일 테이블 (dlt_rcntDxdyLst)
  dxdyYmd: '기일',
  dxdyHm: '시간',
  dxdyKndNm: '종류',
  dxdyPlcNm: '장소',
  dxdyRsltNm: '결과',
  vdeoJdcpcMeansCd: '영상재판',
  dxdyKndCd: '종류코드',
  dxdyRsltCd: '결과코드',

  // 제출서류 테이블 (dlt_rcntSbmsnDocmtLst)
  ofdocRcptYmd: '접수일',
  content1: '제출자구분',
  content2: '제출자',
  content3: '서류명',

  // 관련사건 테이블 (dlt_reltCsLst)
  reltCsCortNm: '법원',
  reltCsDvsNm: '관련구분',
  reltCsNo: '사건번호(내부)',
  reltCsCortCd: '법원코드',
  reltCsDvsCd: '관련구분코드',
  comTaskTypCd: '공통업무유형',
  isLink: '링크여부',

  // 심급내용 테이블 (dlt_inscrtDtsLst)
  cortNm: '법원',
  cortCd: '법원코드',
  userCsNo: '사건번호',
  csNo: '사건번호(내부)',
  encCsNo: '암호화사건번호',
  ultmtYmd: '종국일',
  inscrtCsUltmtDvsCd: '심급종국코드',
  inscrtReltCortCd: '심급관련법원코드',
  inscrtReltCsNo: '심급관련사건번호',
  inscrtReltCsUltmtYmd: '심급관련종국일',

  // 보정명령 테이블 (dlt_crctnOrdLst)
  crctnOrdYmd: '보정명령일',
  crctnRsnNm: '보정사유',
  crctnRsnCd: '보정사유코드',

  // 담보내용 테이블 (dlt_scrtyCttLst)
  scrtyAmt: '담보금액',
  grtInsuCoCd: '보증보험사코드',
  scrtyPvsnCtt: '담보제공내용',
  scrtyStngYmd: '담보설정일',
  prsvDspsScrtyDvsCd: '담보구분코드',
  prsvDspsScrtyDvsNm: '담보구분',
};

/**
 * dlt_* 테이블별 표시할 컬럼 및 순서
 * 정의되지 않은 테이블은 모든 *Nm 컬럼 자동 표시
 */
export const DLT_TABLE_COLUMNS: Record<string, string[]> = {
  dlt_btprtCttLst: ['btprtStndngNm', 'btprtNm', 'csUltmtDvsNm', 'csUltmtYmd', 'dcsnstDlvrYmd'],
  dlt_agntCttLst: ['btprtRltnCtt', 'agntNm', 'jdafrCorpNm', 'chargLwyrNm'],
  dlt_rcntDxdyLst: ['dxdyYmd', 'dxdyHm', 'dxdyKndNm', 'dxdyPlcNm', 'dxdyRsltNm'],
  dlt_rcntSbmsnDocmtLst: ['ofdocRcptYmd', 'content1', 'content2', 'content3'],
  dlt_reltCsLst: ['reltCsCortNm', 'userCsNo', 'reltCsDvsNm'],
  dlt_inscrtDtsLst: ['cortNm', 'userCsNo', 'ultmtDvsNm', 'ultmtYmd'],
  dlt_crctnOrdLst: ['crctnOrdYmd', 'crctnRsnNm'],
  dlt_scrtyCttLst: ['scrtyAmt', 'grtInsuCoCd', 'scrtyPvsnCtt', 'scrtyStngYmd', 'prsvDspsScrtyDvsNm'],
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

/**
 * ============================================================================
 * 규칙 기반 라벨 생성 시스템
 * ============================================================================
 *
 * API 응답 필드명 규칙:
 * - *Nm, *Ctt → 표시할 값 (이름, 내용)
 * - *Cd → 코드 (숨김)
 * - *Ymd → 날짜 (포맷팅)
 * - *Amt → 금액 (포맷팅)
 * - *Yn, *Flag → 플래그 (숨김)
 * - *Org → 원본값 (숨김)
 *
 * 라벨 생성: camelCase 파싱 + 약어 사전 → 한글 라벨
 */

// 필드명 약어 → 한글 사전 (최소한만 유지)
const ABBR_DICT: Record<string, string> = {
  // 법원/재판
  cort: '법원', jdbn: '재판부', lwst: '심급',
  // 사건
  cs: '사건', rcpt: '접수', ultmt: '종국', cfmtn: '확정',
  // 당사자
  btprt: '당사자', clmnt: '원고', acsd: '피고',
  ptnr: '채권자', rqstr: '채무자', aplcnt: '신청인', rspndn: '상대방',
  grnsh: '피압류자', rprs: '대표', agnt: '대리인', thrd: '제3',
  // 문서/절차
  docmt: '서류', dxdy: '기일', sbmsn: '제출', dcsnst: '결정',
  adjdoc: '판결문', apl: '상소', crctn: '보정', scrty: '담보',
  dlvr: '송달', rch: '도달', snd: '송부', rcrd: '기록',
  // 일반
  nm: '', ctt: '', dvs: '구분', rslt: '결과', knd: '종류',
  plc: '장소', telno: '전화', faxno: '팩스', addr: '주소',
  ymd: '일', amt: '액', cnt: '수', typ: '유형',
  hm: '시간', rjctn: '각하', prpnd: '제기',
  // 형사
  crmcs: '형사', prstr: '검사', thrst: '형량',
  // 회생
  rhbl: '회생', cmsnr: '위원', crdtr: '채권자', ddln: '마감',
  // 가사
  prwc: '관계인', gurd: '후견', prsrv: '보존',
  // 기타
  stmp: '인지', vsml: '소가', clm: '청구', relt: '관련',
  inscrt: '불복', entrs: '결과', mrg: '병합', tkp: '수리',
  user: '사용자', last: '최종', prwl: '관계인',
  dbtr: '채무자', apal: '상소', ofdoc: '문서',
};

// suffix 패턴 → suffix 제거 후 한글 suffix
const SUFFIX_LABELS: Record<string, string> = {
  Nm: '',      // 이름 → suffix 제거
  Ctt: '',     // 내용 → suffix 제거
  Ymd: '일',   // 일자
  Amt: '액',   // 금액
  Cnt: '수',   // 개수
  Telno: '전화',
  Faxno: '팩스',
  Lst: '',     // 리스트
};

/**
 * camelCase 필드명을 단어 배열로 분리
 * 예: csRcptYmd → ['cs', 'Rcpt', 'Ymd']
 */
function splitCamelCase(str: string): string[] {
  return str.split(/(?=[A-Z])/).filter(Boolean);
}

/**
 * 필드명에서 한글 라벨 자동 생성
 * 규칙 우선 → 기존 매핑 fallback
 */
export function generateFieldLabel(key: string): string {
  // 1. 규칙 기반 먼저 시도
  const parts = splitCamelCase(key);
  if (parts.length > 0) {
    const koreanParts: string[] = [];
    for (const part of parts) {
      const lower = part.toLowerCase();

      // suffix 패턴 체크
      if (SUFFIX_LABELS[part] !== undefined) {
        if (SUFFIX_LABELS[part]) {
          koreanParts.push(SUFFIX_LABELS[part]);
        }
        continue;
      }

      // 약어 사전 체크
      if (ABBR_DICT[lower]) {
        koreanParts.push(ABBR_DICT[lower]);
      }
    }

    const result = koreanParts.filter(Boolean).join('');
    if (result) {
      return result;  // 규칙으로 생성 성공
    }
  }

  // 2. 규칙 실패 시 기존 매핑 fallback
  if (API_FIELD_LABELS[key]) {
    return API_FIELD_LABELS[key];
  }

  // 3. 둘 다 실패 시 원본 키
  return key;
}

/**
 * 테이블 키에서 한글 라벨 자동 생성
 * 규칙 우선 → 기존 매핑 fallback
 * 예: dlt_btprtCttLst → 당사자
 */
export function generateTableLabel(tableKey: string): string {
  // 1. dlt_ prefix와 Lst suffix 제거
  const cleaned = tableKey.replace(/^dlt_/, '').replace(/Lst$/, '');

  // 2. 규칙 기반 먼저 시도
  const ruleLabel = generateFieldLabel(cleaned);
  if (ruleLabel && ruleLabel !== cleaned) {
    return ruleLabel;
  }

  // 3. 규칙 실패 시 기존 매핑 fallback
  if (DLT_TABLE_LABELS[tableKey]) {
    return DLT_TABLE_LABELS[tableKey];
  }

  return tableKey;
}

export interface VisibleField {
  key: string;
  label: string;
  value: unknown;
  isDate?: boolean;
}

export interface ListField {
  key: string;
  label: string;
  items: unknown[];
}

/**
 * 값이 유효한지 확인 (null, undefined, 빈 문자열, '-' 제외)
 */
function isValidValue(value: unknown): boolean {
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
// 값이 없어도 항상 표시할 필드 (빈 값 허용)
const ALWAYS_SHOW_FIELDS = new Set(['종국결과', 'endRslt', 'csUltmtDvsNm']);

export function getVisibleFields(data: Record<string, unknown>): VisibleField[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .filter(([key, value]) => {
      // 제외 필드
      if (EXCLUDED_FIELDS.has(key)) return false;
      // LIST 타입은 별도 처리
      if (key.endsWith('List') || Array.isArray(value)) return false;
      // 객체는 별도 처리 (parties, representatives 등)
      if (typeof value === 'object' && value !== null) return false;
      // 항상 표시할 필드는 값 체크 스킵
      if (ALWAYS_SHOW_FIELDS.has(key)) return true;
      // 유효한 값만
      return isValidValue(value);
    })
    .map(([key, value]) => {
      const isDate = isDateField(key);
      // 빈 값 처리: 항상 표시 필드는 빈 문자열 대신 '-' 표시
      const isEmpty = value === null || value === undefined || value === '';
      const displayValue = isEmpty ? '-' : (isDate ? formatDateValue(String(value)) : value);
      return {
        key,
        label: FIELD_LABELS[key] || key,
        value: displayValue,
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
export function getListFields(data: Record<string, unknown>): ListField[] {
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
      items: items as Record<string, unknown>[],
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

// ============================================================================
// SCOURT API 동적 렌더링 (일반내용 100% 재현)
// ============================================================================

/**
 * 필드가 코드 필드인지 확인 (표시 제외 대상)
 * *Cd로 끝나는 필드는 내부 코드이므로 표시하지 않음
 */
function isCodeField(key: string): boolean {
  // 예외: 일부 Cd 필드는 표시해야 함
  const showCodeFields = new Set(['cortCd']); // 법원코드는 참고용으로 유용
  if (showCodeFields.has(key)) return false;
  return key.endsWith('Cd');
}

/**
 * 필드가 날짜 필드인지 확인
 */
function isApiDateField(key: string): boolean {
  return key.endsWith('Ymd') || key.endsWith('Day');
}

/**
 * 필드가 시간 필드인지 확인
 */
function isTimeField(key: string): boolean {
  return key.endsWith('Hm') || key.endsWith('Time');
}

/**
 * 필드가 금액 필드인지 확인
 */
function isAmountField(key: string): boolean {
  return key.endsWith('Amt') || key.endsWith('Vsml');
}

/**
 * HHMM 형식 시간을 HH:MM으로 변환
 */
export function formatTimeValue(value: string): string {
  if (!value || typeof value !== 'string') return value;
  if (/^\d{4}$/.test(value)) {
    return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
  }
  return value;
}

/**
 * 금액을 포맷팅 (천 단위 콤마)
 */
export function formatAmountValue(value: number | string): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('ko-KR') + '원';
}

/**
 * API 응답 값을 포맷팅
 */
export function formatApiValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  if (isApiDateField(key)) {
    return formatDateValue(String(value));
  }
  if (isTimeField(key)) {
    return formatTimeValue(String(value));
  }
  if (isAmountField(key)) {
    return formatAmountValue(value as string | number);
  }

  return String(value);
}

export interface ScourtSection {
  type: 'keyValue' | 'table';
  key: string;
  title: string;
  data: unknown;
}

export interface ParsedApiResponse {
  basicInfo: Record<string, unknown>;  // dma_csBasCtt
  tables: Array<{
    key: string;
    title: string;
    columns: string[];
    columnLabels: string[];
    rows: Record<string, unknown>[];
  }>;
}

/**
 * SCOURT API 응답에서 dma_csBasCtt 필드 파싱
 * 표시할 필드만 추출하고 코드 필드는 제외
 */
export function parseBasicInfo(dmaData: Record<string, unknown>): VisibleField[] {
  if (!dmaData || typeof dmaData !== 'object') return [];

  const fields: VisibleField[] = [];

  for (const [key, value] of Object.entries(dmaData)) {
    // 코드 필드 제외
    if (isCodeField(key)) continue;
    // 빈 값 제외 (단, 종국결과 등 일부 필드는 유지)
    if (!isValidValue(value) && !ALWAYS_SHOW_FIELDS.has(key)) continue;
    // 내부 메타데이터 제외
    if (EXCLUDED_FIELDS.has(key)) continue;

    const formattedValue = formatApiValue(key, value);
    if (!formattedValue && !ALWAYS_SHOW_FIELDS.has(key)) continue;

    fields.push({
      key,
      label: generateFieldLabel(key),
      value: formattedValue || '-',
      isDate: isApiDateField(key),
    });
  }

  return sortFields(fields);
}

/**
 * SCOURT API 응답에서 dlt_* 테이블 파싱
 */
export function parseDltTable(
  tableKey: string,
  tableData: Record<string, unknown>[]
): {
  key: string;
  title: string;
  columns: string[];
  columnLabels: string[];
  rows: Record<string, unknown>[];
} | null {
  if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
    return null;
  }

  const title = generateTableLabel(tableKey);

  // 정의된 컬럼 사용, 없으면 *Nm 컬럼 자동 추출
  let columns = DLT_TABLE_COLUMNS[tableKey];
  if (!columns) {
    // 첫 번째 행에서 *Nm으로 끝나는 컬럼 추출
    const firstRow = tableData[0];
    columns = Object.keys(firstRow).filter(k =>
      k.endsWith('Nm') || k.endsWith('Ctt') || k === 'userCsNo'
    );
  }

  // 실제 데이터에 있는 컬럼만 필터링
  const firstRow = tableData[0];
  const availableColumns = columns.filter(col => col in firstRow);

  if (availableColumns.length === 0) return null;

  const columnLabels = availableColumns.map(col =>
    DLT_COLUMN_LABELS[col] || generateFieldLabel(col)
  );

  // 행 데이터 포맷팅
  const rows = tableData.map(row => {
    const formattedRow: Record<string, string> = {};
    for (const col of availableColumns) {
      const value = row[col];
      formattedRow[col] = formatApiValue(col, value);
    }
    return formattedRow;
  });

  return {
    key: tableKey,
    title,
    columns: availableColumns,
    columnLabels,
    rows,
  };
}

/**
 * SCOURT API 전체 응답 파싱
 * generalData.raw.data 구조에서 dma_csBasCtt와 dlt_* 추출
 */
export function parseFullApiResponse(apiData: Record<string, unknown>): ParsedApiResponse {
  const result: ParsedApiResponse = {
    basicInfo: {},
    tables: [],
  };

  if (!apiData || typeof apiData !== 'object') return result;

  // dma_csBasCtt 파싱
  if (apiData.dma_csBasCtt) {
    result.basicInfo = apiData.dma_csBasCtt as Record<string, unknown>;
  }

  // dlt_* 테이블 순서 정의
  const tableOrder = [
    'dlt_btprtCttLst',      // 당사자
    'dlt_agntCttLst',       // 대리인
    'dlt_rcntDxdyLst',      // 최근기일
    'dlt_rcntSbmsnDocmtLst', // 제출서류
    'dlt_inscrtDtsLst',     // 심급내용
    'dlt_reltCsLst',        // 관련사건
    'dlt_crctnOrdLst',      // 보정명령
    'dlt_scrtyCttLst',      // 담보내용
    'dlt_gurdnCttLst',      // 후견인
    'dlt_lwstRltnrCttLst',  // 소송관계인
    'dlt_aplntCttLst',      // 항소인
  ];

  // 정의된 순서대로 테이블 파싱
  for (const tableKey of tableOrder) {
    if (apiData[tableKey]) {
      const parsed = parseDltTable(tableKey, apiData[tableKey] as Record<string, unknown>[]);
      if (parsed) {
        result.tables.push(parsed);
      }
    }
  }

  // 정의되지 않은 dlt_* 테이블도 추가
  for (const [key, value] of Object.entries(apiData)) {
    if (key.startsWith('dlt_') && !tableOrder.includes(key) && Array.isArray(value) && value.length > 0) {
      const parsed = parseDltTable(key, value);
      if (parsed) {
        result.tables.push(parsed);
      }
    }
  }

  return result;
}

/**
 * 저장된 응답 데이터에서 raw API 데이터 추출
 * 다양한 저장 형식 지원
 *
 * 지원하는 형식:
 * 1. savedData.generalData.raw.data - scourt_case_snapshots.basic_info에서 가져온 데이터
 * 2. savedData.detailData.raw.data - 레거시 저장 형식
 * 3. savedData.raw.data - scourt_snapshot API 응답
 * 4. savedData.data.dma_csBasCtt - 직접 API 응답
 * 5. savedData.dma_csBasCtt - 직접 dma_csBasCtt 포함
 * 6. savedData.basicInfo.generalData.raw.data - snapshot API 응답 형식
 * 7. savedData.basicInfo.detailData.raw.data - 레거시 snapshot API 응답 형식
 */
export function extractRawApiData(savedData: Record<string, unknown>): Record<string, unknown> | null {
  if (!savedData) return null;

  // snapshot API 응답에서 basicInfo.generalData.raw.data 형식
  const basicInfo = savedData.basicInfo as Record<string, unknown> | undefined;
  const generalDataFromBasic = basicInfo?.generalData as Record<string, unknown> | undefined;
  const rawFromGeneralBasic = generalDataFromBasic?.raw as Record<string, unknown> | undefined;
  if (rawFromGeneralBasic?.data) {
    return rawFromGeneralBasic.data as Record<string, unknown>;
  }

  // snapshot API 응답에서 basicInfo.detailData.raw.data 형식 (레거시)
  const detailDataFromBasic = basicInfo?.detailData as Record<string, unknown> | undefined;
  const rawFromDetailBasic = detailDataFromBasic?.raw as Record<string, unknown> | undefined;
  if (rawFromDetailBasic?.data) {
    return rawFromDetailBasic.data as Record<string, unknown>;
  }

  // generalData.raw.data 형식 (scourt_snapshot basic_info)
  const generalData = savedData.generalData as Record<string, unknown> | undefined;
  const rawFromGeneral = generalData?.raw as Record<string, unknown> | undefined;
  if (rawFromGeneral?.data) {
    return rawFromGeneral.data as Record<string, unknown>;
  }

  // detailData.raw.data 형식 (레거시)
  const detailData = savedData.detailData as Record<string, unknown> | undefined;
  const rawFromDetail = detailData?.raw as Record<string, unknown> | undefined;
  if (rawFromDetail?.data) {
    return rawFromDetail.data as Record<string, unknown>;
  }

  // raw.data 형식
  const rawDirect = savedData.raw as Record<string, unknown> | undefined;
  if (rawDirect?.data) {
    return rawDirect.data as Record<string, unknown>;
  }

  // data 형식
  const data = savedData.data as Record<string, unknown> | undefined;
  if (data?.dma_csBasCtt) {
    return data;
  }

  // 직접 dma_csBasCtt 포함
  if (savedData.dma_csBasCtt) {
    return savedData;
  }

  return null;
}
