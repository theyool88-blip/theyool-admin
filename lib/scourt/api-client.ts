/**
 * 대법원 나의사건검색 API 클라이언트
 * 브라우저 없이 직접 API 호출로 사건 검색
 *
 * 지원 범위 (2025.01 기준):
 *
 * ┌─────────────────┬──────────────┬──────────────┬────────────────┐
 * │ 사건 유형       │ 검색(encCsNo)│ 상세 조회    │ 비고           │
 * ├─────────────────┼──────────────┼──────────────┼────────────────┤
 * │ 가사(드단,느단) │ ✅ 지원      │ ✅ 지원      │ 완전 지원      │
 * │ 형사(고단,고합) │ ✅ 지원      │ ❌ 미지원    │ 상세API 불가   │
 * │ 민사(가단,가합) │ ❌ 차단      │ ❌ 차단      │ WebSquare5 차단│
 * │ 신청(즈단,즈기) │ ❌ 차단      │ ❌ 차단      │ WebSquare5 차단│
 * │ 집행(카불,카확) │ ❌ 차단      │ ❌ 차단      │ WebSquare5 차단│
 * └─────────────────┴──────────────┴──────────────┴────────────────┘
 *
 * 미지원 사건 유형은 Puppeteer 기반 스크래퍼 필요:
 * - lib/scourt/scraper-v2.ts
 */

import { getVisionCaptchaSolver } from '../google/vision-captcha-solver';
import { solveCaptchaWithModel, isModelAvailable, shouldUseVisionAPI } from './captcha-solver';
import { COURT_CODES, getCourtCodeByName } from './court-codes';
import { CASE_TYPE_CODES, getCaseTypeCodeByName, getCaseCategoryByTypeName } from './case-type-codes';
import { getCaseLevel } from './case-relations';

export interface CaseSearchParams {
  cortCd: string;      // 법원 코드 (예: "수원가정법원")
  csYr: string;        // 연도 (예: "2024")
  csDvsCd: string;     // 사건유형 (예: "드단")
  csSerial: string;    // 일련번호 (예: "26718")
  btprNm: string;      // 당사자명 (예: "김윤한")
}

export interface CaseSearchResult {
  success: boolean;
  data?: any;
  error?: string;
  captchaAttempts?: number;
  encCsNo?: string; // 암호화된 사건번호 (상세 조회용)
  captchaAnswer?: string; // 민사사건용 captchaAnswer (답변 + 토큰)
}

export interface CaseDetailResult {
  success: boolean;
  data?: CaseDetailData;
  error?: string;
}

export interface CaseDetailData {
  // 기본 정보
  csNo?: string;           // 사건번호
  csDvsNm?: string;        // 사건유형명
  cortNm?: string;         // 법원명
  csNm?: string;           // 사건명
  prcdStsCd?: string;      // 진행상태코드
  prcdStsNm?: string;      // 진행상태명
  aplNm?: string;          // 원고명
  rspNm?: string;          // 피고명

  // 추가 기본 정보 (일반내용 탭)
  jdgNm?: string;          // 재판부
  jdgTelno?: string;       // 재판부 전화번호 (031-650-3126(재판일:수...))
  rcptDt?: string;         // 접수일
  endDt?: string;          // 종국일
  endRslt?: string;        // 종국결과
  cfrmDt?: string;         // 확정일 (판결확정일)
  stmpAmnt?: string;       // 인지액
  mrgrDvs?: string;        // 병합구분
  aplDt?: string;          // 상소일
  aplDsmsDt?: string;      // 상소각하일
  jdgArvDt?: string;       // 판결도달일
  prsrvYn?: string;        // 보존여부 (Y/N)
  prsrvCtt?: string;       // 보존내용 (보존, 기록보존됨 등)
  exmnrNm?: string;        // 조사관명
  exmnrTelNo?: string;     // 조사관 전화번호

  // 소가 정보 (민사 사건)
  aplSovAmt?: string;      // 원고 소가
  rspSovAmt?: string;      // 피고 소가

  // 수리구분
  rcptDvsNm?: string;      // 수리구분 (제소, 신청 등)

  // 형사사건 전용 필드
  dfndtNm?: string;        // 피고인명 (형사)
  crmcsNo?: string;        // 형제번호 (형사)
  aplCtt?: string;         // 상소제기내용 (형사)

  // 사건 분류 정보
  caseCategory?: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other';  // 사건 카테고리

  // 당사자 정보
  parties?: Array<{
    btprNm: string;        // 당사자명
    btprDvsNm: string;     // 당사자구분 (원고, 피고 등)
    adjdocRchYmd?: string; // 판결도달일
    indvdCfmtnYmd?: string; // 확정일
  }>;

  // 대리인 정보
  representatives?: Array<{
    agntDvsNm: string;     // 구분 (원고 소송대리인 등)
    agntNm: string;        // 대리인명 (법무법인 더율 (담당변호사 : 임은지))
    jdafrCorpNm?: string;  // 법무법인명
  }>;

  // 기일 정보
  hearings?: Array<{
    trmDt: string;         // 기일 (YYYYMMDD)
    trmNm: string;         // 기일명 (변론기일, 조정기일 등)
    trmPntNm: string;      // 장소
    trmHm?: string;        // 시간 (HHMM)
    rslt?: string;         // 결과
  }>;

  // 진행 내용
  progress?: Array<{
    prcdDt: string;        // 진행일
    prcdNm: string;        // 진행명 (소장접수, 변론기일 등)
    prcdRslt?: string;     // 결과
  }>;

  // 연관사건 정보 (dlt_reltCsLst)
  relatedCases?: Array<{
    reltCsNo: string;        // 연관 사건번호 (내부용, 예: 20250740010680)
    userCsNo: string;        // 사건번호 (표시용, 예: 2025카기10680)
    reltCsDvsNm: string;     // 관계유형 (반소, 항소심, 본안사건, 신청사건 등)
    reltCsDvsCd: string;     // 관계유형 코드
    reltCsCortNm: string;    // 법원명
    reltCsCortCd: string;    // 법원코드
    encCsNo?: string;        // 암호화된 사건번호 (상세조회용)
    comTaskTypCd?: string;   // 업무유형코드
  }>;

  // 심급내용/원심 사건 정보 (dlt_inscrtDtsLst)
  lowerCourtCases?: Array<{
    cortNm: string;          // 법원명 (예: "수원가정법원 평택지원")
    userCsNo: string;        // 사건번호 (예: "2024드단23848")
    ultmtDvsNm: string;      // 결과 (예: "원고패", "청구인용")
    ultmtYmd: string;        // 종국일 (YYYYMMDD, 예: "20250820")
    encCsNo?: string;        // 암호화된 사건번호 (상세조회용)
  }>;

  // 심급 정보
  caseLevel?: 1 | 2 | 3 | 'special';  // 심급 (1심, 2심, 3심, 특별)
  caseLevelDesc?: string;              // 심급 설명

  // 원본 응답
  raw?: any;
}

interface SessionInfo {
  jsessionId: string;
  wmonid: string;      // WMONID - encCsNo 바인딩에 필수
  cookies: string;
  createdAt: Date;
}

export class ScourtApiClient {
  private session: SessionInfo | null = null;
  private baseUrl = 'https://ssgo.scourt.go.kr';
  private maxCaptchaRetries = 20;

  private defaultHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Content-Type': 'application/json;charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://ssgo.scourt.go.kr',
    'Referer': 'https://ssgo.scourt.go.kr/ssgo/index.on?cortId=www',
    'sec-ch-ua': '"Chromium";v="120", "Not A(Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  };

  /**
   * 세션 초기화 - JSESSIONID 및 WMONID 쿠키 획득
   *
   * @param existingWmonid - 기존 WMONID 사용 (encCsNo 재접근용)
   *
   * WMONID는 2년간 유지되는 쿠키로, encCsNo가 이에 바인딩됩니다.
   * 같은 WMONID를 사용하면 세션이 달라도 encCsNo로 캡챠 없이 접근 가능.
   */
  async initSession(existingWmonid?: string): Promise<boolean> {
    console.log('🔐 세션 초기화 중...');
    if (existingWmonid) {
      console.log(`  기존 WMONID 사용: ${existingWmonid}`);
    }

    try {
      // 메인 페이지 접속하여 세션 쿠키 획득
      // 기존 WMONID가 있으면 전송하여 바인딩 유지
      const requestHeaders: Record<string, string> = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'User-Agent': this.defaultHeaders['User-Agent'],
      };

      if (existingWmonid) {
        requestHeaders['Cookie'] = `WMONID=${existingWmonid}`;
      }

      const response = await fetch(`${this.baseUrl}/ssgo/index.on?cortId=www`, {
        method: 'GET',
        headers: requestHeaders,
        redirect: 'follow',
      });

      // Set-Cookie 헤더에서 JSESSIONID 및 WMONID 추출
      const setCookie = response.headers.get('set-cookie');
      console.log('Set-Cookie:', setCookie);

      if (setCookie) {
        const jsessionMatch = setCookie.match(/JSESSIONID=([^;]+)/);
        const wmonidMatch = setCookie.match(/WMONID=([^;]+)/);

        // WMONID: 새로 받은 것 또는 기존 것 사용
        const wmonid = wmonidMatch?.[1] || existingWmonid;

        if (jsessionMatch && wmonid) {
          this.session = {
            jsessionId: jsessionMatch[1],
            wmonid: wmonid,
            cookies: setCookie,
            createdAt: new Date(),
          };
          console.log('✅ 세션 생성 완료:');
          console.log(`  JSESSIONID: ${this.session.jsessionId.substring(0, 20)}...`);
          console.log(`  WMONID: ${this.session.wmonid}`);
          return true;
        }
      }

      // 응답 본문에서 쿠키를 찾을 수도 있음
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      return false;
    } catch (error) {
      console.error('❌ 세션 초기화 실패:', error);
      return false;
    }
  }

  /**
   * 캡챠 이미지 및 토큰 획득
   */
  async getCaptchaImage(): Promise<{ image: Buffer; token: string } | null> {
    if (!this.session) {
      console.error('세션이 초기화되지 않았습니다.');
      return null;
    }

    console.log('🖼️ 캡챠 이미지 요청 중...');

    try {
      // 캡챠 정보 API 호출 (WMONID 포함)
      const response = await fetch(`${this.baseUrl}/ssgo/ssgo10l/getCaptchaInf.on`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Cookie': `WMONID=${this.session.wmonid}; JSESSIONID=${this.session.jsessionId}`,
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_captcha',
        },
        body: '',
      });

      const data = await response.json();
      console.log('캡챠 API 응답:', JSON.stringify(data).substring(0, 200));

      // 응답에서 캡챠 이미지 데이터 및 토큰 추출
      // 구조: { data: { dma_captchaInf: { image: "base64...", answer: "token..." } } }
      const captchaInf = data?.data?.dma_captchaInf;
      const imageData = captchaInf?.image;
      const answerToken = captchaInf?.answer;

      if (imageData && typeof imageData === 'string') {
        // base64 디코딩
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        console.log(`✅ 캡챠 이미지 획득 (${buffer.length} bytes)`);
        console.log(`✅ 캡챠 토큰: ${answerToken?.substring(0, 20)}...`);
        return {
          image: buffer,
          token: answerToken || '',
        };
      }

      console.log('⚠️ 캡챠 이미지를 추출할 수 없습니다. 응답 구조:', Object.keys(data));
      return null;
    } catch (error) {
      console.error('❌ 캡챠 이미지 획득 실패:', error);
      return null;
    }
  }

  /**
   * 사건 검색 실행
   *
   * csNoHistLst를 생성하여 전송하면 64자 encCsNo를 받을 수 있음
   * (캡챠 없이 재접근 가능)
   */
  async searchCase(params: CaseSearchParams, captchaAnswer: string): Promise<CaseSearchResult> {
    if (!this.session) {
      return { success: false, error: '세션이 초기화되지 않았습니다.' };
    }

    console.log('🔍 사건 검색 API 호출 중...');

    // csNoHistLst 생성 (64자 encCsNo 획득을 위해 필수)
    const csNoHistLst = this.generateCsNoHistLst(params.csYr, params.csDvsCd, params.csSerial);

    try {
      const requestBody = {
        dma_search: {
          cortCd: params.cortCd,
          cdScope: 'ALL',
          csNoHistLst: csNoHistLst,  // 14자 포맷으로 전송
          csDvsCd: params.csDvsCd,
          csYr: params.csYr,
          csSerial: params.csSerial,
          btprNm: params.btprNm,
          answer: captchaAnswer,
          fullCsNo: '',
        },
      };

      console.log('요청 데이터:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseUrl}/ssgo/ssgo10l/selectHmpgMain.on`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Cookie': `WMONID=${this.session.wmonid}; JSESSIONID=${this.session.jsessionId}`,
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('검색 API 응답:', JSON.stringify(data).substring(0, 500));

      // 응답 분석
      if (data.error || data.errMsg) {
        return {
          success: false,
          error: data.error || data.errMsg,
          data,
        };
      }

      // 암호화된 사건번호 추출
      const encCsNo = data?.data?.dlt_csNoHistLst?.[0]?.encCsNo;

      return {
        success: true,
        data,
        encCsNo,
      };
    } catch (error) {
      console.error('❌ 검색 API 호출 실패:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 사건 상세 정보 조회 (모든 사건 유형 지원)
   * 실패 시 대체 엔드포인트 자동 시도
   */
  async getCaseDetail(params: {
    cortCd: string;       // 법원코드 (숫자 또는 한글)
    csYear: string;       // 연도
    csDvsCd: string;      // 사건유형코드 (숫자 또는 한글)
    csSerial: string;     // 일련번호
    btprNm: string;       // 당사자명
    encCsNo: string;      // 암호화된 사건번호 (검색 결과에서)
    captchaAnswer: string; // 캡챠 답
    csNo?: string;        // 14자리 사건번호 (검색 결과에서)
    caseCategory?: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other';  // 사건 카테고리
  }): Promise<CaseDetailResult> {
    if (!this.session) {
      return { success: false, error: '세션이 초기화되지 않았습니다.' };
    }

    // 사건 카테고리 결정 (전달되지 않은 경우 자동 감지)
    const caseCategory = params.caseCategory || this.getCaseCategory(params.csDvsCd);
    const apiEndpoints = this.getDetailApiEndpoints(caseCategory);

    console.log(`📋 사건 상세 정보 조회 중... (카테고리: ${caseCategory})`);
    console.log(`  API 엔드포인트: ${apiEndpoints[0]} (대체: ${apiEndpoints.length - 1}개)`);

    // 브라우저 분석 결과 기반 파라미터 변환
    const cortCdNum = this.getCourtCode(params.cortCd, caseCategory);
    const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);

    // 사건 카테고리별 파라미터 분기 (브라우저 캡처 결과 반영)
    const isCriminal = caseCategory === 'criminal';
    const csSerialValue = isCriminal ? params.csSerial.padStart(7, '0') : params.csSerial;
    const csNoValue = isCriminal
      ? (params.csNo || `${params.csYear}${csDvsCdNum}${params.csSerial.padStart(7, '0')}`)
      : '';
    const srchDvsValue = isCriminal ? '06' : '';

    const requestBody = {
      dma_search: {
        cortCd: cortCdNum,
        csNo: csNoValue,
        encCsNo: params.encCsNo,
        csYear: params.csYear,
        csDvsCd: csDvsCdNum,
        csSerial: csSerialValue,
        btprtNm: params.btprNm,
        captchaAnswer: params.captchaAnswer,
        csDvsNm: params.csDvsCd,
        progCttDvs: '0',
        srchDvs: srchDvsValue,
        callDomain: '',
        prwlKey: '',
        preProgYn: '',
        typ: '',
        atho: '',
        dcRgstNoIndctYn: '',
        myCslistLinkYn: '',
        mode: '',
        mcsDomain: '',
        callTyp: '',
        ckiStrgYn: '',
        link: '',
        linkValue: '',
        nrlnmDvsCd: '',
        inqScop: '',
        inUseCallDomain: '',
        etc1: '',
        etc2: '',
        etc3: '',
      },
    };

    console.log('상세 조회 요청:', JSON.stringify(requestBody, null, 2));

    // 여러 엔드포인트 시도
    let lastError = '';
    for (let i = 0; i < apiEndpoints.length; i++) {
      const apiEndpoint = apiEndpoints[i];
      const isFallback = i > 0;

      if (isFallback) {
        console.log(`  ⚠️ 대체 엔드포인트 시도 (${i}/${apiEndpoints.length - 1}): ${apiEndpoint}`);
      }

      try {
        const response = await fetch(`${this.baseUrl}${apiEndpoint}`, {
          method: 'POST',
          headers: {
            ...this.defaultHeaders,
            'Cookie': `WMONID=${this.session.wmonid}; JSESSIONID=${this.session.jsessionId}`,
            'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_sbm_search',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        console.log('상세 API 응답:', JSON.stringify(data).substring(0, 1000));

        // 오류 체크
        if (data.error || data.errMsg || data.errors?.errorMessage) {
          const errorMsg = data.error || data.errMsg || data.errors?.errorMessage;
          lastError = errorMsg;

          // "사용에 불편을 드려서" 에러는 대체 엔드포인트 시도
          if (errorMsg.includes('사용에 불편을 드려서') && i < apiEndpoints.length - 1) {
            console.log(`  ⚠️ 서버 오류, 다음 엔드포인트 시도...`);
            continue;
          }

          // "사건이 존재하지 않습니다" 에러도 대체 엔드포인트 시도
          if (errorMsg.includes('사건이 존재하지 않습니다') && i < apiEndpoints.length - 1) {
            console.log(`  ⚠️ 사건 없음 (잘못된 엔드포인트), 다음 시도...`);
            continue;
          }

          // 마지막 엔드포인트이거나 다른 에러면 실패 반환
          return { success: false, error: errorMsg };
        }

        // 응답 데이터 파싱 (사건 카테고리 전달)
        const detailData = this.parseDetailResponse(data, caseCategory);

        if (isFallback) {
          console.log(`  ✅ 대체 엔드포인트 ${apiEndpoint} 성공!`);
        }

        return {
          success: true,
          data: detailData,
        };
      } catch (error) {
        console.error(`❌ 상세 API 호출 실패 (${apiEndpoint}):`, error);
        lastError = String(error);

        // JSON 파싱 에러가 아니면 다음 엔드포인트 시도
        if (i < apiEndpoints.length - 1) {
          continue;
        }
      }
    }

    return { success: false, error: lastError || '모든 엔드포인트 실패' };
  }

  /**
   * 사건 진행내용 조회 (모든 사건 유형 지원)
   *
   * 일반내용과 별도로 진행내용을 조회해야 함
   *
   * 브라우저 분석 결과 확인된 엔드포인트 (2026.01.05):
   * - 가사: /ssgo/ssgo102/selectHmpgFmlyCsProgCtt.on
   * - 민사: /ssgo/ssgo101/selectHmpgCvlcsCsProgCtt.on
   * - 전자독촉(차전): /ssgo/ssgo10c/selectHmpgElctnUrgngCsProgCtt.on ✅ 확인됨
   * - 회생/파산: /ssgo/ssgo107/selectHmpgRhblBnkpCsProgCtt.on (패턴 기반 추론)
   * - 신청: /ssgo/ssgo105/selectHmpgAplyCsProgCtt.on (패턴 기반 추론)
   * - 집행(타채): /ssgo/ssgo10a/selectHmpgEtexecCsProgCtt.on ✅ 브라우저 확인
   * - 형사: /ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsProgCtt.on (패턴 기반 추론)
   */
  async getCaseProgress(params: {
    cortCd: string;
    csYear: string;
    csDvsCd: string;
    csSerial: string;
    encCsNo: string;
    caseCategory?: 'family' | 'civil' | 'criminal' | 'application' | 'execution' | 'electronicOrder' | 'insolvency';
  }): Promise<{ success: boolean; progress?: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string; progCttDvs?: string }>; error?: string }> {
    if (!this.session) {
      return { success: false, error: '세션이 초기화되지 않았습니다.' };
    }

    console.log('📋 사건 진행내용 조회 중...');

    try {
      // csNo 생성: 연도(4) + 사건유형코드(3) + 일련번호(7, 0패딩)
      const csNo = `${params.csYear}${params.csDvsCd}${params.csSerial.padStart(7, '0')}`;

      const requestBody = {
        dma_search: {
          cortCd: params.cortCd,
          csNo: csNo,              // 브라우저와 동일하게 csNo 추가
          encCsNo: params.encCsNo,
          csYear: params.csYear,
          csDvsCd: params.csDvsCd,
          csSerial: params.csSerial.padStart(7, '0'),  // 7자리로 패딩
          progCttDvs: '0',         // 진행구분 (전체=0) - 필드명 수정!
          srchDvs: '06',           // 검색구분 추가
        },
      };

      console.log('진행내용 조회 요청:', JSON.stringify(requestBody, null, 2));

      // 진행내용 API 엔드포인트 (사건유형별 분기)
      // 브라우저 분석으로 확인된 엔드포인트 (2026.01.05)
      const progressEndpoints: Record<string, string> = {
        family: '/ssgo/ssgo102/selectHmpgFmlyCsProgCtt.on',           // 가사
        civil: '/ssgo/ssgo101/selectHmpgCvlcsCsProgCtt.on',            // 민사
        criminal: '/ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsProgCtt.on',    // 형사
        application: '/ssgo/ssgo105/selectHmpgAplyCsProgCtt.on',       // 신청
        execution: '/ssgo/ssgo10a/selectHmpgEtexecCsProgCtt.on',        // 집행(타채) ✅ 브라우저 확인
        electronicOrder: '/ssgo/ssgo10c/selectHmpgElctnUrgngCsProgCtt.on',  // 전자독촉 (차전) ✅ 브라우저 확인
        insolvency: '/ssgo/ssgo107/selectHmpgRhblBnkpCsProgCtt.on',    // 회생/파산 (개회,하단,하면)
      };
      const endpoint = progressEndpoints[params.caseCategory || 'family'] || progressEndpoints.civil;
      console.log(`  엔드포인트: ${endpoint} (${params.caseCategory || 'family'})`);

      // submissionid도 사건유형별로 다름
      const submissionIds: Record<string, string> = {
        family: 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab2_body_sbm_srchProgCtt',
        civil: 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab2_body_sbm_srchProgCtt',
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Cookie': `WMONID=${this.session.wmonid}; JSESSIONID=${this.session.jsessionId}`,
          'submissionid': submissionIds[params.caseCategory || 'family'] || submissionIds.family,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('진행내용 API 응답:', JSON.stringify(data).substring(0, 500));

      // 에러 체크 (다양한 형태의 에러 응답 처리)
      if (data.error || data.errMsg || data.errors?.errorMessage) {
        const errorMsg = data.error || data.errMsg || data.errors?.errorMessage;
        console.log(`⚠️ 진행내용 API 에러: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }

      // 진행내용 파싱
      // API 응답 필드: dlt_csProgCtt (배열) - progYmd, progCtt, progRslt
      const progressList = data?.data?.dlt_csProgCtt ||
                           data?.data?.dlt_csProgCttLst ||
                           data?.data?.dlt_prgrCttLst ||
                           data?.data?.dlt_prcdCttLst ||
                           data?.data?.dlt_prcsCtt ||
                           [];

      const progress = progressList.map((p: any) => ({
        // 브라우저 응답 필드명: progYmd, progCtt, progRslt, progCttDvs
        prcdDt: p.progYmd || p.prgrDt || p.prcdDt || p.evntDt || '',
        prcdNm: p.progCtt || p.prgrCtt || p.prcdNm || p.evntNm || p.cttNm || '',
        prcdRslt: p.progRslt || p.prgrRslt || p.rslt || p.dlvyDt || '',  // 결과 또는 도달일
        // SCOURT 진행구분 코드: 0=법원(검정), 1=기일(파랑), 2=명령(녹색), 3=제출(진빨강), 4=송달(주황)
        progCttDvs: p.progCttDvs || p.prcdDvs || '0',
      }));

      console.log(`📋 진행내용 ${progress.length}건 파싱 완료`);
      if (progressList.length > 0) {
        console.log(`  첫번째 원본 필드:`, JSON.stringify(progressList[0], null, 2));
        // 원본 데이터의 모든 필드명 수집
        const allFields = new Set<string>();
        progressList.forEach((p: any) => Object.keys(p).forEach(k => allFields.add(k)));
        console.log(`  원본 데이터 모든 필드: ${Array.from(allFields).join(', ')}`);
      }
      console.log(`  응답 필드: ${Object.keys(data?.data || {}).join(', ')}`);

      return { success: true, progress };
    } catch (error) {
      console.error('❌ 진행내용 API 호출 실패:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 상세 응답 파싱
   *
   * API 응답 구조 (사건 유형별):
   *
   * 가사 사건:
   * - dma_csBasCtt: 기본 정보 (csNm, rprsClmntNm, rprsAcsdNm, userCsNo 등)
   * - dlt_rcntDxdyLst: 최근 기일 정보
   * - dlt_btprtCttLst: 당사자 정보
   * - dlt_rcntSbmsnDocmtLst: 제출 서류
   * - dlt_reltCsLst: 연관 사건
   *
   * 형사 사건:
   * - dma_csBasCtt: 기본 정보 (dfndtNm 피고인명, crmcsNo 형제번호 등)
   * - 원고/피고 대신 피고인 사용
   */
  private parseDetailResponse(
    response: any,
    caseCategory?: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other'
  ): CaseDetailData {
    const result: CaseDetailData = {
      raw: response,
      caseCategory: caseCategory,
    };

    try {
      // 기본 정보 추출 (다양한 응답 구조 대응)
      // 실제 API 응답: data.dma_csBasCtt (가사 사건의 기본정보)
      const caseInfo = response?.data?.dma_csBasCtt ||
                       response?.data?.dma_csBsCtt ||
                       response?.data?.dma_gnrlCtt ||
                       response?.data;

      if (caseInfo) {
        // 디버그: caseInfo의 모든 필드 로깅 (누락 필드 찾기)
        const allKeys = Object.keys(caseInfo);
        // 종국, 소가, 수리 관련 필드 찾기
        const importantKeys = allKeys.filter(k => {
          const kLower = k.toLowerCase();
          return kLower.includes('ultmt') ||
                 kLower.includes('rslt') ||
                 kLower.includes('sov') ||
                 kLower.includes('amt') ||
                 kLower.includes('rcpt') ||
                 kLower.includes('prsrv');
        });
        if (importantKeys.length > 0) {
          console.log(`📋 중요 필드:`, importantKeys.map(k => `${k}=${caseInfo[k]}`).join(', '));
        }
        // 값이 있는 모든 필드 로깅
        console.log(`📋 caseInfo 전체 필드 (값 있는 것만):`);
        allKeys.forEach(k => {
          if (caseInfo[k] !== null && caseInfo[k] !== undefined && caseInfo[k] !== '') {
            console.log(`  ${k}: ${caseInfo[k]}`);
          }
        });

        result.csNo = caseInfo.userCsNo || caseInfo.csNo;
        // csDvsNm이 없으면 userCsNo에서 추출 (예: "2024가단75190" → "가단")
        if (caseInfo.csDvsNm) {
          result.csDvsNm = caseInfo.csDvsNm;
        } else if (caseInfo.userCsNo) {
          const match = caseInfo.userCsNo.match(/^\d{4}([가-힣]+)\d+$/);
          if (match) {
            result.csDvsNm = match[1];
          }
        }
        result.cortNm = caseInfo.cortNm;
        result.csNm = caseInfo.csNm;
        result.prcdStsCd = caseInfo.prcdStsCd;
        result.prcdStsNm = caseInfo.prcdStsNm;

        // 형사사건인 경우 피고인명 추출
        if (caseCategory === 'criminal') {
          result.dfndtNm = caseInfo.dfndtNm || caseInfo.btprtNm || caseInfo.acsdNm || caseInfo.rprsAcsdNm;  // 피고인명
          result.crmcsNo = caseInfo.crmcsNo || caseInfo.prsctrCsNoLstCtt || caseInfo.hgcrimNo;  // 형제번호 (검찰사건번호)
          // 상소제기내용: 상소일 + 상소법원송부일
          const appealDate = caseInfo.acsApelPrpndYmd ? this.formatDate(caseInfo.acsApelPrpndYmd) : '';
          const transferDate = caseInfo.aplPrpndRsltYmd ? this.formatDate(caseInfo.aplPrpndRsltYmd) : '';
          result.aplCtt = caseInfo.aplCtt || caseInfo.aplCntts ||
            (appealDate && transferDate ? `${appealDate} 피고인상소 / ${transferDate} 상소법원으로 송부` : '');  // 상소제기내용
          // 형사사건은 aplNm/rspNm 대신 dfndtNm 사용
          result.rspNm = result.dfndtNm;  // UI 호환성을 위해 rspNm에도 설정
          console.log(`  형사사건: 피고인=${result.dfndtNm}, 형제번호=${result.crmcsNo}`);
        } else {
          // 원고/피고명 (여러 필드명 대응) - 가사, 민사, 신청 등
          result.aplNm = caseInfo.aplNm || caseInfo.rprsClmntNm || caseInfo.clmntNm;  // 원고/신청인/채권자
          result.rspNm = caseInfo.rspNm || caseInfo.rprsAcsdNm || caseInfo.acsdNm;    // 피고/피신청인/채무자
        }

        // 추가 기본 정보 추출 (일반내용 탭)
        // 실제 API 필드명: jdbnNm, csRcptYmd, csUltmtYmd, csUltmtDtlCtt, csCfmtnYmd 등
        result.jdgNm = caseInfo.jdbnNm || caseInfo.ultmtJdbnNm || caseInfo.jdgNm || caseInfo.jdgpNm;  // 재판부
        result.rcptDt = caseInfo.csRcptYmd || caseInfo.rcptDt || caseInfo.rcptYmd;                    // 접수일
        result.endDt = caseInfo.csUltmtYmd || caseInfo.endDt;                                         // 종국일
        result.endRslt = caseInfo.csUltmtDtlCtt || caseInfo.endRslt || caseInfo.endRsltNm;            // 종국결과
        result.cfrmDt = caseInfo.csCfmtnYmd || caseInfo.cfrmDt || caseInfo.cfrmYmd;                   // 확정일
        result.stmpAmnt = caseInfo.stmpAtchAmt || caseInfo.stmpAmnt || caseInfo.injiAek;              // 인지액
        result.mrgrDvs = caseInfo.csMrgTypNm || caseInfo.mrgrDvs || caseInfo.mrgrDvsNm;               // 병합구분
        result.aplDt = caseInfo.aplYmd || caseInfo.aplDt;                                             // 상소일
        result.aplDsmsDt = caseInfo.aplRjctnYmd || caseInfo.aplDsmsDt || caseInfo.aplDsmsYmd;         // 상소각하일
        result.jdgArvDt = caseInfo.adjdocRchYmd || caseInfo.jdgArvDt || caseInfo.jdgArvYmd;           // 판결도달일

        // 추가 필드: 재판부 전화번호, 보존, 조사관 정보
        result.jdgTelno = caseInfo.jdbnTelno || caseInfo.jdgTelno || caseInfo.jdbnTelNo;             // 재판부 전화번호
        result.prsrvYn = caseInfo.csPrsrvYn || caseInfo.prsrvYn;                                     // 보존여부 (Y/N)
        result.prsrvCtt = caseInfo.prsvCtt || caseInfo.prsrvCtt;                                     // 보존내용
        result.exmnrNm = caseInfo.exmnrNm || caseInfo.csExmnrNm;                                     // 조사관명
        result.exmnrTelNo = caseInfo.exmnrTelNo || caseInfo.csExmnrTelNo;                            // 조사관 전화번호

        // 소가 정보 (민사 사건)
        result.aplSovAmt = caseInfo.clmntSovAmt || caseInfo.aplSovAmt || caseInfo.aplClmAmt;         // 원고 소가
        result.rspSovAmt = caseInfo.acsdSovAmt || caseInfo.rspSovAmt || caseInfo.rspClmAmt;          // 피고 소가

        // 수리구분
        result.rcptDvsNm = caseInfo.rcptDvsNm || caseInfo.rcptDvs || caseInfo.csRcptDvsNm;           // 수리구분 (제소, 신청 등)

        // 디버그: 추출된 추가 필드 로깅
        if (result.jdgNm || result.rcptDt || result.endRslt || result.cfrmDt || result.stmpAmnt) {
          console.log(`📋 추가 필드 추출: 재판부=${result.jdgNm}, 접수일=${result.rcptDt}, 종국결과=${result.endRslt}, 확정일=${result.cfrmDt}, 인지액=${result.stmpAmnt}`);
        }
      }

      // 당사자 정보 추출 (dlt_btprtCttLst 또는 dlt_btprLst)
      const partiesList = response?.data?.dlt_btprtCttLst ||
                          response?.data?.dlt_btprLst ||
                          [];
      if (partiesList.length > 0) {
        result.parties = partiesList.map((p: any) => ({
          btprNm: p.btprNm || p.btprtNm,
          btprDvsNm: p.btprDvsNm || p.btprtStndngNm,
          adjdocRchYmd: p.adjdocRchYmd,    // 판결도달일
          indvdCfmtnYmd: p.indvdCfmtnYmd,  // 확정일
        }));
      }

      // aplNm/rspNm이 있고 parties 목록에 없으면 추가
      // (dlt_btprtCttLst에 원고/피고가 없는 경우 - 가사 사건 등)
      if (!result.parties) {
        result.parties = [];
      }

      // 원고/신청인/채권자 추가 (aplNm)
      if (result.aplNm) {
        const plaintiffLabels = ['원고', '신청인', '채권자', '항소인', '상고인', '청구인'];
        const alreadyHasPlaintiff = result.parties.some(p =>
          p.btprNm === result.aplNm ||
          (p.btprDvsNm && plaintiffLabels.some(label => p.btprDvsNm?.includes(label)))
        );
        if (!alreadyHasPlaintiff) {
          result.parties.unshift({
            btprNm: result.aplNm,
            btprDvsNm: '원고',  // 기본값 (사건유형에 따라 신청인/채권자 등으로 표시될 수 있음)
          });
          console.log(`  📋 원고 추가 (rprsClmntNm): ${result.aplNm}`);
        }
      }

      // 피고/피신청인/채무자 추가 (rspNm)
      if (result.rspNm) {
        const defendantLabels = ['피고', '피신청인', '채무자', '피항소인', '피상고인', '피청구인'];
        const alreadyHasDefendant = result.parties.some(p =>
          p.btprNm === result.rspNm ||
          (p.btprDvsNm && defendantLabels.some(label => p.btprDvsNm?.includes(label)))
        );
        if (!alreadyHasDefendant) {
          result.parties.push({
            btprNm: result.rspNm,
            btprDvsNm: '피고',  // 기본값
          });
          console.log(`  📋 피고 추가 (rprsAcsdNm): ${result.rspNm}`);
        }
      }

      // 대리인 정보 추출 (dlt_agntCttLst)
      const agentsList = response?.data?.dlt_agntCttLst || [];
      if (agentsList.length > 0) {
        result.representatives = agentsList.map((a: any) => ({
          agntDvsNm: a.agntDvsNm || '',       // 구분 (원고 소송대리인)
          agntNm: a.agntNm || '',             // 대리인명
          jdafrCorpNm: a.jdafrCorpNm || '',   // 법무법인명
        }));
      }

      // 기일 정보 추출 (dlt_rcntDxdyLst / dlt_csSchdCtt / dlt_trmLst)
      // API 응답 필드: dxdyYmd(날짜), dxdyHm(시간), dxdyKndNm(유형), dxdyPlcNm(장소), dxdyRsltNm(결과)
      const hearingsList = response?.data?.dlt_rcntDxdyLst ||
                           response?.data?.dlt_csSchdCtt ||
                           response?.data?.dlt_trmLst ||
                           [];
      if (hearingsList.length > 0) {
        result.hearings = hearingsList.map((h: any) => ({
          trmDt: h.dxdyYmd || h.trmDt || h.schdDt,
          trmNm: h.dxdyKndNm || h.dxdyNm || h.trmNm || h.schdNm || '',
          trmPntNm: h.dxdyPlcNm || h.dxdyPntNm || h.trmPntNm || h.schdPntNm || '',
          trmHm: h.dxdyHm || '',  // 기일 시간 (예: "1400" → 14:00)
          rslt: h.dxdyRsltNm || h.rslt || h.dxdyRslt || h.schdRslt || '',
        }));
      }

      // 진행 내용 추출 (다양한 필드명 대응)
      // dlt_prcdRslt, dlt_prcdCttLst, dlt_prcdLst, dlt_prgrRsltLst 등
      const progressList = response?.data?.dlt_prcdRslt ||
                           response?.data?.dlt_prcdCttLst ||
                           response?.data?.dlt_prcdLst ||
                           response?.data?.dlt_prgrRsltLst ||
                           response?.data?.dlt_prcsCtt ||
                           [];
      if (progressList.length > 0) {
        result.progress = progressList.map((p: any) => ({
          prcdDt: p.prcdDt || p.prcsDt || p.prgrDt || p.evntDt,
          prcdNm: p.prcdNm || p.prcsNm || p.prgrNm || p.evntNm || p.cttNm,
          prcdRslt: p.prcdRslt || p.rslt || p.prgrRslt,
        }));
      }

      // 연관사건 정보 추출 (dlt_reltCsLst)
      const relatedList = response?.data?.dlt_reltCsLst || [];
      if (relatedList.length > 0) {
        result.relatedCases = relatedList.map((r: any) => ({
          reltCsNo: r.reltCsNo || '',
          userCsNo: r.userCsNo || '',
          reltCsDvsNm: r.reltCsDvsNm || '',  // 관계유형 (반소, 항소심, 본안, 신청사건 등)
          reltCsDvsCd: r.reltCsDvsCd || '',
          reltCsCortNm: r.reltCsCortNm || '',
          reltCsCortCd: r.reltCsCortCd || '',
          encCsNo: r.encCsNo || '',
          comTaskTypCd: r.comTaskTypCd || '',
        }));
      }

      // 심급내용/원심 사건 정보 추출 (dlt_inscrtDtsLst)
      // 항소심/상고심에서 원심 법원, 사건번호, 결과를 표시
      const lowerCourtList = response?.data?.dlt_inscrtDtsLst || [];
      if (lowerCourtList.length > 0) {
        result.lowerCourtCases = lowerCourtList.map((lc: any) => ({
          cortNm: lc.cortNm || '',          // 법원명
          userCsNo: lc.userCsNo || '',      // 사건번호
          ultmtDvsNm: lc.ultmtDvsNm || '',  // 결과 (원고패, 청구인용 등)
          ultmtYmd: lc.ultmtYmd || '',      // 종국일 (YYYYMMDD)
          encCsNo: lc.encCsNo || '',        // 암호화된 사건번호 (상세조회용)
        }));
        console.log(`📋 심급내용 (원심): ${lowerCourtList.length}건`);
      }

      // 심급 정보 결정 (사건유형 한글명 기반)
      // getCaseLevel()은 한글명("가단")을 기대하므로 csDvsNm 사용
      const caseTypeName = result.csDvsNm || caseInfo?.csDvsNm;
      console.log(`📋 심급 결정: csDvsNm=${result.csDvsNm}, caseInfo.csDvsNm=${caseInfo?.csDvsNm}, userCsNo=${caseInfo?.userCsNo}`);
      if (caseTypeName) {
        const levelInfo = getCaseLevel(caseTypeName);
        result.caseLevel = levelInfo.level;
        result.caseLevelDesc = levelInfo.description;
        console.log(`📋 심급 결과: ${caseTypeName} → ${levelInfo.description}`);
      } else {
        console.log(`⚠️ 심급 결정 실패: caseTypeName이 없음`);
      }

      // 응답에 어떤 필드가 있는지 디버그 로깅
      const availableFields = response?.data ? Object.keys(response.data) : [];
      console.log(`📋 상세 파싱 완료: 기일 ${result.hearings?.length || 0}건, 진행 ${result.progress?.length || 0}건, 당사자 ${result.parties?.length || 0}명, 대리인 ${result.representatives?.length || 0}명`);
      console.log(`📋 응답 필드 목록: ${availableFields.join(', ')}`);
      if (result.relatedCases && result.relatedCases.length > 0) {
        console.log(`📋 연관사건: ${result.relatedCases.length}건`);
      }
    } catch (e) {
      console.log('상세 정보 파싱 중 에러:', e);
    }

    return result;
  }

  /**
   * 검색 + 상세 조회를 한 번에 수행
   */
  async searchAndGetDetail(params: CaseSearchParams): Promise<{
    searchResult: CaseSearchResult;
    detailResult?: CaseDetailResult;
  }> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 사건 검색 및 상세 정보 조회');
    console.log('='.repeat(60));

    // 세션 초기화
    if (!this.session) {
      const sessionOk = await this.initSession();
      if (!sessionOk) {
        return {
          searchResult: { success: false, error: '세션 초기화 실패' },
        };
      }
    }

    // 캡챠 해결 + 검색 + 상세 조회
    for (let attempt = 1; attempt <= this.maxCaptchaRetries; attempt++) {
      console.log(`\n📝 시도 ${attempt}/${this.maxCaptchaRetries}`);

      // 캡챠 이미지 및 토큰 획득
      const captchaData = await this.getCaptchaImage();
      if (!captchaData) {
        console.log('⚠️ 캡챠 이미지 획득 실패, 재시도...');
        continue;
      }

      // 캡챠 인식 (학습된 모델 우선, 없으면 Vision API fallback)
      try {
        let captchaText: string | null = null;
        let confidence = 0;

        // 1. 학습된 모델 시도
        if (isModelAvailable()) {
          captchaText = await solveCaptchaWithModel(captchaData.image);
          if (captchaText) {
            confidence = 0.95; // 모델 인식 성공시 높은 신뢰도
            console.log(`  🤖 모델 인식: "${captchaText}" (학습된 CNN 모델)`);
          }
        }

        // 2. 모델 실패시 Vision API fallback
        if (!captchaText) {
          const solver = getVisionCaptchaSolver();
          const captchaResult = await solver.solveCaptcha(captchaData.image);
          captchaText = captchaResult.text;
          confidence = captchaResult.confidence || 0;
          console.log(`  👁️ Vision API 인식: "${captchaText}" (신뢰도: ${(confidence * 100).toFixed(1)}%)`);
        }

        // 캡챠 인식 결과가 있으면 일단 시도
        if (!captchaText || captchaText.length === 0) {
          console.log(`  ⚠️ 캡챠 인식 실패, 재시도...`);
          continue;
        }
        console.log(`  📤 인식된 캡챠로 검색 시도: "${captchaText}" (${captchaText.length}자리)`);

        // 검색 실행
        const searchResult = await this.searchCase(params, captchaText);

        if (!searchResult.success) {
          if (searchResult.error?.includes('캡챠') || searchResult.error?.includes('자동입력')) {
            console.log('  ⚠️ 캡챠 오류, 재시도...');
            continue;
          }
          return { searchResult };
        }

        console.log('✅ 검색 성공!');

        // 암호화된 사건번호가 있으면 상세 조회
        if (searchResult.encCsNo) {
          console.log('\n📋 상세 정보 조회 시작...');

          // 사건 카테고리 결정 (법원코드 변환에 필요)
          const caseCategory = this.getCaseCategory(params.csDvsCd);

          // 법원코드 변환 (이름 → 숫자코드, 사건 카테고리 고려)
          const cortCdNum = this.getCourtCode(params.cortCd, caseCategory);
          const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);

          // captchaAnswer = 인식된 텍스트 + 토큰
          const fullCaptchaAnswer = captchaText + captchaData.token;
          console.log(`  captchaAnswer: ${captchaText} + ${captchaData.token.substring(0, 20)}...`);

          const detailResult = await this.getCaseDetail({
            cortCd: cortCdNum,
            csYear: params.csYr,
            csDvsCd: csDvsCdNum,
            csSerial: params.csSerial,
            btprNm: params.btprNm,
            encCsNo: searchResult.encCsNo,
            captchaAnswer: fullCaptchaAnswer,
          });

          return {
            searchResult: { ...searchResult, captchaAttempts: attempt },
            detailResult,
          };
        }

        return {
          searchResult: { ...searchResult, captchaAttempts: attempt },
        };

      } catch (error) {
        console.log(`  ❌ 에러: ${error}`);
        continue;
      }
    }

    return {
      searchResult: {
        success: false,
        error: `${this.maxCaptchaRetries}회 시도 후 실패`,
        captchaAttempts: this.maxCaptchaRetries,
      },
    };
  }

  /**
   * 법원 이름을 코드로 변환
   *
   * 207개 법원 코드 매핑 사용 (court-codes.ts)
   * 출처: https://github.com/iicdii/case-ing
   *
   * 주의: 법원명에 따라 코드가 결정됨
   * - 대전지방법원 천안지원: 000283 (민사/형사)
   * - 대전가정법원 천안지원: 000294 (가사)
   */
  private getCourtCode(cortNm: string, _caseCategory?: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other'): string {
    // 숫자 코드면 그대로 반환
    if (/^\d+$/.test(cortNm)) {
      return cortNm;
    }

    // 1. 정확한 매칭
    if (COURT_CODES[cortNm]) {
      return COURT_CODES[cortNm];
    }

    // 2. 부분 매칭 시도 (예: "평택지원" -> 정확한 법원명)
    const code = getCourtCodeByName(cortNm);
    if (code) {
      return code;
    }

    // 3. 매칭 실패 시 원본 반환 (검색 API가 한글명을 처리하므로)
    console.warn(`⚠️ 법원코드를 찾을 수 없음: "${cortNm}" - 원본 사용`);
    return cortNm;
  }

  /**
   * 사건유형 이름을 코드로 변환
   * 325개 사건유형 코드 매핑 사용 (case-type-codes.ts)
   */
  private getCaseTypeCode(csDvsNm: string): string {
    // 숫자 코드면 그대로 반환
    if (/^\d+$/.test(csDvsNm)) {
      return csDvsNm;
    }

    // 새로운 매핑에서 조회
    const code = getCaseTypeCodeByName(csDvsNm);
    if (code) {
      return code;
    }

    // 매핑에 없으면 원본 반환 (경고 로그)
    console.warn(`⚠️ 사건유형 코드를 찾을 수 없음: "${csDvsNm}" - 원본 사용`);
    return csDvsNm;
  }

  /**
   * YYYYMMDD 형식 날짜를 YY.MM.DD로 변환
   */
  private formatDate(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(2, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`;
  }

  /**
   * 사건유형에 따른 카테고리 분류
   * 325개 사건유형 카테고리 매핑 사용 (case-type-codes.ts)
   *
   * 주의: API 엔드포인트 결정에 사용되므로, 실제 사건 분류와 다를 수 있음
   * - 가사 보전(즈단, 즈기): 가사 사건이지만 ssgo105(신청) 엔드포인트 사용
   * - 전자독촉(차전): ssgo10c 엔드포인트 사용 (브라우저 분석으로 확인)
   * - 회생/파산(개회, 하단, 하면): ssgo107 엔드포인트 사용 (브라우저 분석으로 확인)
   */
  private getCaseCategory(csDvsCd: string): 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other' {
    // 1. 특수 사건 유형 우선 처리 (API 엔드포인트 기준)

    // 가사 보전/신청 사건 → ssgo105 (application)
    // 즈단(177), 즈기(178), 재즈단(225), 재즈기(226) 등
    const familyApplicationTypes = ['즈단', '즈기', '재즈단', '재즈기', '177', '178', '225', '226'];
    if (familyApplicationTypes.includes(csDvsCd)) {
      return 'application';
    }

    // 전자독촉/지급명령 → ssgo10c (electronicOrder)
    // 브라우저 분석 결과: /ssgo/ssgo10c/selectHmpgElctnUrgngCsGnrlCtt.on
    // 차전(400), 차(012) 등
    const electronicOrderTypes = ['차전', '차', '400', '012'];
    if (electronicOrderTypes.includes(csDvsCd)) {
      return 'electronicOrder';
    }

    // 비송도산 (회생/파산) → ssgo107 (insolvency)
    // 브라우저 분석 결과: /ssgo/ssgo107/selectHmpgRhblBnkpCsGnrlCtt.on
    // 개회(253), 하단(210), 하면(214,245), 파산(017), 회생 등
    const insolvencyTypes = [
      '개회', '개확', '개보', '개기',  // 개인회생
      '하단', '하합', '하면', '하확', '하기', '하보',  // 파산
      '회단', '회합', '회확', '회기', '회보', '회',  // 회생
      '화', '화보',  // 도산화의
      '파', '파단', '파합',  // 비송
      '비단', '비합',  // 비송
      '간회단', '간회합',  // 간이회생
      '국승', '국지',  // 국제도산
      '253', '254', '255', '290',  // 개인회생 코드
      '209', '210', '214', '245', '295', '296', '256',  // 파산 코드
      '291', '292', '293', '294', '258',  // 회생 코드
      '017', '175', '176',  // 파산/재심
      '180', '018', '202',  // 회사정리/도산화의
    ];
    if (insolvencyTypes.includes(csDvsCd)) {
      return 'insolvency';
    }

    // 2. 새로운 매핑에서 카테고리 조회
    const korCategory = getCaseCategoryByTypeName(csDvsCd);
    if (korCategory) {
      return this.mapKorCategoryToEng(korCategory);
    }

    // 3. 숫자 코드인 경우 - 기존 하드코딩 로직 유지 (레거시 호환)
    // 가사 사건 (ssgo102)
    if (['150', '151', '162', '163', '022', '023', '024', '025', '026', '027', '028', '029'].includes(csDvsCd)) {
      return 'family';
    }
    // 형사 사건 (ssgo10g)
    if (['075', '076', '077', '078', '079', '080', '081', '082', '083', '084', '085'].includes(csDvsCd)) {
      return 'criminal';
    }
    // 민사 사건 (ssgo101)
    if (['001', '002', '003', '004', '005', '007', '009', '010', '011', '012'].includes(csDvsCd)) {
      return 'civil';
    }
    // 신청 사건 (ssgo105)
    if (['008', '069', '071', '072', '073', '074', '211'].includes(csDvsCd)) {
      return 'application';
    }
    // 집행 사건 (ssgo10a - 기타집행/Etexec)
    if (['013', '014', '120', '200', '300', '301'].includes(csDvsCd)) {
      return 'execution';
    }
    return 'other';
  }

  /**
   * 한글 카테고리를 영문 카테고리로 변환
   */
  private mapKorCategoryToEng(korCategory: string): 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'order' | 'other' {
    const categoryMap: Record<string, 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'order' | 'other'> = {
      '가사': 'family',
      '형사': 'criminal',
      '민사': 'civil',
      '신청': 'application',
      '집행': 'execution',
      '비송도산': 'insolvency',
      '보호': 'other',
      '행정': 'other',
      '특허': 'other',
      '선거특별': 'other',
      '감치': 'other',
      '가족관계등록공탁': 'family',
      '전자약식': 'criminal',
      '기타': 'other',
    };
    return categoryMap[korCategory] || 'other';
  }

  /**
   * 사건 카테고리에 따른 API 엔드포인트 결정
   * 기본 엔드포인트와 대체 엔드포인트 반환
   *
   * 브라우저 분석으로 확인된 엔드포인트 (2026.01.05):
   * - 전자독촉(차전): /ssgo/ssgo10c/selectHmpgElctnUrgngCsGnrlCtt.on ✅
   * - 회생/파산(개회,하단,하면): /ssgo/ssgo107/selectHmpgRhblBnkpCsGnrlCtt.on ✅
   * - 집행(타채): /ssgo/ssgo10a/selectHmpgEtexecCsGnrlCtt.on ✅
   */
  private getDetailApiEndpoints(caseCategory: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other'): string[] {
    // 브라우저 실제 API 호출에서 확인한 엔드포인트
    const primaryEndpoints: Record<string, string> = {
      family: '/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on',             // 가사사건
      criminal: '/ssgo/ssgo10g/selectHmpgCrmcsPbtrlCsGnrlCtt.on',     // 형사사건 (공판)
      civil: '/ssgo/ssgo101/selectHmpgCvlcsCsGnrlCtt.on',             // 민사사건
      application: '/ssgo/ssgo105/selectHmpgAplyCsGnrlCtt.on',        // 신청사건
      execution: '/ssgo/ssgo10a/selectHmpgEtexecCsGnrlCtt.on',         // 집행(타채) ✅ 브라우저 확인
      electronicOrder: '/ssgo/ssgo10c/selectHmpgElctnUrgngCsGnrlCtt.on',  // 전자독촉 (차전) - 브라우저 분석 결과
      insolvency: '/ssgo/ssgo107/selectHmpgRhblBnkpCsGnrlCtt.on',     // 회생/파산 (개회,하단,하면) - 브라우저 분석 결과
      order: '/ssgo/ssgo106/selectHmpgDccsCsGnrlCtt.on',              // 독촉사건 (일반)
      other: '/ssgo/ssgo101/selectHmpgCvlcsCsGnrlCtt.on',             // 기타 (민사)
    };

    // 대체 엔드포인트 (기본이 실패할 경우 시도)
    const fallbackEndpoints: Record<string, string[]> = {
      execution: [
        '/ssgo/ssgo10c/selectHmpgElctnUrgngCsGnrlCtt.on',  // 전자독촉 시도
        '/ssgo/ssgo101/selectHmpgCvlcsCsGnrlCtt.on',       // 민사로 폴백
      ],
      electronicOrder: [
        '/ssgo/ssgo106/selectHmpgDccsCsGnrlCtt.on',        // 일반 독촉 시도
        '/ssgo/ssgo10a/selectHmpgEtexecCsGnrlCtt.on',      // 집행 시도
      ],
      insolvency: [
        '/ssgo/ssgo103/selectHmpgDsnCsGnrlCtt.on',         // 구 도산 엔드포인트 시도
        '/ssgo/ssgo103/selectHmpgNssmCsGnrlCtt.on',        // 비송 시도
      ],
      order: [
        '/ssgo/ssgo10c/selectHmpgElctnUrgngCsGnrlCtt.on',  // 전자독촉 시도
        '/ssgo/ssgo10a/selectHmpgEtexecCsGnrlCtt.on',      // 집행 시도
      ],
    };

    const primary = primaryEndpoints[caseCategory] || primaryEndpoints.other;
    const fallbacks = fallbackEndpoints[caseCategory] || [];

    return [primary, ...fallbacks];
  }

  /**
   * 사건 카테고리에 따른 API 엔드포인트 결정 (단일 반환 - 호환성 유지)
   */
  private getDetailApiEndpoint(caseCategory: 'family' | 'criminal' | 'civil' | 'application' | 'execution' | 'insolvency' | 'electronicOrder' | 'order' | 'other'): string {
    return this.getDetailApiEndpoints(caseCategory)[0];
  }

  /**
   * csNoHistLst 생성 (14자리 포맷)
   *
   * 포맷: 연도(4) + 사건유형코드(3) + 일련번호(7, 0패딩)
   * 예: 2024드단26718 → 20241500026718
   *
   * 이 값을 전송하면 64자 encCsNo를 받을 수 있음 (캡챠 없이 재접근 가능)
   */
  private generateCsNoHistLst(csYr: string, csDvsCd: string, csSerial: string): string {
    const caseTypeCode = this.getCaseTypeCode(csDvsCd);
    const paddedSerial = csSerial.padStart(7, '0');
    const result = `${csYr}${caseTypeCode}${paddedSerial}`;
    console.log(`  csNoHistLst 생성: ${csYr}${csDvsCd}${csSerial} → ${result}`);
    return result;
  }

  /**
   * 캡챠 해결 후 검색 (재시도 포함)
   */
  async searchWithCaptcha(params: CaseSearchParams): Promise<CaseSearchResult> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 API 직접 호출로 사건 검색');
    console.log('='.repeat(60));
    console.log(`법원: ${params.cortCd}`);
    console.log(`사건: ${params.csYr}${params.csDvsCd}${params.csSerial}`);
    console.log(`당사자: ${params.btprNm}`);
    console.log('='.repeat(60));

    // 세션 초기화
    if (!this.session) {
      const sessionOk = await this.initSession();
      if (!sessionOk) {
        return { success: false, error: '세션 초기화 실패' };
      }
    }

    // 캡챠 해결 재시도 루프
    for (let attempt = 1; attempt <= this.maxCaptchaRetries; attempt++) {
      console.log(`\n📝 시도 ${attempt}/${this.maxCaptchaRetries}`);

      // 캡챠 이미지 및 토큰 획득
      const captchaData = await this.getCaptchaImage();

      if (!captchaData) {
        console.log('⚠️ 캡챠 이미지 획득 실패, 재시도...');
        continue;
      }

      // 캡챠 인식 (이미지 타입에 따라 최적 방식 선택)
      try {
        let captchaText: string | null = null;
        let confidence = 0;
        const useVisionFirst = shouldUseVisionAPI(captchaData.image);

        if (!useVisionFirst && isModelAvailable()) {
          // RGBA 이미지 (API 캡챠) - CNN 모델 우선 (98.47% 정확도)
          captchaText = await solveCaptchaWithModel(captchaData.image);
          if (captchaText) {
            confidence = 0.98;
            console.log(`  🤖 CNN 모델 인식: "${captchaText}" (RGBA 이미지)`);
          }
        }

        // CNN 실패 또는 RGB 이미지 - Vision API 사용
        if (!captchaText) {
          const solver = getVisionCaptchaSolver();
          const visionResult = await solver.solveCaptcha(captchaData.image);
          captchaText = visionResult.text;
          confidence = visionResult.confidence || 0;
          console.log(`  👁️ Vision API 인식: "${captchaText}" (신뢰도: ${(confidence * 100).toFixed(1)}%)`);
        }

        const captchaResult = { text: captchaText, confidence };

        if (!captchaResult.text) {
          console.log('  ⚠️ 캡챠 인식 실패');
          continue;
        }

        // 검색 실행 (검색 API는 인식된 텍스트만 사용)
        const result = await this.searchCase(params, captchaResult.text);

        if (result.success) {
          console.log('✅ 검색 성공!');
          // 민사사건용 captchaAnswer 반환 (답변 + 토큰 결합)
          const combinedCaptchaAnswer = captchaResult.text + captchaData.token;
          return { ...result, captchaAttempts: attempt, captchaAnswer: combinedCaptchaAnswer };
        }

        // 캡챠 오류인 경우 재시도
        if (result.error?.includes('캡챠') || result.error?.includes('captcha') || result.error?.includes('자동입력')) {
          console.log('  ⚠️ 캡챠 오류, 재시도...');
          continue;
        }

        // 다른 오류는 반환
        return { ...result, captchaAttempts: attempt };

      } catch (error) {
        console.log(`  ❌ 에러: ${error}`);
        continue;
      }
    }

    return {
      success: false,
      error: `${this.maxCaptchaRetries}회 시도 후 실패`,
      captchaAttempts: this.maxCaptchaRetries,
    };
  }

  /**
   * 세션 정보 반환
   */
  getSession(): SessionInfo | null {
    return this.session;
  }

  /**
   * WMONID 반환 (encCsNo 저장 시 함께 저장해야 함)
   */
  getWmonid(): string | null {
    return this.session?.wmonid || null;
  }

  /**
   * 세션 유효성 확인
   */
  isSessionValid(): boolean {
    if (!this.session) return false;

    // 세션이 30분 이상 지났으면 만료로 간주
    const elapsed = Date.now() - this.session.createdAt.getTime();
    return elapsed < 30 * 60 * 1000;
  }

  /**
   * 저장된 encCsNo로 캡챠 없이 상세 조회
   *
   * 핵심: encCsNo는 WMONID에 바인딩됨. 같은 WMONID를 사용해야 함.
   *
   * @param wmonid - encCsNo 생성 시 사용된 WMONID
   * @param encCsNo - 저장된 암호화 사건번호
   * @param params - 기본 사건 정보
   */
  async getCaseDetailWithStoredEncCsNo(
    wmonid: string,
    encCsNo: string,
    params: {
      cortCd: string;      // 법원명(한글) 또는 코드(숫자)
      csYear: string;
      csDvsCd: string;     // 사건유형(한글) 또는 코드(숫자)
      csSerial: string;
    }
  ): Promise<CaseDetailResult> {
    console.log('\n📋 저장된 encCsNo로 상세 조회 (캡챠 없음)...');
    console.log(`  WMONID: ${wmonid}`);
    console.log(`  encCsNo: ${encCsNo.substring(0, 30)}...`);

    // 해당 WMONID로 새 세션 초기화
    const sessionOk = await this.initSession(wmonid);
    if (!sessionOk) {
      return { success: false, error: '세션 초기화 실패' };
    }

    // 사건 카테고리 결정 (법원코드 변환에 필요)
    const caseCategory = this.getCaseCategory(params.csDvsCd);

    // 한글 법원명/사건유형을 숫자 코드로 변환 (사건 카테고리 고려)
    const cortCdNum = this.getCourtCode(params.cortCd, caseCategory);
    const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);
    console.log(`  법원코드: ${params.cortCd} → ${cortCdNum} (카테고리: ${caseCategory})`);
    console.log(`  사건유형코드: ${params.csDvsCd} → ${csDvsCdNum}`);

    // 캡챠 없이 상세 조회
    return this.getCaseDetail({
      cortCd: cortCdNum,
      csYear: params.csYear,
      csDvsCd: csDvsCdNum,
      csSerial: params.csSerial,
      btprNm: '',           // 저장된 사건은 당사자명 불필요
      encCsNo: encCsNo,
      captchaAnswer: '',    // 캡챠 불필요
    });
  }

  /**
   * API로 사건 검색 및 encCsNo 획득 (WMONID 바인딩)
   *
   * 반환값의 wmonid와 encCsNo를 함께 저장해야 나중에 재사용 가능
   * 64자 encCsNo 획득 시 자동으로 상세 조회까지 수행
   */
  async searchAndRegisterCase(params: CaseSearchParams): Promise<{
    success: boolean;
    wmonid?: string;
    encCsNo?: string;
    caseData?: any;
    detailData?: CaseDetailData;  // 상세 데이터 (기일 등)
    progressData?: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string; progCttDvs?: string }>;  // 진행내용 (별도 API)
    error?: string;
  }> {
    console.log('\n🔐 API로 사건 검색 및 등록...');

    // 새 세션 생성 (새 WMONID 획득)
    const sessionOk = await this.initSession();
    if (!sessionOk) {
      return { success: false, error: '세션 초기화 실패' };
    }

    const wmonid = this.session!.wmonid;
    console.log(`  WMONID: ${wmonid}`);

    // 캡챠 해결 + 검색
    const searchResult = await this.searchWithCaptcha(params);

    if (!searchResult.success || !searchResult.encCsNo) {
      return {
        success: false,
        error: searchResult.error || 'encCsNo 획득 실패',
      };
    }

    console.log(`  encCsNo: ${searchResult.encCsNo.substring(0, 30)}...`);
    console.log(`  encCsNo 길이: ${searchResult.encCsNo.length}자`);

    // 검색 결과에서 csNo 추출 (14자리 사건번호)
    // 응답 구조: { data: { dlt_csNoHistLst: [{ csNo: "...", encCsNo: "..." }] } }
    const csNo = searchResult.data?.data?.dlt_csNoHistLst?.[0]?.csNo || '';
    console.log(`  csNo: ${csNo}`);

    // 사건 카테고리 결정 (API 엔드포인트 선택용)
    const caseCategory = this.getCaseCategory(params.csDvsCd);
    console.log(`  사건 카테고리: ${caseCategory}`);

    // 상세 조회 (64자 또는 108자 encCsNo 모두 지원)
    let detailData: CaseDetailData | undefined;
    let progressData: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string; progCttDvs?: string }> | undefined;

    // 법원코드 변환 (진행내용 조회용 - 상세조회는 한글명 사용)
    const cortCdNum = this.getCourtCode(params.cortCd, caseCategory);
    const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);

    // 1. 상세 조회 (사건 카테고리에 따라 적절한 API 엔드포인트 사용)
    // 모든 사건유형에 encCsNo 사용 (검색 결과에서 받은 암호화된 사건번호)
    console.log(`\n📋 상세 조회 시도... (encCsNo: ${searchResult.encCsNo.length}자)`);
    try {
      const detailResult = await this.getCaseDetail({
        cortCd: params.cortCd,      // getCourtCode에서 숫자 코드로 변환
        csYear: params.csYr,
        csDvsCd: params.csDvsCd,    // getCaseTypeCode에서 숫자 코드로 변환
        csSerial: params.csSerial,  // getCaseDetail에서 7자리 패딩
        btprNm: params.btprNm,      // 당사자명 전달 (필수!)
        encCsNo: searchResult.encCsNo,  // 모든 사건유형에 encCsNo 사용
        captchaAnswer: '',          // captchaAnswer는 사용하지 않음
        csNo,                       // 14자리 사건번호 (검색 결과에서 추출)
        caseCategory,
      });

      if (detailResult.success && detailResult.data) {
        detailData = detailResult.data;
        console.log(`✅ 상세 조회 성공: 기일 ${detailData.hearings?.length || 0}건, 당사자 ${detailData.parties?.length || 0}명`);
        if (caseCategory === 'criminal') {
          console.log(`  피고인: ${detailData.dfndtNm}, 형제번호: ${detailData.crmcsNo}`);
        }
      } else {
        console.log(`⚠️ 상세 조회 실패: ${detailResult.error}`);
      }
    } catch (e) {
      console.log(`⚠️ 상세 조회 에러: ${e}`);
    }

    // 2. 진행내용 별도 조회 (모든 사건 유형 지원)
    // 진행내용 조회 지원 카테고리: family, civil, criminal, application, execution, electronicOrder, insolvency
    const progressSupportedCategories = ['family', 'civil', 'criminal', 'application', 'execution', 'electronicOrder', 'insolvency'];
    if (progressSupportedCategories.includes(caseCategory)) {
      console.log(`\n📋 진행내용 별도 조회 (${caseCategory})...`);
      try {
        const progressResult = await this.getCaseProgress({
          cortCd: cortCdNum,
          csYear: params.csYr,
          csDvsCd: csDvsCdNum,
          csSerial: params.csSerial,
          encCsNo: searchResult.encCsNo,
          caseCategory: caseCategory as 'family' | 'civil' | 'criminal' | 'application' | 'execution' | 'electronicOrder' | 'insolvency',
        });

        if (progressResult.success && progressResult.progress) {
          progressData = progressResult.progress;
          console.log(`✅ 진행내용 조회 성공: ${progressData.length}건`);
        } else {
          console.log(`⚠️ 진행내용 조회 실패: ${progressResult.error}`);
        }
      } catch (e) {
        console.log(`⚠️ 진행내용 조회 에러: ${e}`);
      }
    }

    return {
      success: true,
      wmonid: wmonid,
      encCsNo: searchResult.encCsNo,
      caseData: searchResult.data,
      detailData,
      progressData,
    };
  }
}

// 싱글톤 인스턴스
let apiClient: ScourtApiClient | null = null;

export function getScourtApiClient(): ScourtApiClient {
  if (!apiClient) {
    apiClient = new ScourtApiClient();
  }
  return apiClient;
}
