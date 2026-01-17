# Case Clients 스키마 마이그레이션 가이드

## 개요

사건-의뢰인 관계를 M:N으로 확장하고, 당사자 정보 관리를 개선하기 위한 스키마 변경입니다.

**마이그레이션 파일**: `supabase/migrations/20260220_unify_parties_and_case_clients.sql`

## 주요 변경사항

### 1. 신규 테이블: `case_clients`

사건과 의뢰인의 M:N 관계를 관리합니다.

```sql
CREATE TABLE case_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  case_id UUID NOT NULL REFERENCES legal_cases(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  linked_party_id UUID REFERENCES case_parties(id),  -- 당사자 연결
  is_primary_client BOOLEAN DEFAULT FALSE,           -- 주 의뢰인 여부
  retainer_fee BIGINT,                               -- 착수금
  success_fee_terms TEXT,                            -- 성공보수 조건

  UNIQUE(case_id, client_id)
);
```

### 2. `case_parties` 변경

| 변경 유형 | 컬럼 | 설명 |
|-----------|------|------|
| **추가** | `representatives` | JSONB - 대리인 정보 배열 |
| **이름변경** | `is_our_client` → `is_primary` | 의뢰인 당사자 여부 |
| **삭제** | `client_id` | `case_clients.linked_party_id`로 대체 |
| **삭제** | `is_our_client` | `is_primary`로 대체 |
| **삭제** | `fee_allocation_amount` | 더 이상 사용하지 않음 |

### 3. `legal_cases` 캐시 필드

조회 성능을 위한 캐시 필드가 추가되었습니다. 트리거가 자동 동기화합니다.

| 컬럼 | 설명 |
|------|------|
| `primary_client_id` | 주 의뢰인 ID (FK → clients) |
| `primary_client_name` | 주 의뢰인 이름 |

### 4. 삭제된 테이블

- `case_representatives` - `case_parties.representatives` JSONB로 통합

## 데이터 흐름

```
legal_cases
  │
  ├── primary_client_id ─────────────────────────────┐
  ├── primary_client_name (캐시, 트리거 동기화)       │
  │                                                   │
  ├── case_clients ←──────────────────────────────────┘
  │     ├── client_id → clients
  │     ├── linked_party_id → case_parties
  │     └── is_primary_client
  │
  └── case_parties
        ├── is_primary (의뢰인 당사자 여부)
        ├── party_type (plaintiff/defendant)
        └── representatives JSONB
              └── [{ name, type_label, law_firm, is_our_firm }]
```

## API 변경사항

### 사건 생성 (`POST /api/admin/cases`)

```typescript
// 요청 body는 기존과 동일
{
  client_id: string,
  client_role: 'plaintiff' | 'defendant',
  ...
}

// 내부 처리:
// 1. legal_cases 생성
// 2. case_parties 생성 (is_primary 설정)
// 3. case_clients 생성 (linked_party_id 연결)
```

### 사건 목록 조회 (`GET /api/admin/cases`)

```typescript
// 응답 - 캐시 필드 사용
{
  cases: [{
    id: string,
    primary_client_id: string,
    primary_client_name: string,  // JOIN 없이 바로 사용
    ...
  }]
}
```

### 의뢰인 역할 조회 (`GET /api/admin/cases/[id]/client-role`)

```typescript
// client_role은 case_clients + case_parties에서 추론
// 1. case_clients.linked_party_id로 당사자 찾기
// 2. 해당 당사자의 party_type 반환
```

### 의뢰인 연결 관리 (`/api/admin/cases/[id]/clients`)

신규 API입니다.

```typescript
// GET - 연결된 의뢰인 목록
// POST - 의뢰인 추가
// DELETE - 의뢰인 연결 해제
```

### Client Portal API

```typescript
// 기존: legal_cases.client_id로 직접 조회
// 변경: case_clients 테이블에서 연결된 사건 조회

// GET /api/client/dashboard
const { data: links } = await supabase
  .from('case_clients')
  .select('case_id')
  .eq('client_id', clientId);

const caseIds = links.map(l => l.case_id);
const { data: cases } = await supabase
  .from('legal_cases')
  .select('*')
  .in('id', caseIds);
```

## 코드 마이그레이션 가이드

### 1. `is_our_client` → `is_primary`

```typescript
// Before
.eq('is_our_client', true)

// After
.eq('is_primary', true)
```

### 2. `case_parties.client_id` 제거

```typescript
// Before
const { data } = await supabase
  .from('case_parties')
  .select('client_id, is_our_client')

// After
const { data } = await supabase
  .from('case_parties')
  .select('is_primary')

// 의뢰인 정보는 case_clients에서 조회
const { data: clients } = await supabase
  .from('case_clients')
  .select('client_id, linked_party_id')
  .eq('case_id', caseId)
```

### 3. `legal_cases.client_id` 제거

```typescript
// Before
const { data } = await supabase
  .from('legal_cases')
  .select('*, client:clients(*)')
  .eq('client_id', clientId)

// After - 캐시 필드 사용
const { data } = await supabase
  .from('legal_cases')
  .select('*, client:clients!primary_client_id(*)')

// 또는 case_clients 통해 조회
const { data: links } = await supabase
  .from('case_clients')
  .select('case_id')
  .eq('client_id', clientId)
```

### 4. 당사자 생성 시 `is_primary` 사용

```typescript
// Before
const payload = {
  is_our_client: seed.is_our_client,
  client_id: clientId,
}

// After
const payload = {
  is_primary: seed.is_our_client,
  representatives: [],  // JSONB
}

// 별도로 case_clients 생성
await supabase.from('case_clients').insert({
  tenant_id,
  case_id,
  client_id,
  linked_party_id: partyId,
  is_primary_client: true,
})
```

## 수정된 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `app/api/admin/cases/route.ts` | case_clients 생성, is_primary 매핑 |
| `app/api/admin/cases/[id]/route.ts` | primary_client_id FK 조인 |
| `app/api/admin/cases/[id]/client-role/route.ts` | case_clients 기반 로직 |
| `app/api/admin/cases/[id]/clients/route.ts` | **신규** - 의뢰인 연결 API |
| `app/api/admin/cases/[id]/parties/route.ts` | is_primary, representatives |
| `app/api/admin/clients/search/route.ts` | is_primary 사용 |
| `app/api/admin/onboarding/batch-create/route.ts` | is_primary, case_clients |
| `app/api/admin/onboarding/batch-create-stream/route.ts` | is_primary, case_clients |
| `app/api/admin/scourt/sync/route.ts` | primary_client_* 캐시 필드 |
| `app/api/admin/scourt/link-related/route.ts` | case_clients 연동 |
| `app/api/client/dashboard/route.ts` | case_clients 통해 사건 조회 |
| `app/api/client/cases/[id]/route.ts` | case_clients로 권한 확인 |
| `app/cases/new/page.tsx` | client_role 추론 로직 |
| `lib/scourt/party-sync.ts` | representatives JSONB 동기화 |
| `types/case-party.ts` | 타입 정의 업데이트 |

## 주의사항

1. **tenant_id 필수**: `case_clients` 생성 시 반드시 `tenant_id` 포함
2. **FK 명시**: `legal_cases` 조인 시 `clients!primary_client_id` 명시 필요
3. **캐시 동기화**: `case_clients` 변경 시 트리거가 `legal_cases.primary_client_*` 자동 업데이트
4. **RLS 정책**: `case_clients`에 tenant_isolation 정책 적용됨

## 롤백 방법

마이그레이션 롤백이 필요한 경우:

```sql
-- 1. case_clients 삭제
DROP TABLE IF EXISTS case_clients;

-- 2. case_parties 컬럼 복원
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS is_our_client BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fee_allocation_amount BIGINT;

-- 3. legal_cases 캐시 필드 삭제
ALTER TABLE legal_cases
  DROP COLUMN IF EXISTS primary_client_id,
  DROP COLUMN IF EXISTS primary_client_name;

-- 4. case_representatives 복원 (필요시)
-- 별도 백업에서 복원
```
