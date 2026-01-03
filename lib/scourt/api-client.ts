/**
 * 대법원 나의사건검색 API 클라이언트
 * 브라우저 없이 직접 API 호출로 사건 검색
 *
 * 기능:
 * - 세션 생성: ✅ 작동
 * - 캡챠 이미지/토큰 획득: ✅ 작동
 * - 사건 검색: ✅ 작동
 * - 상세 정보 조회: ❌ WebSquare5 보안 차단 (W_0107)
 *
 * 상세 정보 조회가 필요한 경우 Puppeteer 기반 스크래퍼 사용 필요:
 * - lib/scourt/scraper-v2.ts
 */

import { getVisionCaptchaSolver } from '../google/vision-captcha-solver';
import { solveCaptchaWithModel, isModelAvailable, shouldUseVisionAPI } from './captcha-solver';

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
   * 사건 상세 정보 조회 (가사 사건)
   */
  async getCaseDetail(params: {
    cortCd: string;       // 법원코드 (숫자)
    csYear: string;       // 연도
    csDvsCd: string;      // 사건유형코드 (숫자)
    csSerial: string;     // 일련번호
    btprNm: string;       // 당사자명
    encCsNo: string;      // 암호화된 사건번호 (검색 결과에서)
    captchaAnswer: string; // 캡챠 답
  }): Promise<CaseDetailResult> {
    if (!this.session) {
      return { success: false, error: '세션이 초기화되지 않았습니다.' };
    }

    console.log('📋 사건 상세 정보 조회 중...');

    try {
      const requestBody = {
        dma_search: {
          cortCd: params.cortCd,
          csNo: '',
          encCsNo: params.encCsNo,
          csYear: params.csYear,
          csDvsCd: params.csDvsCd,
          csSerial: params.csSerial,
          btprtNm: params.btprNm,
          captchaAnswer: params.captchaAnswer,
        },
      };

      console.log('상세 조회 요청:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseUrl}/ssgo/ssgo102/selectHmpgFmlyCsGnrlCtt.on`, {
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

      // 오류 체크 (다양한 형태의 오류 응답 처리)
      if (data.error || data.errMsg || data.errors?.errorMessage) {
        return {
          success: false,
          error: data.error || data.errMsg || data.errors?.errorMessage,
        };
      }

      // 응답 데이터 파싱
      const detailData = this.parseDetailResponse(data);

      return {
        success: true,
        data: detailData,
      };
    } catch (error) {
      console.error('❌ 상세 API 호출 실패:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 사건 진행내용 조회 (가사 사건)
   *
   * 일반내용(selectHmpgFmlyCsGnrlCtt)과 별도로 진행내용을 조회해야 함
   */
  async getCaseProgress(params: {
    cortCd: string;
    csYear: string;
    csDvsCd: string;
    csSerial: string;
    encCsNo: string;
  }): Promise<{ success: boolean; progress?: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string }>; error?: string }> {
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

      // 진행내용 API 엔드포인트
      const response = await fetch(`${this.baseUrl}/ssgo/ssgo102/selectHmpgFmlyCsProgCtt.on`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Cookie': `WMONID=${this.session.wmonid}; JSESSIONID=${this.session.jsessionId}`,
          // 브라우저와 동일한 submissionid (진행내용 탭 전용)
          'submissionid': 'mf_ssgoTopMainTab_contents_content1_body_wfSsgoDetail_ssgoCsDetailTab_contents_ssgoTab2_body_sbm_srchProgCtt',
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
        // 브라우저 응답 필드명: progYmd, progCtt, progRslt
        prcdDt: p.progYmd || p.prgrDt || p.prcdDt || p.evntDt || '',
        prcdNm: p.progCtt || p.prgrCtt || p.prcdNm || p.evntNm || p.cttNm || '',
        prcdRslt: p.progRslt || p.prgrRslt || p.rslt || p.dlvyDt || '',  // 결과 또는 도달일
      }));

      console.log(`📋 진행내용 ${progress.length}건 파싱 완료`);
      if (progress.length > 0) {
        console.log(`  첫번째: ${progress[0].prcdDt} - ${progress[0].prcdNm}`);
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
   * API 응답 구조 (가사 사건):
   * - dma_csBasCtt: 기본 정보 (csNm, rprsClmntNm, rprsAcsdNm, userCsNo 등)
   * - dlt_rcntDxdyLst: 최근 기일 정보
   * - dlt_btprtCttLst: 당사자 정보
   * - dlt_rcntSbmsnDocmtLst: 제출 서류
   * - dlt_reltCsLst: 연관 사건
   */
  private parseDetailResponse(response: any): CaseDetailData {
    const result: CaseDetailData = {
      raw: response,
    };

    try {
      // 기본 정보 추출 (다양한 응답 구조 대응)
      // 실제 API 응답: data.dma_csBasCtt (가사 사건의 기본정보)
      const caseInfo = response?.data?.dma_csBasCtt ||
                       response?.data?.dma_csBsCtt ||
                       response?.data?.dma_gnrlCtt ||
                       response?.data;

      if (caseInfo) {
        result.csNo = caseInfo.userCsNo || caseInfo.csNo;
        result.csDvsNm = caseInfo.csDvsNm;
        result.cortNm = caseInfo.cortNm;
        result.csNm = caseInfo.csNm;
        result.prcdStsCd = caseInfo.prcdStsCd;
        result.prcdStsNm = caseInfo.prcdStsNm;
        // 원고/피고명 (여러 필드명 대응)
        result.aplNm = caseInfo.aplNm || caseInfo.rprsClmntNm;
        result.rspNm = caseInfo.rspNm || caseInfo.rprsAcsdNm;

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

      // 응답에 어떤 필드가 있는지 디버그 로깅
      const availableFields = response?.data ? Object.keys(response.data) : [];
      console.log(`📋 상세 파싱 완료: 기일 ${result.hearings?.length || 0}건, 진행 ${result.progress?.length || 0}건, 당사자 ${result.parties?.length || 0}명, 대리인 ${result.representatives?.length || 0}명`);
      console.log(`📋 응답 필드 목록: ${availableFields.join(', ')}`);
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

          // 법원코드 변환 (이름 → 숫자코드)
          const cortCdNum = this.getCourtCode(params.cortCd);
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
   */
  private getCourtCode(cortNm: string): string {
    // 주요 법원 코드 매핑 (확장 필요)
    // 약식명(평택가정)과 정식명(수원가정법원 평택지원) 모두 지원
    const courtCodes: Record<string, string> = {
      // 수원가정법원 계열
      '수원가정법원': '000302',
      '수원가정': '000302',
      '수원가정법원 성남지원': '000303',
      '성남가정': '000303',
      '수원가정법원 여주지원': '000304',
      '여주가정': '000304',
      '수원가정법원 평택지원': '000305',
      '평택가정': '000305',
      '수원가정법원 안양지원': '000306',
      '안양가정': '000306',
      '수원가정법원 안산지원': '000322',
      '안산가정': '000322',
      // 기타 주요 법원
      '서울가정법원': '000201',
      '서울가정': '000201',
      '인천가정법원': '000401',
      '인천가정': '000401',
      '대전가정법원': '000501',
      '대전가정': '000501',
      '대구가정법원': '000601',
      '대구가정': '000601',
      '부산가정법원': '000701',
      '부산가정': '000701',
      '광주가정법원': '000801',
      '광주가정': '000801',
      '울산가정법원': '000132',
      '울산가정': '000132',
    };

    // 숫자 코드면 그대로 반환
    if (/^\d+$/.test(cortNm)) {
      return cortNm;
    }

    return courtCodes[cortNm] || cortNm;
  }

  /**
   * 사건유형 이름을 코드로 변환
   */
  private getCaseTypeCode(csDvsNm: string): string {
    // 주요 사건유형 코드 매핑 (확장 필요)
    const caseTypeCodes: Record<string, string> = {
      '드단': '150',    // 가사단독
      '드합': '151',    // 가사합의
      '느단': '140',    // 가사비송단독
      '느합': '141',    // 가사비송합의
      '호': '120',      // 호적
      '르': '160',      // 가사조정
    };

    // 숫자 코드면 그대로 반환
    if (/^\d+$/.test(csDvsNm)) {
      return csDvsNm;
    }

    return caseTypeCodes[csDvsNm] || csDvsNm;
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
          return { ...result, captchaAttempts: attempt };
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

    // 한글 법원명/사건유형을 숫자 코드로 변환
    const cortCdNum = this.getCourtCode(params.cortCd);
    const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);
    console.log(`  법원코드: ${params.cortCd} → ${cortCdNum}`);
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
    progressData?: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string }>;  // 진행내용 (별도 API)
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

    // 64자 encCsNo인 경우 캡챠 없이 상세 조회 시도
    let detailData: CaseDetailData | undefined;
    let progressData: Array<{ prcdDt: string; prcdNm: string; prcdRslt?: string }> | undefined;

    if (searchResult.encCsNo.length === 64) {
      const cortCdNum = this.getCourtCode(params.cortCd);
      const csDvsCdNum = this.getCaseTypeCode(params.csDvsCd);

      // 1. 일반내용 (기본정보, 기일) 조회
      console.log('\n📋 64자 encCsNo로 상세 조회 시도...');
      try {
        const detailResult = await this.getCaseDetail({
          cortCd: cortCdNum,
          csYear: params.csYr,
          csDvsCd: csDvsCdNum,
          csSerial: params.csSerial,
          btprNm: '',
          encCsNo: searchResult.encCsNo,
          captchaAnswer: '',  // 64자 encCsNo는 캡챠 불필요
        });

        if (detailResult.success && detailResult.data) {
          detailData = detailResult.data;
          console.log(`✅ 상세 조회 성공: 기일 ${detailData.hearings?.length || 0}건`);
        } else {
          console.log(`⚠️ 상세 조회 실패: ${detailResult.error}`);
        }
      } catch (e) {
        console.log(`⚠️ 상세 조회 에러: ${e}`);
      }

      // 2. 진행내용 별도 조회
      console.log('\n📋 진행내용 별도 조회...');
      try {
        const progressResult = await this.getCaseProgress({
          cortCd: cortCdNum,
          csYear: params.csYr,
          csDvsCd: csDvsCdNum,
          csSerial: params.csSerial,
          encCsNo: searchResult.encCsNo,
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
