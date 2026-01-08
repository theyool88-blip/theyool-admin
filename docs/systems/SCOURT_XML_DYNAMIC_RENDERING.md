# SCOURT XML 동적 렌더링 시스템

## 개요

SCOURT(대법원 나의사건검색) 데이터를 XML 정의 기반으로 동적 렌더링하는 시스템입니다.
**하드코딩 없이** XML이 정의하는 대로 UI를 자동 생성합니다.

## 핵심 원칙

```
❌ 하드코딩: "당사자" 컬럼은 btprtNm, btprtDvsNm 이렇게...
✅ 동적:    XML이 정의하면 그대로 따름
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  SCOURT XML                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ 기본정보 XML  │───▶│ 당사자 XML   │───▶│ 대리인 XML   │   │
│  │ (경로 정의)   │    │ (컬럼 정의)  │    │ (컬럼 정의)  │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  동적 렌더링 파이프라인                                       │
│                                                              │
│  1. extractSubXmlPaths() - 경로 동적 추출                    │
│  2. parseGridXml() - 컬럼 정의 파싱                          │
│  3. GridTable - XML 정의대로 렌더링                          │
└─────────────────────────────────────────────────────────────┘
```

## 처리 흐름

### 1단계: 기본정보 XML에서 하위 XML 경로 추출

**SCOURT 기본정보 XML (예: SSGO105F01.xml):**
```javascript
// 기본정보 XML 내부에 하위 XML 경로가 정의되어 있음
wfBtprtCttLst.setSrc("/ui/ssgo003/SSGO003F62.xml")  // 당사자
wfAgntCttLst.setSrc("/ui/ssgo003/SSGO003F70.xml")   // 대리인
wfRcntDxdyLst.setSrc("/ui/ssgo003/SSGO003F32.xml")  // 최근기일
```

**`extractSubXmlPaths()` 함수:**
```typescript
function extractSubXmlPaths(basicInfoXml: string): Record<string, string> {
  // 패턴 1: JavaScript .setSrc() 호출
  const jsSrcRegex = /wf(\w+)\.setSrc\([^"']*["']\/ui\/([^"']+)["']/g;

  // 패턴 2: XML wframe src 속성
  const wframeRegex = /<w2:wframe\s+([^>]+)>/g;

  // 결과: { dlt_btprtCttLst: "ssgo003/SSGO003F62.xml", ... }
}
```

### 2단계: 각 XML에서 컬럼 정의 파싱

**당사자 XML (SSGO003F62.xml):**
```xml
<w2:columnInfo>
  <w2:column id="btprtDvsNm" name="당사자구분코드명"/>
  <w2:column id="btprtNm" name="당사자명"/>
  <w2:column id="dcsnstDlvrYmd" name="결정문송달일자"/>
</w2:columnInfo>

<w2:header>
  <w2:column value="구분"/>      <!-- btprtDvsNm -->
  <w2:column value="이름"/>      <!-- btprtNm -->
  <w2:column value="결정문송달일"/> <!-- dcsnstDlvrYmd -->
</w2:header>
```

**`parseGridXml()` 결과:**
```typescript
{
  title: "당사자내용",
  columns: [
    { id: "btprtDvsNm", label: "구분" },
    { id: "btprtNm", label: "이름" },
    { id: "dcsnstDlvrYmd", label: "결정문송달일", format: "####.##.##" }
  ]
}
```

### 3단계: API 데이터 + XML 정의 → 렌더링

**API 응답 (`dlt_btprtCttLst`):**
```json
[
  { "btprtDvsNm": "신청인", "btprtNm": "이OO", "dcsnstDlvrYmd": "20240321" },
  { "btprtDvsNm": "채권자", "btprtNm": "㈜OOO", "dcsnstDlvrYmd": "" }
]
```

**렌더링 결과:**

| 구분 | 이름 | 결정문송달일 |
|------|------|-------------|
| 신청인 | 이OO | 2024.03.21 |
| 채권자 | ㈜OOO | - |

## 파일 구조

```
lib/scourt/
├── xml-fetcher.ts      # XML 다운로드 및 DB 캐싱
├── xml-parser.ts       # WebSquare5 XML 파싱
├── xml-renderer.tsx    # XML 기반 테이블 렌더링
├── xml-mapping.ts      # 사건유형별 XML 매핑 (fallback)
└── case-number-utils.ts # 사건번호 정규화

components/scourt/
├── ScourtGeneralInfoXml.tsx  # 동적 렌더링 메인 컴포넌트
└── ScourtGeneralInfo.tsx     # 레거시 (정적 렌더링)

supabase/migrations/
└── 20260110_scourt_xml_cache.sql  # XML 캐시 테이블

public/scourt-xml/           # 정적 fallback XML
├── ssgo101/                 # 민사
├── ssgo102/                 # 가사
├── ssgo105/                 # 신청/행정
├── ssgo106/                 # 기타
├── ssgo10g/                 # 형사
└── ssgo003/                 # 공통 (당사자, 대리인 등)
```

## XML 캐싱 전략

### 캐시 우선순위

1. **DB 캐시** (`scourt_xml_cache` 테이블) - 최우선
2. **정적 파일** (`public/scourt-xml/`) - fallback

### 캐싱 시점

| 시점 | 동작 |
|------|------|
| 첫 연동 | 기본정보 XML에서 추출한 **모든** 하위 XML 캐시 |
| 갱신 | 데이터가 있는 dlt_* 항목 중 미캐시된 것만 다운로드 |

```typescript
// lib/scourt/xml-fetcher.ts
export async function ensureXmlCacheForCase(
  caseType: ScourtCaseType,
  apiResponse: Record<string, unknown>,
  cacheAllOnFirstLink: boolean = true  // 첫 연동 시 모든 XML 캐시
): Promise<void>
```

## 사건유형 감지

**`detectCaseTypeFromCaseNumber()` 함수:**

| 사건번호 패턴 | 사건유형 | XML 경로 |
|--------------|---------|----------|
| 가단, 가합, 나, 다 | ssgo101 (민사) | ssgo101/SSGO101F01.xml |
| 드단, 드합, 느, 브 | ssgo102 (가사) | ssgo102/SSGO102F01.xml |
| 하단, 하면, 개회 | ssgo105 (도산) | ssgo105/SSGO105F01.xml |
| 카, 타, 아 | ssgo105 (신청) | ssgo105/SSGO105F01.xml |
| 고단, 고합, 노, 도 | ssgo10g (형사) | ssgo10g/SSGO10GF01.xml |

## 데이터 리스트 ID

| ID | 내용 | XML 예시 |
|----|------|----------|
| dlt_btprtCttLst | 당사자 | SSGO003F60~F63.xml |
| dlt_agntCttLst | 대리인 | SSGO003F70.xml |
| dlt_atrnyCttLst | 변호인 (형사) | SSGO003F71.xml |
| dlt_rcntDxdyLst | 최근기일 | SSGO003F32.xml |
| dlt_rcntSbmsnDocmtLst | 제출서류 | SSGO003F40.xml |
| dlt_reltCsLst | 관련사건 | SSGO003F50.xml |
| dlt_inscrtDtsLst | 심급내용 | SSGO003F10.xml |
| dlt_hrngProgCurst | 심리진행 | SSGO003F20.xml |
| dlt_acsCttLst | 피고인/죄명 | SSGO003F6B.xml |
| dlt_gurdnCttLst | 후견인 | SSGO003F90.xml |

## 확장성

### 새 사건 유형 추가 시

1. 기본정보 XML에 하위 XML 경로가 정의되어 있으면 **코드 수정 불필요**
2. `extractSubXmlPaths()`가 자동으로 경로 추출
3. 각 XML의 컬럼 정의대로 자동 렌더링

### 새 필드 추가 시

1. SCOURT XML에 새 컬럼이 정의되면 **코드 수정 불필요**
2. `parseGridXml()`이 새 컬럼 자동 파싱
3. `GridTable`이 새 컬럼 자동 렌더링

## 관련 문서

- [SCOURT 통합 시스템](./SCOURT_INTEGRATION.md)
- [SCOURT API 분석](./SCOURT_API_ANALYSIS.md)
