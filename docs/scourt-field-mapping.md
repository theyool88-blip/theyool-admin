# SCOURT API 필드 매핑

> 실제 API 응답에서 수집한 필드명 (2026.01.07 기준)

## 기본 정보 필드 (dma_csBasCtt)

### 공통 필드 (모든 사건유형)

| API 필드명 | 한글 라벨 | 설명 | 예시값 |
|-----------|----------|------|-------|
| `cortCd` | 법원코드 | 법원 코드 | "0610" |
| `cortNm` | 법원 | 법원명 | "수원가정법원 평택지원" |
| `csNo` | 사건번호(내부) | 내부용 사건번호 | "20240640020475" |
| `userCsNo` | 사건번호 | 표시용 사건번호 | "2024드단20475" |
| `csNm` | 사건명 | 사건명 | "이혼 등" |
| `jdbnCd` | 재판부코드 | 재판부 코드 | "1" |
| `jdbnNm` | 재판부 | 재판부/담당계 | "가사1단독" |
| `lwstDvsCd` | 소송구분코드 | 소송 구분 코드 | "M" |
| `encCsNo` | 암호화사건번호 | 캡챠 없이 재접근용 | "uC8eLq9x..." |

### 당사자 필드

| API 필드명 | 한글 라벨 | 사건유형 | 설명 |
|-----------|----------|---------|------|
| `rprsClmntNm` | 원고 | 민사/가사 | 대표원고명 |
| `rprsAcsdNm` | 피고 | 민사/가사 | 대표피고명 |
| `rprsPtnrNm` | 채권자 | 신청/집행 | 대표채권자명 |
| `rprsRqstrNm` | 채무자 | 신청/집행 | 대표채무자명 |
| `rprsAplcntNm` | 신청인 | 회생/파산 | 대표신청인명 |
| `rprsRspndnNm` | 상대방 | 회생/파산 | 대표상대방명 |
| `btprtNm` | 피고인명 | 형사 | 피고인명 |
| `rprsGrnshNm` | 압류채권자 | 신청/집행 | 대표압류채권자명 |
| `titRprsPtnr` | 원고측라벨 | 공통 | 원고측 당사자 라벨 ("원고", "채권자" 등) |
| `titRprsRqstr` | 피고측라벨 | 공통 | 피고측 당사자 라벨 ("피고", "채무자" 등) |

### 일자 필드

| API 필드명 | 한글 라벨 | 사건유형 | 설명 |
|-----------|----------|---------|------|
| `csRcptYmd` | 접수일 | 공통 | 사건 접수일 (YYYYMMDD) |
| `csUltmtYmd` | 종국일 | 공통 | 종국 일자 |
| `csCfmtnYmd` | 확정일 | 공통 | 판결 확정일 |
| `adjdocRchYmd` | 판결도달일 | 민사/가사 | 판결문 도달일 |
| `aplYmd` | 상소일 | 공통 | 상소 제기일 |
| `aplRjctnYmd` | 상소각하일 | 공통 | 상소 각하일 |
| `dcsnstDlvrYmd` | 결정송달일 | 집행 | 결정문 송달일 |
| `prwcChgYmd` | 절차변경일 | 집행 | 절차 변경일 |

### 회생/파산 전용 일자

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `csCmdcYmd` | 개시결정일 | 회생/파산 개시결정일 |
| `crdtrDdlnYmd` | 채권이의마감일 | 채권이의 마감일 |
| `repayKjDay` | 변제계획안인가일 | 변제계획안 인가일 |

### 결과/상태 필드

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `csUltmtDvsNm` | 종국결과 | 종국 결과 (판결, 화해 등) |
| `csUltmtDtlCtt` | 종국상세 | 종국 상세내용 |
| `csPrsrvYn` | 보존여부 | 기록 보존 여부 (Y/N) |

### 금액 필드

| API 필드명 | 한글 라벨 | 사건유형 | 설명 |
|-----------|----------|---------|------|
| `stmpAtchAmt` | 인지액 | 공통 | 인지액 |
| `clmntVsml` | 원고소가 | 민사/가사 | 원고 소송가액 |
| `acsdVsml` | 피고소가 | 민사/가사 | 피고 소송가액 |
| `csClmAmt` | 청구금액 | 집행 | 청구금액 |

### 구분 필드

| API 필드명 | 한글 라벨 | 사건유형 | 설명 |
|-----------|----------|---------|------|
| `csTkpDvsNm` | 수리구분 | 민사/신청/집행 | 수리 구분 |
| `csTkpDvsCdNm` | 수리구분 | 가사/항소 | 수리 구분 |
| `csMrgTypNm` | 병합구분 | 공통 | 병합 구분 |

### 형사 전용 필드

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `prsctrCsNoLstCtt` | 검찰사건번호 | 검찰 사건번호 |
| `btprtUltmtThrstCtt` | 선고형량 | 선고 형량 |
| `acsApelPrpndYmd` | 피고인상소일 | 피고인 상소 제기일 |
| `aplPrpndRsltYmd` | 상소결과일 | 상소 결과일 |

### 회생/파산 전용 필드

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `rhblCmsnrNm` | 회생위원 | 회생위원명 |
| `rhblCmsnrTelno` | 회생위원전화번호 | 회생위원 전화번호 |

### 집행 전용 필드

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `telNo` | 전화번호 | 담당계 전화번호 |
| `thrdDbtrNm` | 제3채무자 | 제3채무자명 |

---

## LIST 필드 (배열)

| API 필드명 | 한글 라벨 | 설명 |
|-----------|----------|------|
| `dlt_btprtCttLst` | 당사자 | 당사자 목록 |
| `dlt_agntCttLst` | 대리인 | 대리인 목록 |
| `dlt_rcntDxdyLst` | 최근기일 | 최근 기일 목록 |
| `dlt_reltCsLst` | 관련사건 | 관련사건 목록 |
| `dlt_inscrtDtsLst` | 심급내용 | 원심/상급심 정보 |
| `dlt_sbmtDocLst` | 제출서류 | 제출서류 목록 |
| `dlt_coltnCtt` | 담보내용 | 담보내용 목록 |

---

## 사건유형별 필드 존재 여부

| 필드명 | 민사 | 가사 | 형사 | 신청 | 집행 | 독촉 | 회생 |
|--------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| csRcptYmd | O | O | O | O | O | O | O |
| jdbnNm | O | O | O | O | O | O | O |
| rprsClmntNm | O | O | - | - | - | - | - |
| rprsAcsdNm | O | O | - | - | - | - | - |
| rprsPtnrNm | - | - | - | O | O | - | - |
| rprsRqstrNm | - | - | - | O | O | - | - |
| btprtNm | - | - | O | - | - | - | - |
| rprsAplcntNm | - | - | - | - | - | - | O |
| stmpAtchAmt | O | O | - | - | - | - | - |
| clmntVsml | O | O | - | - | - | - | - |
| acsdVsml | O | O | - | - | - | - | - |
| csClmAmt | - | - | - | - | O | - | - |
| dcsnstDlvrYmd | - | - | - | - | O | - | - |
| csCmdcYmd | - | - | - | - | - | - | O |
| crdtrDdlnYmd | - | - | - | - | - | - | O |
| rhblCmsnrNm | - | - | - | - | - | - | O |
| prsctrCsNoLstCtt | - | - | O | - | - | - | - |

---

## API 필드 → UI 한글 라벨 매핑

field-renderer.ts에서 사용할 매핑:

```typescript
// API 필드명 → 한글 라벨
export const API_FIELD_LABELS: Record<string, string> = {
  // 기본 정보
  cortNm: '법원',
  userCsNo: '사건번호',
  csNm: '사건명',
  jdbnNm: '재판부',
  jdbnTelno: '재판부전화번호',

  // 당사자
  rprsClmntNm: '원고',
  rprsAcsdNm: '피고',
  rprsPtnrNm: '채권자',
  rprsRqstrNm: '채무자',
  rprsAplcntNm: '신청인',
  rprsRspndnNm: '상대방',
  btprtNm: '피고인명',
  thrdDbtrNm: '제3채무자',

  // 일자
  csRcptYmd: '접수일',
  csUltmtYmd: '종국일',
  csCfmtnYmd: '확정일',
  adjdocRchYmd: '판결도달일',
  aplYmd: '상소일',
  aplRjctnYmd: '상소각하일',
  dcsnstDlvrYmd: '결정송달일',

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

  // 집행 전용
  telNo: '전화번호',
};
```

---

## 참고: 실제 API 응답 구조

```json
{
  "data": {
    "dma_csBasCtt": {
      "cortCd": "0610",
      "cortNm": "수원가정법원 평택지원",
      "csNo": "20240640020475",
      "userCsNo": "2024드단20475",
      "csNm": "이혼 등",
      "jdbnNm": "가사1단독",
      "jdbnTelno": "031-650-3126",
      "rprsClmntNm": "홍길동",
      "rprsAcsdNm": "김철수",
      "csRcptYmd": "20241015",
      "stmpAtchAmt": "20000",
      ...
    },
    "dlt_btprtCttLst": [...],
    "dlt_agntCttLst": [...],
    "dlt_rcntDxdyLst": [...],
    "dlt_reltCsLst": [...]
  }
}
```
