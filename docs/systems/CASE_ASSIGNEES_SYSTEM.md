# 사건 담당자 시스템

**Last Updated**: 2026-01-17

사건별 담당 변호사 다중 지정 및 권한 관리 시스템입니다.

---

## 개요

### 주요 기능

| 구분 | 기능 |
|------|------|
| **다중 담당자** | 한 사건에 여러 변호사 지정 가능 |
| **주/부담당 구분** | `is_primary` 플래그로 주담당 표시 |
| **레거시 호환** | `legal_cases.assigned_to`와 동기화 |
| **UI 표시** | 주담당 + "+N" 뱃지 패턴 |

---

## 데이터베이스 스키마

### case_assignees 테이블

```sql
CREATE TABLE case_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,  -- 주 담당 변호사
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 한 사건에 한 멤버는 한 번만 지정
  UNIQUE(case_id, member_id)
);

-- 인덱스
CREATE INDEX idx_case_assignees_tenant_id ON case_assignees(tenant_id);
CREATE INDEX idx_case_assignees_case_id ON case_assignees(case_id);
CREATE INDEX idx_case_assignees_member_id ON case_assignees(member_id);
CREATE INDEX idx_case_assignees_is_primary ON case_assignees(is_primary) WHERE is_primary = true;
```

### 레거시 호환

`legal_cases.assigned_to` 컬럼은 하위 호환성을 위해 유지됩니다:
- 주담당자(`is_primary = true`) 변경 시 자동 동기화
- 신규 사건 생성 시 첫 번째 담당자가 주담당으로 설정

---

## API

### GET /api/admin/cases

사건 목록 조회 시 `assignees` 배열 포함:

```typescript
// 응답 형식
{
  cases: [
    {
      id: "uuid",
      case_name: "김철수 이혼사건",
      // 레거시 필드
      assigned_to: "uuid",
      assigned_member: { id, display_name, role },
      // 다중 담당자
      assignees: [
        {
          id: "case_assignee_uuid",
          memberId: "tenant_member_uuid",
          isPrimary: true,
          displayName: "김변호사",
          role: "lawyer"
        },
        {
          id: "case_assignee_uuid2",
          memberId: "tenant_member_uuid2",
          isPrimary: false,
          displayName: "이변호사",
          role: "lawyer"
        }
      ]
    }
  ]
}
```

### POST /api/admin/cases

사건 생성 시 담당자 지정:

```typescript
// 요청 형식
{
  case_name: "신규 사건",
  // 방법 1: 다중 담당자 (권장)
  assignees: [
    { member_id: "uuid1", is_primary: true },
    { member_id: "uuid2" }
  ],
  // 방법 2: 레거시 단일 담당자
  assigned_to: "uuid"
}
```

### GET/PUT /api/admin/cases/[id]/assignees

담당자 목록 조회 및 수정 전용 API:

```typescript
// GET 응답
{
  assignees: [
    { id, member_id, is_primary, member: { display_name, role } }
  ]
}

// PUT 요청 (전체 교체)
{
  assignees: [
    { member_id: "uuid1", is_primary: true },
    { member_id: "uuid2" }
  ]
}
```

---

## UI 컴포넌트

### CasesList (사건 목록)

담당자 열에 다중 담당자 표시:

```
┌─────────────────────────┐
│ 김변호사 ★  +2          │
└─────────────────────────┘
```

| 요소 | 스타일 | 설명 |
|------|--------|------|
| 주담당 | `bg-sage-100 text-sage-700` | 이름 + ★ |
| 추가 담당 | `bg-gray-100 text-gray-600` | +N 뱃지 |
| hover | 툴팁 | 전체 담당자 목록 표시 |

```typescript
// components/CasesList.tsx
interface CaseAssignee {
  id: string
  memberId: string
  isPrimary: boolean
  displayName: string
  role: string
}

// 렌더링 로직
const primary = assignees.find(a => a.isPrimary)
const others = assignees.filter(a => !a.isPrimary)

<>
  {primary && (
    <span className="bg-sage-100 text-sage-700" title={`주담당: ${primary.displayName}`}>
      {primary.displayName} ★
    </span>
  )}
  {others.length > 0 && (
    <span className="bg-gray-100 text-gray-600" title={others.map(a => a.displayName).join(', ')}>
      +{others.length}
    </span>
  )}
</>
```

### AssigneeMultiSelect (담당자 선택)

사건 생성/수정 시 다중 담당자 선택 컴포넌트:

```typescript
// components/ui/AssigneeMultiSelect.tsx
interface AssigneeMultiSelectProps {
  value: Array<{ member_id: string; is_primary?: boolean }>
  onChange: (assignees: Array<{ member_id: string; is_primary?: boolean }>) => void
  members: Array<{ id: string; display_name: string; role: string }>
}
```

---

## 마이그레이션

### 기존 데이터 마이그레이션

`legal_cases.assigned_to`가 설정된 기존 사건의 데이터 마이그레이션:

```sql
-- 기존 assigned_to 데이터를 case_assignees로 마이그레이션
INSERT INTO case_assignees (tenant_id, case_id, member_id, is_primary)
SELECT
  lc.tenant_id,
  lc.id,
  lc.assigned_to,
  true
FROM legal_cases lc
WHERE lc.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM case_assignees ca
    WHERE ca.case_id = lc.id AND ca.member_id = lc.assigned_to
  );
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260116100000_case_assignees_and_permissions.sql` | 테이블 생성 |
| `app/api/admin/cases/route.ts` | 사건 목록 API (assignees 포함) |
| `app/api/admin/cases/[id]/assignees/route.ts` | 담당자 전용 API |
| `components/CasesList.tsx` | 사건 목록 UI |
| `components/ui/AssigneeMultiSelect.tsx` | 담당자 선택 컴포넌트 |
| `types/case.ts` | TypeScript 타입 정의 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-17 | CasesList 다중 담당자 UI 표시 구현 |
| 2026-01-16 | case_assignees 테이블 및 API 생성 |
