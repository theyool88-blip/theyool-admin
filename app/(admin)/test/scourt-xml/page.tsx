/**
 * SCOURT XML 기반 일반내용 테스트 페이지
 */

"use client";

import { ScourtGeneralInfoXml } from "@/components/scourt/ScourtGeneralInfoXml";

// 가사 사건 (2024드단531) 실제 API 응답 데이터
const testApiData = {
  dma_csBasCtt: {
    cortCd: "000305",
    csNo: "20241500000531",
    csNm: "이혼 등",
    rprsClmntNm: "장OO",
    clmntCnt: 1,
    rprsAcsdNm: "이OO",
    acsdCnt: 1,
    csDstrtYn: "Y",
    jdbnCd: "1001",
    jdbnNm: "가사1단독",
    ultmtJdbnNm: "가사1단독",
    jdbnTelno: "031-650-3126(재판일:수, 법원은 중립기관으로 법률상담이 불가합니다.)",
    cfupMarkNm: "",
    csRcptYmd: "20241004",
    csUltmtYmd: "20250409",
    csUltmtDtlCtt: "원고일부승",
    csMrgTypCd: "0",
    adjdocRchYmd: "20250617",
    aplYmd: "",
    aplRjctnYmd: "",
    hskpExmnrJdbnCd: "",
    exmnrAcptnYn: "",
    csPrsrvYn: "Y",
    lwstDvsCd: "2",
    stmpAtchAmt: 70000,
    stmpRfndAmt: 0,
    csCfmtnYmd: "20250701",
    dxdyRqrdSchdTimeRlsYn: "N",
    vdeoJdcpcProgYn: "N",
    userCsNo: "2024드단531",
    amtYn: "Y",
    prsvCtt: "보존",
    cortNm: "수원가정법원 평택지원",
    ultmtDvsNm: "",
    csMrgTypNm: "없음",
    exmnrNm: "",
    exmnrTelNo: "",
    titRprsPtnr: "원고",
    titRprsRqstr: "피고",
    isHrngProgCurst: "N",
    encCsNo: "encrypted_case_number",
  },
  dlt_btprtCttLst: [
    {
      btprtDvsNm: "원고",
      btprtNm: "장OO",
      ultmtDvsNm: "",
      adjdocRchYmd: "20250617",
      indvdCfmtnYmd: "20250701",
    },
    {
      btprtDvsNm: "피고",
      btprtNm: "이OO",
      ultmtDvsNm: "",
      adjdocRchYmd: "",
      indvdCfmtnYmd: "",
    },
  ],
  dlt_agntCttLst: [
    {
      agntDvsNm: "원고 소송대리인",
      agntNm: "법무법인 더윤(담당변호사 김OO)",
    },
  ],
  dlt_rcntDxdyLst: [
    {
      dxdyYmd: "20250409",
      dxdyHm: "1030",
      dxdyKndCd: "01",
      dxdyKndNm: "변론기일",
      dxdyPlcNm: "제1호 법정",
      dxdyRsltCd: "01",
      dxdyRsltNm: "선고",
    },
    {
      dxdyYmd: "20250312",
      dxdyHm: "1400",
      dxdyKndCd: "01",
      dxdyKndNm: "변론기일",
      dxdyPlcNm: "제1호 법정",
      dxdyRsltCd: "02",
      dxdyRsltNm: "변론종결",
    },
    {
      dxdyYmd: "20250205",
      dxdyHm: "1100",
      dxdyKndCd: "01",
      dxdyKndNm: "변론기일",
      dxdyPlcNm: "제1호 법정",
      dxdyRsltCd: "03",
      dxdyRsltNm: "속행",
    },
  ],
};

export default function ScourtXmlTestPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        SCOURT XML 기반 일반내용 테스트
      </h1>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h2 className="font-medium text-blue-800">테스트 사건</h2>
        <p className="text-sm text-blue-600">
          2024드단531 (가사) - 수원가정법원 평택지원
        </p>
      </div>

      <ScourtGeneralInfoXml apiData={testApiData} caseType="ssgo102" />
    </div>
  );
}
