# SCOURT 통합 시스템

**Last Updated**: 2026-01-10

대법원 나의사건검색(SCOURT) 연동 시스템의 전체 아키텍처, 데이터 흐름, 필드 매핑을 설명합니다.

---

## 개요

### 시스템 구성

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCOURT 통합 시스템                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  사건 검색    │ -> │  사건 등록    │ -> │  사건 동기화  │              │
│  │ (캡챠 필요)   │    │ (encCsNo획득) │    │ (캡챠 없음)   │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│         │                   │                   │                       │
│         v                   v                   v                       │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    Supabase Database                            │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │    │
│  │  │ legal_cases    │  │ scourt_case_   │  │ court_hearings │    │    │
│  │  │ - enc_cs_no    │  │   snapshots    │  │ - 기일 정보    │    │    │
│  │  │ - scourt_wmonid│  │ - basic_info   │  │                │    │    │
│  │  │ - case_result  │  │ - hearings     │  │                │    │    │
│  │  │ - case_parties │  │ - progress     │  │                │    │    │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 주요 파일

| 파일 | 역할 |
|------|------|
| `lib/scourt/api-client.ts` | SCOURT REST API 클라이언트 |
| `lib/scourt/court-codes.ts` | 법원 코드 매핑 |
| `lib/scourt/case-type-codes.ts` | 사건유형 코드 매핑 |
| `lib/scourt/hearing-sync.ts` | 기일 → court_hearings 동기화 |
| `lib/scourt/party-labels.ts` | 당사자 라벨 정규화 |
| `app/api/admin/scourt/search/route.ts` | 사건 검색 API |
| `app/api/admin/scourt/sync/route.ts` | 사건 동기화 API |
| `app/api/admin/scourt/detail/route.ts` | 일반내용/진행내용 조회 API |

---

## API 엔드포인트

### 1. 사건 검색

```
POST /api/admin/scourt/search
```

**Request**:
```json
{
  "cortCd": "수원가정법원 평택지원",
  "csYr": "2024",
  "csDvsCd": "드단",
  "csSerial": "23848",
  "btprNm": "김"
}
```

**Response**:
```json
{
  "success": true,
  "encCsNo": "64자_암호화된_사건번호",
  "wmonId": "WMONID_값"
}
```

### 2. 사건 동기화

```
POST /api/admin/scourt/sync
```

**Request**:
```json
{
  "caseId": "uuid",
  "courtName": "수원가정법원 평택지원",
  "caseNumber": "2024드단23848",
  "partyName": "김"
}
```

**Response**:
```json
{
  "success": true,
  "saved": {
    "case_number": "2024드단23848",
    "basic_info": { ... },
    "hearings": [...],
    "progress": [...],
    "parties": [...],
    "representatives": [...]
  }
}
```

### 3. 저장된 사건 목록

```
GET /api/admin/scourt/saved-cases
```

### 4. 스냅샷 조회

```
GET /api/admin/scourt/snapshot?caseNumber=2024드단23848
```

---

## 데이터 흐름

### 1단계: 사건 검색 및 등록 (최초 1회)

```
사용자 요청
    ↓
캡챠 이미지 획득
    ↓
Vision API 또는 ML모델로 캡챠 해결
    ↓
csNoHistLst로 검색 (14자 포맷)
    ↓
64자 encCsNo 획득
    ↓
legal_cases에 enc_cs_no, scourt_wmonid 저장
```

### 2단계: 일반내용/진행내용 조회 및 동기화 (이후)

```
저장된 enc_cs_no + scourt_wmonid 사용
    ↓
캡챠 없이 일반내용/진행내용 API 호출
    ↓
응답 파싱:
  - dma_csBasCtt → basic_info
  - dlt_csSchdCtt → hearings
  - dlt_prcdRslt → progress
  - dlt_btprLst → parties
  - dlt_agntLst → representatives
    ↓
scourt_case_snapshots에 저장
    ↓
court_hearings에 기일 동기화
    ↓
legal_cases에 case_result 업데이트
```

---

## 필드 매핑

### 실제 API 응답 필드 (dma_csBasCtt)

> **참고**: 사건 유형에 따라 필드명이 다릅니다.

#### 공통 필드

| 실제 API 필드 | 정규화 필드 | 한글 라벨 | 예시 |
|--------------|-----------|----------|------|
| `userCsNo` | `csNo` | 사건번호 | 2024드단23848 |
| `csNm` | `csNm` | 사건명 | 이혼 등 |
| `cortNm` | `cortNm` | 법원 | 수원가정법원 평택지원 |
| `jdbnNm` | `jdgNm` | 재판부 | 가사1단독 |
| `jdbnTelno` | `jdgTelno` | 재판부전화번호 | 031-650-3126 |
| `csRcptYmd` | `rcptDt` | 접수일 | 20241021 |
| `csUltmtYmd` | `endDt` | 종국일 | 20251209 |
| `csUltmtDvsNm` | `endRslt` | 종국결과 | 원고일부승, 인용 |
| `csCfmtnYmd` | `cfrmDt` | 확정일 | 20251224 |
| `stmpAtchAmt` | `stmpAmnt` | 인지액 | 40000 (숫자) |
| `csMrgTypNm` | `mrgrDvs` | 병합구분 | 없음, 본소, 반소 |
| `csPrsrvYn` | `prsrvYn` | 보존여부 | Y/N |
| `prsvCtt` | `prsrvCtt` | 보존내용 | 기록보존됨 |

#### 사건유형별 당사자 필드

| 사건유형 | 원고/채권자 필드 | 피고/채무자 필드 |
|---------|----------------|----------------|
| **민사** (가소, 가단) | `rprsClmntNm` | `rprsAcsdNm` |
| **가사** (드단, 느단) | `rprsClmntNm` | `rprsAcsdNm` |
| **항소** (르, 나) | `rprsClmntNm` | `rprsAcsdNm` |
| **보전** (카기, 카합) | `rprsPtnrNm` | `rprsRqstrNm` |
| **집행** (카불) | `rprsPtnrNm` | `rprsRqstrNm` |

#### 사건유형별 소가/수리구분 필드

| 사건유형 | 원고소가 | 피고소가 | 청구금액 | 수리구분 |
|---------|---------|---------|---------|---------|
| **민사/가사/항소** | `clmntVsml` | `acsdVsml` | - | `csTkpDvsNm` 또는 `csTkpDvsCdNm` |
| **보전** | - | - | - | `csTkpDvsNm` |
| **집행** | - | - | `csClmAmt` | `csTkpDvsNm` |

### api-client.ts 정규화 매핑

api-client.ts에서 사건유형별 차이를 흡수하여 통일된 필드명으로 변환:

| 정규화 필드 | 실제 API 필드 (우선순위순) |
|-----------|-------------------------|
| `aplNm` | `rprsClmntNm` → `rprsPtnrNm` → `clmntNm` |
| `rspNm` | `rprsAcsdNm` → `rprsRqstrNm` → `acsdNm` |
| `endRslt` | `csUltmtDvsNm` → `csUltmtDtlCtt` → `endRsltNm` |
| `aplSovAmt` | `clmntVsml` → `clmntSovAmt` → `aplClmAmt` |
| `rspSovAmt` | `acsdVsml` → `acsdSovAmt` → `rspClmAmt` |
| `csClmAmt` | `csClmAmt` → `clmAmt` (집행 사건 청구금액) |
| `rcptDvsNm` | `csTkpDvsNm` → `csTkpDvsCdNm` → `csRcptDvsNm` |

### 종국결과 추출 로직

종국결과는 두 곳에서 가져올 수 있습니다:

1. **일반내용 탭** (기본): `dma_csBasCtt.csUltmtDvsNm`
2. **진행내용** (폴백): `dlt_prcdRslt`에서 `"종국 : "` 접두어가 있는 항목

```typescript
// sync/route.ts의 종국결과 추출 로직
let extractedEndRslt = generalData?.endRslt || null;
let extractedEndDt = generalData?.endDt || null;

// API 응답에 종국결과가 없으면 진행내용에서 "종국 : " 항목 찾기
if (!extractedEndRslt && progressData.length > 0) {
  const endProgressItem = progressData.find((item) =>
    item.prcdNm?.startsWith('종국 : ')
  );
  if (endProgressItem && endProgressItem.prcdNm) {
    extractedEndRslt = endProgressItem.prcdNm.replace('종국 : ', '').trim();
    extractedEndDt = extractedEndDt || endProgressItem.prcdDt || null;
  }
}
```

---

## 당사자 정보

### 데이터 구조

API 응답 (`dlt_btprLst`):
```json
[
  {
    "btprNm": "권OO",
    "btprDvsNm": "원고",
    "adjdocRchYmd": "20251209",
    "indvdCfmtnYmd": "20251224"
  },
  {
    "btprNm": "장OO",
    "btprDvsNm": "피고"
  }
]
```

### case_parties 테이블 매핑

| API 필드 | DB 컬럼 | 설명 |
|----------|---------|------|
| `btprNm` | `name` | 당사자명 |
| `btprDvsNm` | `party_type_label` | 원본 라벨 |
| (변환) | `party_type` | 정규화된 타입 (plaintiff/defendant) |

### 당사자 라벨 정규화

`lib/scourt/party-labels.ts`:

```typescript
export function normalizePartyType(label: string): PartyType {
  // 원고 계열
  if (['원고', '채권자', '신청인', '항소인', '상고인'].includes(label)) {
    return 'plaintiff';
  }
  // 피고 계열
  if (['피고', '채무자', '피신청인', '피항소인', '피상고인'].includes(label)) {
    return 'defendant';
  }
  // 기타
  return 'other';
}
```

### UI 표시 로직

`CaseDetail.tsx`에서 "사건본인" 계열은 사건개요에서 제외:

```typescript
// 사건본인으로 시작하는 라벨 필터링
const filteredParties = parties.filter(p => {
  const label = p.party_type_label || ''
  return !label.startsWith('사건본인')
});
```

---

## 기일 동기화

기일 정보는 SCOURT → `court_hearings` → Google Calendar로 흐릅니다.

자세한 내용: [HEARING-CALENDAR-SYNC.md](../HEARING-CALENDAR-SYNC.md)

### 기일 유형 매핑

| SCOURT 기일명 | HearingType |
|--------------|-------------|
| 변론, 변론기일 | HEARING_MAIN |
| 조정, 조정기일 | HEARING_MEDIATION |
| 조사, 조사기일 | HEARING_INVESTIGATION |
| 선고, 판결선고 | HEARING_JUDGMENT |

---

## 데이터베이스 스키마

### legal_cases (SCOURT 관련 컬럼)

```sql
ALTER TABLE legal_cases
ADD COLUMN enc_cs_no TEXT,              -- 64자 암호화된 사건번호
ADD COLUMN scourt_wmonid TEXT,          -- WMONID (encCsNo 바인딩)
ADD COLUMN case_result TEXT,            -- 종국결과 (원고일부승 등)
ADD COLUMN case_result_date DATE;       -- 종국일
```

### scourt_case_snapshots

```sql
CREATE TABLE scourt_case_snapshots (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES legal_cases(id),
  case_number TEXT NOT NULL,
  basic_info JSONB,                      -- 한글 라벨 기본정보
  hearings JSONB,                        -- 기일 목록
  progress JSONB,                        -- 진행내용
  parties JSONB,                         -- 당사자 정보
  representatives JSONB,                 -- 대리인 정보
  related_cases JSONB,                   -- 연관사건
  lower_court_cases JSONB,               -- 심급 정보
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
```

### case_parties

```sql
CREATE TABLE case_parties (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES legal_cases(id),
  name TEXT NOT NULL,
  party_type TEXT NOT NULL,              -- plaintiff, defendant, other
  party_type_label TEXT,                 -- 원본 라벨 (원고, 피고, 사건본인1 등)
  is_client BOOLEAN DEFAULT FALSE,       -- 의뢰인 여부
  source TEXT DEFAULT 'manual'           -- manual, scourt
);
```

---

## 사건유형별 지원 현황

> **용어 정리**
> - **검색**: 사건번호로 검색 (캡챠 필요) → `encCsNo` 획득
> - **일반내용**: 검색 성공 시 기본 탭 → `dma_csBasCtt`
> - **진행내용**: 별도 탭 클릭 → `dlt_prcdRslt`

| 사건 유형 | 코드 예시 | 검색 | 일반내용 | 진행내용 | 비고 |
|----------|----------|------|----------|----------|------|
| 민사 | 가단, 가소, 가합 | ✅ | ✅ | ✅ | |
| 가사 | 드단, 느단, 드합 | ✅ | ✅ | ✅ | |
| 항소 | 나, 너, 르 | ✅ | ✅ | ✅ | |
| 보전 | 카기, 카합 | ✅ | ✅ | ✅ | |
| 집행 | 타채, 카불 | ✅ | ✅ | ✅ | |
| 전자독촉 | 차전 | ✅ | ✅ | ✅ | |
| 회생/파산 | 개회, 하단, 하면 | ✅ | ✅ | ✅ | |
| 형사 | 고단, 고합 | ✅ | ✅ | ✅ | |
| 보호 | 동버, 푸 | ✅ | ✅ | ✅ | ssgo10i (2026.01.07 추가) |
| 감치 | 정명 | ✅ | ✅ | ✅ | ssgo106 (2026.01.07 추가) |

### API 엔드포인트 분기

```typescript
// api-client.ts - 주요 카테고리별 엔드포인트
switch (caseCategory) {
  case 'family':
    endpoint = 'selectHmpgFmlyCsGnrlCtt.on';       // 가사 (ssgo102)
    break;
  case 'criminal':
    endpoint = 'selectHmpgCrmcsPbtrlCsGnrlCtt.on'; // 형사 (ssgo10g)
    break;
  case 'protection':
    endpoint = 'selectHmpgFamlyPrtctCsGnrlCtt.on'; // 보호 (ssgo10i)
    break;
  case 'contempt':
    endpoint = 'selectHmpgEtcCsGnrlCtt.on';       // 감치 (ssgo106)
    break;
  case 'civil':
  default:
    endpoint = 'selectHmpgCvlcsCsGnrlCtt.on';     // 민사 (ssgo101)
}
```

---

## 법원코드 매핑

### 기본 개념

SCOURT API는 법원코드(6자리 숫자)를 사용합니다. 같은 "지원"이라도 사건유형에 따라 다른 코드를 사용합니다:

| 사건유형 | 법원명 | 코드 | API 엔드포인트 |
|----------|--------|------|----------------|
| 민사/형사 | 수원지방법원 평택지원 | 000253 | ssgo101/ssgo10g |
| 가사 | 수원가정법원 평택지원 | 000305 | ssgo102 |

### 축약형 법원명

시스템에서는 축약형 법원명을 사용합니다:

| 축약형 | 지방법원 (민사) | 가정법원 (가사) |
|--------|-----------------|-----------------|
| 평택지원 | 수원지방법원 평택지원 (000253) | - |
| 평택가정 | - | 수원가정법원 평택지원 (000305) |
| 천안지원 | 대전지방법원 천안지원 (000283) | - |
| 천안가정 | - | 대전가정법원 천안지원 (000294) |

### 사건유형별 자동 변환

`getCourtCodeByNameAndCategory` 함수가 사건유형에 따라 자동 변환합니다:

```typescript
// lib/scourt/court-codes.ts
getCourtCodeByNameAndCategory('평택지원', 'family')
// → "평택가정" → 000305 (가정법원)

getCourtCodeByNameAndCategory('평택지원', 'civil')
// → "평택지원" → 000253 (지방법원)

getCourtCodeByNameAndCategory('수원지방법원 평택지원', 'family')
// → "수원가정법원 평택지원" → 000305 (가정법원)
```

### 변환 규칙

| 입력 패턴 | 사건유형 | 변환 결과 |
|-----------|----------|-----------|
| `XX지원` | family | `XX가정` |
| `XX가정` | civil/criminal | `XX지원` |
| `OO지방법원 XX지원` | family | `OO가정법원 XX지원` |
| `OO가정법원 XX지원` | civil/criminal | `OO지방법원 XX지원` |

### 코드 매핑 파일

- `lib/scourt/court-codes.ts`: COURT_CODES (207개 법원), COURT_ABBREV_MAP (축약명 매핑)
- `lib/scourt/case-type-codes.ts`: 325개 사건유형 코드

---

## 트러블슈팅

### "허용되지 않은 접근방식입니다" 에러

**원인**: WMONID와 encCsNo 불일치, 또는 세션 만료

**해결**:
1. 세션 재생성 (동일 WMONID 사용)
2. encCsNo 재발급 필요 시 캡챠 재시도

### 종국결과가 표시되지 않음

**확인 사항**:
1. `scourt_case_snapshots.basic_info`에 "종국결과" 키 존재 여부
2. 진행내용(`progress`)에 "종국 : " 항목 존재 여부
3. `legal_cases.case_result` 값 확인

**수동 수정**:
```sql
UPDATE legal_cases
SET case_result = '원고일부승',
    case_result_date = '2025-12-09'
WHERE id = 'case-uuid';
```

### 당사자 정보가 누락됨

**원인**: SCOURT API가 특정 당사자를 반환하지 않음

**해결**: 수동으로 `case_parties`에 추가

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2025-12-29 | SCOURT API 분석 시작 |
| 2025-12-31 | WMONID 바인딩 발견, 캡챠 없는 조회 구현 |
| 2026-01-02 | 기일 동기화 시스템 완성 |
| 2026-01-03 | 당사자/대리인 정보 수집 |
| 2026-01-06 | 종국결과 추출 로직 개선, 문서화 |
| 2026-01-07 | 보호(ssgo10i), 감치(ssgo106) 카테고리 추가 |
| 2026-01-10 | 법원코드 사건유형별 자동 변환 기능 추가 (getCourtCodeByNameAndCategory) |
