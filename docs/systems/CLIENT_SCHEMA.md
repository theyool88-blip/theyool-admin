# 의뢰인(Client) 스키마 시스템

## 개요

의뢰인 정보는 법무법인 더윤 시스템의 핵심 데이터입니다. 이 문서는 의뢰인 스키마와 관련된 모든 컴포넌트, API, 데이터 흐름을 정리합니다.

## 데이터베이스 스키마

### clients 테이블

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- 기본 정보
  name VARCHAR(100) NOT NULL,           -- 의뢰인명
  phone VARCHAR(20),                     -- 연락처
  email VARCHAR(100),                    -- 이메일
  address TEXT,                          -- 주소
  birth_date DATE,                       -- 생년월일
  resident_number VARCHAR(20),           -- 주민등록번호
  bank_account TEXT,                     -- 계좌번호

  -- 의뢰인 유형
  client_type VARCHAR(20) DEFAULT 'individual',  -- 'individual' | 'corporation'
  company_name VARCHAR(200),             -- 회사명 (법인인 경우)
  registration_number VARCHAR(20),       -- 사업자등록번호 (법인인 경우)

  -- 포털 관련
  portal_enabled BOOLEAN DEFAULT false,
  portal_user_id UUID,

  -- 메타데이터
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 의뢰인 유형

| 값 | 설명 | 한글 표시 |
|---|---|---|
| `individual` | 개인 의뢰인 | 개인 |
| `corporation` | 법인 의뢰인 | 법인 |

## 데이터 흐름

### 1. 신규 의뢰인 등록

```
사용자 입력 → NewClientForm → POST /api/admin/clients → clients 테이블
```

**관련 파일:**
- `components/NewClientForm.tsx` - 신규 의뢰인 등록 폼
- `app/api/admin/clients/route.ts` - POST API

### 2. 의뢰인 수정

```
사용자 입력 → ClientEditForm → PATCH /api/admin/clients/[id] → clients 테이블
```

**관련 파일:**
- `components/ClientEditForm.tsx` - 의뢰인 수정 폼
- `app/api/admin/clients/[id]/route.ts` - PATCH API

### 3. 사건 등록 시 신규 의뢰인 생성

```
NewCaseForm (신규 의뢰인 선택) → POST /api/admin/cases → clients 테이블 + legal_cases 테이블
```

**관련 파일:**
- `components/NewCaseForm.tsx` - 사건 등록 폼 (신규 의뢰인 섹션)
- `app/api/admin/cases/route.ts` - POST API (new_client 처리)

### 4. 대량 등록 (CSV Import)

```
CSV 업로드 → parse API → 컬럼 매핑 UI → batch-create-stream API → clients 테이블
```

**관련 파일:**
- `app/admin/onboarding/import/page.tsx` - 대량 등록 UI
- `lib/onboarding/csv-schema.ts` - CSV 스키마 정의
- `types/onboarding.ts` - StandardCaseRow 타입, 한글 별칭
- `app/api/admin/onboarding/batch-create-stream/route.ts` - 대량 등록 API

**CSV 컬럼 매핑:**

| 한글 컬럼명 | 영문 필드명 |
|---|---|
| 의뢰인명 | `client_name` |
| 의뢰인연락처 | `client_phone` |
| 의뢰인이메일 | `client_email` |
| 생년월일 | `client_birth_date` |
| 주소 | `client_address` |
| 계좌번호 | `client_bank_account` |
| 의뢰인유형 | `client_type` |
| 주민등록번호 | `client_resident_number` |
| 회사명 | `client_company_name` |
| 사업자등록번호 | `client_registration_number` |

**의뢰인 유형 자동 변환:**

```typescript
// batch-create-stream/route.ts
function normalizeClientType(value: string | undefined): 'individual' | 'corporation' {
  if (!value) return 'individual'
  const trimmed = value.trim().toLowerCase()

  // 이미 영문인 경우
  if (trimmed === 'individual' || trimmed === 'corporation') {
    return trimmed as 'individual' | 'corporation'
  }

  // 한글 매핑
  const corporationKeywords = ['법인', '회사', '기업', 'corporation', 'company', 'corp']
  if (corporationKeywords.some(kw => trimmed.includes(kw))) {
    return 'corporation'
  }

  return 'individual'
}
```

## UI 컴포넌트

### 의뢰인 목록 (ClientsList)

- **파일:** `components/ClientsList.tsx`
- **표시 정보:** 이름, 연락처, 이메일, 최근 사건, 미수금
- **법인 표시:** 이름 옆에 `(회사명)` 형태로 표시

### 의뢰인 상세 (ClientDetail)

- **파일:** `components/ClientDetail.tsx`
- **표시 정보:**
  - 기본: 이름, 연락처, 이메일, 주소, 생년월일, 계좌번호
  - 법인: 회사명, 사업자등록번호 (법인인 경우에만)

### 의뢰인 미리보기 모달 (ClientPreviewModal)

- **파일:** `components/ClientPreviewModal.tsx`
- **용도:** 관리자가 의뢰인 포털 화면 미리보기
- **표시 정보:**
  - 의뢰인 유형 배지 (개인/법인)
  - 기본 정보: 이름, 연락처, 이메일, 생년월일, 주소, 계좌번호
  - 법인 정보: 회사명, 사업자등록번호

## API 엔드포인트

### POST /api/admin/clients

신규 의뢰인 생성

**Request Body:**
```typescript
{
  name: string           // 필수
  phone?: string
  email?: string
  address?: string
  birth_date?: string    // YYYY-MM-DD
  resident_number?: string
  bank_account?: string
  client_type?: 'individual' | 'corporation'
  company_name?: string
  registration_number?: string
  notes?: string
}
```

### PATCH /api/admin/clients/[id]

의뢰인 정보 수정

**Request Body:** (POST와 동일, 모든 필드 선택적)

### GET /api/admin/client-preview/[clientId]

의뢰인 포털 미리보기 데이터 조회

**Response:**
```typescript
{
  success: true,
  client: {
    id: string
    name: string
    phone: string
    email?: string
    address?: string
    birth_date?: string
    resident_number?: string
    bank_account?: string
    client_type?: 'individual' | 'corporation'
    company_name?: string
    registration_number?: string
  },
  cases: CaseInfo[],
  upcomingHearings: UpcomingHearing[],
  upcomingDeadlines: UpcomingDeadline[]
}
```

## 사건과의 연결

의뢰인은 두 가지 방식으로 사건과 연결됩니다:

### 1. primary_client_id (레거시)

`legal_cases.primary_client_id` - 사건의 주 의뢰인

### 2. case_clients 테이블 (권장)

```sql
CREATE TABLE case_clients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  case_id UUID NOT NULL REFERENCES legal_cases(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  linked_party_id UUID REFERENCES case_parties(id),
  is_primary_client BOOLEAN DEFAULT false,
  retainer_fee NUMERIC(15,2),
  ...
);
```

**조회 시:**
```typescript
// 의뢰인의 사건 목록 조회
const { data: clientCases } = await supabase
  .from('case_clients')
  .select('case_id')
  .eq('client_id', clientId);

const { data: cases } = await supabase
  .from('legal_cases')
  .select('*')
  .or(`primary_client_id.eq.${clientId},id.in.(${caseIds.join(',')})`)
```

## 관련 문서

- [대량 등록 시스템](./BATCH_IMPORT_SYSTEM.md)
- [의뢰인 포털](./CLIENT_PORTAL.md)
- [사건 관리](./CASE_MANAGEMENT.md)

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-01-23 | 의뢰인 확장 필드 추가 (client_type, company_name, registration_number, resident_number) |
| 2026-01-23 | 대량 등록 시스템 의뢰인 필드 지원 |
| 2026-01-23 | ClientPreviewModal 확장 정보 표시 |
