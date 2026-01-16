# 미수금 관리 시스템

**Last Updated**: 2026-01-16

법무법인 더율의 미수금(수임료 잔액) 현황을 관리하는 시스템입니다.

---

## 개요

### 주요 기능

| 기능 | 설명 |
|------|------|
| **미수금 현황 조회** | 의뢰인별/사건별 미수금 현황 |
| **등급 관리** | 정상/관리/추심 3단계 등급 |
| **메모 기능** | 의뢰인별 수금 관련 메모 |
| **미수금 포기** | 회수 불가 미수금 처리 |
| **사무소별 통계** | 지점별 미수금 현황 |

### 접근 권한

회계 모듈 접근 권한이 있는 사용자만 사용 가능합니다.

```typescript
// lib/auth/permissions.ts
canAccessAccountingWithContext(tenant)
```

---

## 등급 시스템

### 등급 정의

| 등급 | 코드 | 설명 | 색상 |
|------|------|------|------|
| 정상 | `normal` | 정상 수금 진행 중 | 회색 |
| 관리 | `watch` | 연체 주의 대상 | 노란색 |
| 추심 | `collection` | 강력 추심 대상 | 빨간색 |

### 등급 우선순위

```typescript
// 등급 우선순위 (정렬용)
const gradeOrder = {
  collection: 0,  // 가장 높음 (먼저 표시)
  watch: 1,
  normal: 2,
}
```

---

## 데이터 모델

### 관련 테이블

| 테이블 | 설명 |
|--------|------|
| `legal_cases` | 사건 (미수금 정보 포함) |
| `clients` | 의뢰인 |
| `receivable_memos` | 수금 관련 메모 |
| `receivable_writeoffs` | 미수금 포기 이력 |

### legal_cases 관련 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `retainer_fee` | numeric | 착수금 |
| `calculated_success_fee` | numeric | 성공보수 |
| `total_received` | numeric | 총 입금액 |
| `outstanding_balance` | numeric | 미수금 잔액 |
| `receivable_grade` | varchar | 미수금 등급 |

### receivable_memos 테이블

```sql
CREATE TABLE receivable_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  tenant_id UUID REFERENCES tenants(id),
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### receivable_writeoffs 테이블

```sql
CREATE TABLE receivable_writeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES legal_cases(id),
  client_id UUID,
  case_name TEXT,
  client_name TEXT,
  original_amount NUMERIC,
  reason TEXT,
  written_off_at TIMESTAMP,
  tenant_id UUID REFERENCES tenants(id)
);
```

---

## API 엔드포인트

### GET /api/admin/receivables

미수금 현황 조회

**Query Parameters:**

| 파라미터 | 설명 | 기본값 |
|---------|------|-------|
| `office` | 사무소 필터 | (전체) |
| `sort_by` | 정렬 기준 (outstanding, name, case_count, grade) | outstanding |
| `sort_order` | 정렬 방향 (asc, desc) | desc |
| `min_amount` | 최소 금액 필터 | - |
| `grade` | 등급 필터 (normal, watch, collection) | - |
| `include_writeoffs` | 포기 이력 포함 여부 | false |

**Response:**

```typescript
interface ReceivablesSummary {
  total_outstanding: number
  by_office: Record<string, number>  // 사무소별 미수금
  client_count: number
  case_count: number
  watch_count: number
  collection_count: number
  clients: ClientReceivable[]
  writeoffs?: WriteOff[]
}

interface ClientReceivable {
  client_id: string
  client_name: string
  case_count: number
  total_retainer: number
  total_success_fee: number
  total_received: number
  outstanding: number
  highest_grade: ReceivableGrade
  cases: CaseReceivable[]
  memos?: Memo[]
}
```

### PATCH /api/admin/receivables

미수금 등급 변경 또는 포기 처리

**등급 변경:**

```json
{
  "case_id": "uuid",
  "grade": "watch"
}
```

**미수금 포기:**

```json
{
  "case_id": "uuid",
  "reason": "연락 두절로 인한 회수 불가"
}
```

### POST /api/admin/receivables/memos

의뢰인별 메모 추가

```json
{
  "client_id": "uuid",
  "content": "1/20 전화 - 다음 달 입금 약속"
}
```

### PATCH /api/admin/receivables/memos/[id]

메모 완료 처리

```json
{
  "is_completed": true
}
```

---

## UI 구성

### 경로

`/admin/receivables`

### 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│  미수금 현황                                                 │
├─────────────────────────────────────────────────────────────┤
│  [요약 카드]                                                 │
│  총 미수금: ₩123,456,000                                    │
│  평택: ₩80,000,000 | 천안: ₩43,456,000                      │
│  의뢰인 25명 | 사건 42건 | 관리 5 | 추심 2                   │
├─────────────────────────────────────────────────────────────┤
│  [필터]  사무소 ▼  정렬 ▼  등급 ▼                           │
├─────────────────────────────────────────────────────────────┤
│  [탭] 현황 | 포기 이력                                       │
├─────────────────────────────────────────────────────────────┤
│  의뢰인 목록 (접기/펼치기)                                   │
│  ├─ 김OO (3건) ₩15,000,000 [추심]                           │
│  │   ├─ 이혼소송 ₩10,000,000 [추심]                         │
│  │   ├─ 재산분할 ₩3,000,000 [관리]                          │
│  │   └─ 양육권 ₩2,000,000 [정상]                            │
│  │   [메모 섹션]                                             │
│  ├─ 박OO (2건) ₩8,000,000 [관리]                            │
│  └─ ...                                                      │
└─────────────────────────────────────────────────────────────┘
```

### 기능

1. **의뢰인 펼치기/접기**: 클릭하면 해당 의뢰인의 사건 목록 표시
2. **등급 변경**: 사건별 등급 드롭다운으로 변경
3. **메모 추가/완료**: 의뢰인별 메모 관리
4. **미수금 포기**: 회수 불가 시 포기 처리 (이유 입력)
5. **필터/정렬**: 사무소, 등급, 금액 등으로 필터링

---

## 미수금 계산

### 계산 공식

```
미수금 = (착수금 + 성공보수) - 총 입금액
```

### 자동 업데이트

`payments` 테이블에 입금이 등록되면 `legal_cases.total_received`와 `outstanding_balance`가 자동으로 업데이트됩니다.

```sql
-- 트리거 또는 API에서 처리
UPDATE legal_cases
SET total_received = (SELECT SUM(amount) FROM payments WHERE case_id = $1),
    outstanding_balance = retainer_fee + calculated_success_fee - total_received
WHERE id = $1;
```

---

## 메모 기능

### 용도

- 수금 시도 기록
- 약속 내용 기록
- 연락 이력 관리

### 메모 상태

| 상태 | 설명 |
|------|------|
| 미완료 | 후속 조치 필요 |
| 완료 | 처리 완료 |

---

## 미수금 포기

### 포기 처리 흐름

```
1. 포기 버튼 클릭
2. 사유 입력 (필수 아님)
3. 확인
4. receivable_writeoffs에 이력 저장
5. legal_cases.outstanding_balance = 0
```

### 포기 이력 조회

"포기 이력" 탭에서 포기 처리된 미수금 목록을 확인할 수 있습니다.

| 필드 | 설명 |
|------|------|
| 사건명 | case_name |
| 의뢰인 | client_name |
| 원래 금액 | original_amount |
| 사유 | reason |
| 포기일 | written_off_at |

---

## 파일 구조

```
theyool-admin/
├── app/
│   └── admin/
│       └── receivables/
│           └── page.tsx          # 미수금 관리 페이지
│
└── app/
    └── api/
        └── admin/
            └── receivables/
                ├── route.ts      # GET/PATCH 미수금 API
                └── memos/
                    └── route.ts  # 메모 API
```

---

## 보안

### 테넌트 격리

모든 API에서 `withTenant` 미들웨어로 테넌트 격리가 적용됩니다.

```typescript
export const GET = withTenant(async (request, { tenant }) => {
  // 슈퍼어드민이 아니면 테넌트 필터 적용
  if (!tenant.isSuperAdmin && tenant.tenantId) {
    query = query.eq('tenant_id', tenant.tenantId)
  }
})
```

### 권한 확인

회계 모듈 접근 권한이 없으면 403 에러 반환:

```typescript
if (!canAccessAccountingWithContext(tenant)) {
  return NextResponse.json(
    { error: '회계 기능에 접근할 수 없습니다.' },
    { status: 403 }
  )
}
```
