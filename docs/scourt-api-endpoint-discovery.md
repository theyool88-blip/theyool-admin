# SCOURT 나의사건검색 API 가이드

## 개요

대법원 나의사건검색(ssgo.scourt.go.kr)은 사건 유형별로 다른 API 엔드포인트를 사용합니다.
공식 문서가 없으므로 브라우저 개발자 도구를 통해 실제 API 호출을 분석해야 합니다.

---

## API 엔드포인트 목록

### 일반내용 엔드포인트

| 카테고리 | 모듈 | 사건유형 예시 | 엔드포인트 | 상태 |
|---------|------|-------------|-----------|------|
| 민사 | ssgo101 | 가단, 가소, 가합, 머 | `selectHmpgCvlcsCsGnrlCtt.on` | ✅ 확인 |
| 가사 | ssgo102 | 드단, 느단, 르 | `selectHmpgFmlyCsGnrlCtt.on` | ✅ 확인 |
| 형사 | ssgo10g | 고단, 고합, 노 | `selectHmpgCrmcsPbtrlCsGnrlCtt.on` | ✅ 확인 |
| 신청/보전 | ssgo105 | 카기, 카불, 카확, 즈단, 아 | `selectHmpgAplyCsGnrlCtt.on` | ✅ 확인 |
| 집행 | ssgo10a | 타채 | `selectHmpgEtexecCsGnrlCtt.on` | ✅ 확인 |
| 전자독촉 | ssgo10c | 차전 | `selectHmpgElctnUrgngCsGnrlCtt.on` | ✅ 확인 |
| 회생/파산 | ssgo107 | 개회, 하단, 하면 | `selectHmpgRhblBnkpCsGnrlCtt.on` | ✅ 확인 |
| 항고/재항고 | ssgo108 | 스, 브, 그 | `selectHmpgApalRaplCsGnrlCtt.on` | ✅ 확인 |
| **보호** | **ssgo10i** | **동버, 푸** | `selectHmpgFamlyPrtctCsGnrlCtt.on` | ✅ **신규 (2026.01.07)** |
| **감치/기타** | **ssgo106** | **정명** | `selectHmpgEtcCsGnrlCtt.on` | ✅ **신규 (2026.01.07)** |

### 진행내용 엔드포인트

| 카테고리 | 모듈 | 엔드포인트 | 상태 |
|---------|------|-----------|------|
| 민사 | ssgo101 | `selectHmpgCvlcsCsProgCtt.on` | ✅ 확인 |
| 가사 | ssgo102 | `selectHmpgFmlyCsProgCtt.on` | ✅ 확인 |
| 형사 | ssgo10g | `selectHmpgCrmcsPbtrlCsProgCtt.on` | ✅ 확인 |
| 신청/보전 | ssgo105 | `selectHmpgAplyCsProgCtt.on` | ✅ 확인 |
| 집행 | ssgo10a | `selectHmpgEtexecCsProgCtt.on` | ✅ 확인 |
| 전자독촉 | ssgo10c | `selectHmpgElctnUrgngCsProgCtt.on` | ✅ 확인 |
| 회생/파산 | ssgo107 | `selectHmpgRhblBnkpCsProgCtt.on` | ✅ 확인 |
| 항고/재항고 | ssgo108 | `selectHmpgApalRaplCsProgCtt.on` | ✅ 확인 |
| **보호** | **ssgo10i** | `selectHmpgFamlyPrtctCsProgCtt.on` | ✅ **신규 (2026.01.07)** |
| **감치/기타** | **ssgo106** | `selectHmpgEtcCsProgCtt.on` | ✅ **신규 (2026.01.07)** |

---

## 모듈 ID 매핑

| 모듈 ID | 설명 | 영문 약어 | 비고 |
|--------|------|---------|------|
| ssgo100 | 공통/검색 | Common | 사건 검색 API |
| ssgo101 | 민사 | Cvlcs | 민사조정(머) 포함 |
| ssgo102 | 가사 | Fmly | 가사항소(르) 포함 |
| ssgo103 | 비송/도산 (구) | Nssm/Dsn | 미사용 |
| ssgo104 | 집행 (구) | Excn | **미사용** - ssgo10a 사용 |
| ssgo105 | 신청 | Aply | 카불, 카확, 아(행정신청) 등 |
| ssgo106 | **감치/기타** | **Etc** | **정명 등 (2026.01.07 확인)** |
| ssgo107 | 회생/파산 | RhblBnkp | 개회, 하단, 하면 |
| ssgo108 | 항고/재항고 | ApalRapl | 스, 브, 그 |
| **ssgo10i** | **보호** | **FamlyPrtct** | **동버, 푸 (2026.01.07 추가)** |
| ssgo10a | 집행 (기타) | Etexec | 타채 등 |
| ssgo10c | 전자독촉 | ElctnUrgng | 차전 |
| ssgo10g | 형사 | CrmcsPbtrl | 고단, 노 등 |

> **주의**: ssgo104(Excn)는 실제로 동작하지 않음. 집행 사건은 ssgo10a(Etexec) 사용.

---

## 사건유형별 카테고리 분류

### 민사 (ssgo101)
- 가단, 가소, 가합, 가기 (본안)
- 머 (민사조정)
- 나 (항소심)

### 가사 (ssgo102)
- 드단, 드합 (가사소송)
- 느단, 느합 (가사비송)
- 르 (가사항소)
- 너 (가사비송항고)

### 항고/재항고 (ssgo108) - 신규
- 스 (특별항고)
- 브 (가사후견항고)
- 그 (민사항고)

> **주의**: 너(가사비송항고)는 ssgo102(가사) 엔드포인트 사용

### 형사 (ssgo10g)
- 고단, 고합 (1심)
- 노 (항소심)
- 도 (상고심)

### 신청/보전 (ssgo105)
- 카단, 카합 (가압류/가처분)
- 카기 (증거보전 등)
- 카불 (채무불이행자명부등재)
- 카확 (소송비용확정)
- 즈단, 즈기 (가사보전)
- 아 (행정신청/집행정지) - 2026.01.07 추가

### 집행 (ssgo10a)
- 타채 (채권압류/추심명령)
- 타경 (경매)
- 타기 (집행신청)

### 전자독촉 (ssgo10c)
- 차전 (전자지급명령)
- 차 (일반지급명령)

### 회생/파산 (ssgo107)
- 개회, 개확, 개기 (개인회생)
- 하단, 하합, 하면 (파산/면책)
- 회단, 회합 (법인회생)

### 보호 (ssgo10i) - 신규 (2026.01.07)
- 동버 (가정보호/아동학대)
- 푸 (소년보호)

> **참고**: 보호 사건은 가사/가정 관련이지만 별도 엔드포인트(ssgo10i) 사용

### 감치/기타 (ssgo106) - 신규 (2026.01.07)
- 정명 (채무자감치)
- 정 (감치 기타)

> **참고**: 감치 사건은 ssgo106(Etc) 엔드포인트 사용. 기존 문서에서 "독촉(일반)"으로 표기되었으나 실제로는 "기타(Etc)" 사건 처리

---

## URL 구조

```
/ssgo/{모듈ID}/{함수명}.on
```

### 함수명 패턴

| 패턴 | 설명 |
|-----|------|
| `selectHmpg{유형}CsGnrlCtt` | 일반내용 조회 |
| `selectHmpg{유형}CsProgCtt` | 진행내용 조회 |
| `selectHmpgCsSrchRsltLst` | 검색 결과 목록 |

---

## 요청/응답 형식

### 검색 요청

```typescript
interface SearchRequest {
  dma_search: {
    cortCd: string;      // 법원명 또는 코드
    cdScope: string;     // "ALL"
    csNoHistLst: string; // 사건번호 (14자리: 연도4+유형3+일련번호7)
    csDvsCd: string;     // 사건유형명 (예: "타채")
    csYr: string;        // 연도
    csSerial: string;    // 일련번호
    btprNm: string;      // 당사자명
    answer: string;      // 캡챠 답변
    fullCsNo: string;    // 빈 문자열
  }
}
```

### 검색 응답

```typescript
interface SearchResponse {
  status: number;        // 200 = 성공
  data: {
    dlt_csNoHistLst: Array<{
      csNo: string;      // 사건번호 (14자리)
      encCsNo: string;   // 암호화된 사건번호 (64자)
    }>;
  }
}
```

### 일반내용 조회 요청

```typescript
interface GeneralRequest {
  dma_search: {
    cortCd: string;      // 법원코드 (숫자 6자리)
    encCsNo: string;     // 암호화된 사건번호 (64자)
    csYear: string;      // 연도
    csDvsCd: string;     // 사건유형코드 (숫자 3자리)
    csSerial: string;    // 일련번호
    btprtNm: string;     // 당사자명
    csDvsNm: string;     // 사건유형명
    progCttDvs: string;  // "0" (전체)
    srchDvs: string;     // "" 또는 "06"
    // ... 기타 필드 (빈 문자열)
  }
}
```

### 진행내용 요청

```typescript
interface ProgressRequest {
  dma_search: {
    cortCd: string;      // 법원코드
    csNo: string;        // 사건번호 (14자리)
    encCsNo: string;     // 암호화된 사건번호
    csYear: string;      // 연도
    csDvsCd: string;     // 사건유형코드
    csSerial: string;    // 일련번호 (7자리, 0패딩)
    progCttDvs: string;  // "0" (전체)
    srchDvs: string;     // "06" (저장된 사건)
  }
}
```

---

## 주요 파라미터

### srchDvs (검색구분)

| 값 | 설명 |
|----|------|
| "" | 일반 검색 (캡챠 필요) |
| "06" | 저장된 사건 조회 (캡챠 불필요) |

### encCsNo (암호화된 사건번호)

- 64자 Base64 인코딩 문자열
- 세션(WMONID)에 바인딩됨
- 다른 세션에서 재사용 불가
- DB에 저장하여 재접근 시 캡챠 우회 가능

### csNo (사건번호 포맷)

```
연도(4) + 사건유형코드(3) + 일련번호(7, 0패딩)
예: 2024타채33630 → 20242000033630
```

---

## 법원코드 매핑

### 축약형 → 정식명칭

| 축약형 | 정식명칭 |
|-------|---------|
| 평택지원 | 수원지방법원 평택지원 |
| 평택가정 | 수원가정법원 평택지원 |
| 천안지원 | 대전지방법원 천안지원 |
| 천안가정 | 대전가정법원 천안지원 |
| 공주지원 | 대전지방법원 공주지원 |
| 서산지원 | 대전지방법원 서산지원 |
| 의정부지법 | 의정부지방법원 |
| 대전지법 | 대전지방법원 |
| 수원고법 | 수원고등법원 |

전체 목록은 `lib/scourt/court-codes.ts`의 `COURT_ABBREV_MAP` 참조.

---

## 사건유형 코드

주요 코드 (전체 325개는 `lib/scourt/case-type-codes.ts` 참조):

| 코드 | 사건유형 | 카테고리 |
|-----|---------|---------|
| 001 | 가단 | 민사 |
| 002 | 가합 | 민사 |
| 021 | 머 | 민사(조정) |
| 077 | 고단 | 형사 |
| 079 | 노 | 형사(항소) |
| 150 | 드단 | 가사 |
| 160 | 느단 | 가사(비송) |
| 165 | 르 | 가사(항소) |
| 177 | 즈단 | 신청(가사보전) |
| 200 | 타채 | 집행 |
| 236 | 카불 | 신청 |
| 253 | 개회 | 회생 |
| 210 | 하단 | 파산 |
| 400 | 차전 | 전자독촉 |

---

## 에러 및 해결방법

### "사용에 불편을 드려서 죄송합니다"

**원인**: 잘못된 API 엔드포인트 사용

**해결**:
- 사건유형에 맞는 올바른 모듈 확인
- 예: 타채는 ssgo104가 아닌 ssgo10a 사용

### API 응답이 HTML인 경우

**원인**: 세션 만료 또는 인증 실패

**해결**:
- 새 세션으로 WMONID/JSESSIONID 재발급
- encCsNo 재획득

### encCsNo 재사용 실패

**원인**: 다른 세션에서 발급된 encCsNo 사용

**해결**:
- encCsNo는 발급받은 WMONID와 함께 사용
- DB에 WMONID도 함께 저장

---

## 새로운 사건유형 추가 방법

### 1. 브라우저에서 API 분석

```javascript
// 콘솔에서 실행
window._apiCalls = [];
var origFetch = window.fetch;
window.fetch = function(url, opts) {
  window._apiCalls.push({ url: String(url), body: opts && opts.body });
  return origFetch.apply(this, arguments);
};
```

### 2. 사건 검색 후 확인

```javascript
// 검색 후 실행
window._apiCalls.filter(c => c.url.indexOf('.on') !== -1)
  .map(c => ({ url: c.url }));
```

### 3. 코드 업데이트

1. `lib/scourt/api-client.ts`의 `getCaseCategory()` 함수에 사건유형 추가
2. `getGeneralApiEndpoints()`에 엔드포인트 추가
3. `getCaseProgress()`의 `progressEndpoints`에 추가
4. `lib/scourt/case-type-codes.ts`에 코드 매핑 추가

### 4. 이 문서 업데이트

---

## 관련 파일

| 파일 | 설명 |
|-----|------|
| `lib/scourt/api-client.ts` | API 클라이언트 (엔드포인트, 요청/응답 처리) |
| `lib/scourt/case-type-codes.ts` | 325개 사건유형 코드 매핑 |
| `lib/scourt/court-codes.ts` | 법원코드 매핑 |
| `lib/scourt/case-storage.ts` | encCsNo/WMONID 저장 관리 |

---

*최종 업데이트: 2026-01-07*
*테스트 확인: 민사, 가사, 형사, 신청, 집행, 전자독촉, 회생/파산, 항고/재항고(ssgo108), 행정신청(ssgo105), **보호(ssgo10i)**, **감치(ssgo106)***
