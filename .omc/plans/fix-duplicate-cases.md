# Fix Duplicate Cases Plan

## Context

### Original Request
사건 추가 시 같은 사건이 중복으로 등록되어 기일도 중복되는 문제 해결

### Problem Analysis
현재 시스템에서 동일한 사건(같은 법원, 같은 사건번호)이 여러 번 등록될 수 있음.
이로 인해:
1. 데이터 무결성 손상
2. 기일(court_hearings, legal_deadlines)이 중복 생성됨
3. 캘린더/일정 화면에서 같은 기일이 여러 번 표시됨

### Root Causes
1. **DB UNIQUE 제약조건 부재**: `legal_cases` 테이블에 `(tenant_id, court_case_number, court_name)` 조합에 대한 UNIQUE 제약조건 없음
2. **API 중복 체크 조건 불완전**: `court_case_number`와 `court_name` 둘 다 있어야만 중복 체크 수행
3. **프론트엔드 더블클릭 방지 부족**: `handleSubmit`에서 `loading` 상태 체크 없음
4. **Race condition**: 동시 요청 시 SELECT-INSERT 사이에 중복 삽입 가능

### Technical Notes
- PostgreSQL에서 NULL은 서로 다른 값으로 취급되어 UNIQUE 인덱스에서 중복 허용됨
- Supabase에서 NULL 비교는 `.is('column', null)` 메서드 사용 필요
- PostgreSQL UNIQUE violation 에러 코드: **23505**

---

## Work Objectives

### Core Objective
사건 중복 등록을 DB 레벨과 애플리케이션 레벨에서 모두 방지

### Deliverables
1. DB UNIQUE 제약조건 마이그레이션 파일
2. API 중복 체크 로직 개선
3. 프론트엔드 더블클릭 방지
4. Race condition 방지를 위한 트랜잭션 처리

### Definition of Done
- [ ] 동일한 tenant_id + court_case_number + court_name 조합으로 INSERT 시 DB 에러 발생
- [ ] API에서 court_case_number만 있어도 중복 체크 수행
- [ ] 프론트엔드에서 제출 버튼 더블클릭 방지
- [ ] 동시 요청 시에도 하나의 사건만 생성됨
- [ ] 기존 데이터에 영향 없음 (기존 중복은 별도 정리 필요)

---

## Guardrails

### Must Have
- 기존 사건 데이터 손상 없음
- UNIQUE 제약조건은 NULL 허용 (court_case_number가 없는 사건 가능)
- 사용자에게 명확한 에러 메시지 제공

### Must NOT Have
- 기존 중복 데이터 자동 삭제 (관리자가 수동 정리해야 함)
- court_case_number 필수화 (현재 선택 필드)

---

## Task Flow and Dependencies

```
[1] DB Migration (UNIQUE 제약조건)
    |
    v
[2] API 중복 체크 개선 -----> [4] 테스트
    |
[3] Frontend 더블클릭 방지 --/
```

---

## Detailed TODOs

### TODO 1: DB UNIQUE 제약조건 추가
**File:** `supabase/migrations/20260127000001_add_legal_cases_unique_constraint.sql` (신규)

**Pre-requisite:** 마이그레이션 적용 전 중복 데이터 확인 및 정리 필수 (아래 마이그레이션 순서 참조)

**Tasks:**
- [ ] 두 개의 부분 UNIQUE 인덱스 생성 (court_name NULL/NOT NULL 케이스 분리)
- [ ] 기존 중복 데이터 확인 쿼리 포함 (주석으로)

**SQL 구조:**
```sql
-- 사건번호와 법원명이 모두 있는 경우 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_with_court
ON legal_cases (tenant_id, court_case_number, court_name)
WHERE court_case_number IS NOT NULL AND court_name IS NOT NULL;

-- 사건번호만 있고 법원명이 NULL인 경우 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_no_court
ON legal_cases (tenant_id, court_case_number)
WHERE court_case_number IS NOT NULL AND court_name IS NULL;
```

**Why Two Indexes:**
PostgreSQL에서 NULL은 서로 다른 값으로 취급되어 단일 인덱스로는 `(tenant_id, court_case_number, NULL)` 조합의 중복을 방지할 수 없음.

**Acceptance Criteria:**
- 같은 tenant_id, court_case_number, court_name 조합 INSERT 시 에러 (court_name NOT NULL)
- 같은 tenant_id, court_case_number 조합 INSERT 시 에러 (court_name IS NULL)
- court_case_number가 NULL인 사건은 여러 개 생성 가능

---

### Migration 순서 (CRITICAL)

마이그레이션 적용 전 반드시 아래 순서를 따를 것:

**Step 1: 중복 데이터 확인**
```sql
-- 실행하여 중복 여부 확인
SELECT tenant_id, court_case_number, court_name, COUNT(*), array_agg(id)
FROM legal_cases
WHERE court_case_number IS NOT NULL
GROUP BY tenant_id, court_case_number, court_name
HAVING COUNT(*) > 1;
```

**Step 2: 중복 있으면 수동 정리**
- 결과가 있으면 관리자가 수동으로 중복 사건 병합/삭제
- 관련 court_hearings, legal_deadlines도 함께 정리 필요

**Step 3: 마이그레이션 적용**
```bash
supabase db push
# 또는
supabase migration up
```

**Step 4: 적용 확인**
```sql
-- 인덱스 생성 확인
SELECT indexname FROM pg_indexes
WHERE tablename = 'legal_cases'
AND indexname LIKE 'idx_legal_cases_unique%';
```

---

### TODO 2: API 중복 체크 로직 개선
**File:** `/Users/hskim/luseed/app/api/admin/cases/route.ts:378-394`

**Current Code (Line 378-394):**
```typescript
// 중복 사건 검사 (정제된 사건번호 + 정규화된 법원명으로 검색)
if (cleanedCaseNumber && resolvedCourtName) {
  const { data: existingCase } = await adminClient
    ...
}
```

**Tasks:**
- [ ] `cleanedCaseNumber`만 있어도 중복 체크 수행
- [ ] `court_name` NULL 비교 시 Supabase `.is('court_name', null)` 메서드 사용
- [ ] DB INSERT를 try-catch로 감싸서 UNIQUE violation 처리
- [ ] PostgreSQL 에러 코드 **23505** 체크하여 중복 에러 식별
- [ ] 409 응답에 기존 사건 링크 포함

**NULL 비교 주의사항:**
```typescript
// WRONG - Supabase에서 NULL 비교 안됨
.eq('court_name', null)

// CORRECT - Supabase NULL 비교 방식
.is('court_name', null)
```

**UNIQUE violation 처리:**
```typescript
try {
  const { data, error } = await adminClient.from('legal_cases').insert(...)
  if (error) {
    // PostgreSQL UNIQUE violation 에러 코드
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '동일한 사건번호가 이미 등록되어 있습니다.', existingCaseId: '...' },
        { status: 409 }
      )
    }
    throw error
  }
} catch (e) { ... }
```

**Acceptance Criteria:**
- court_case_number만 있어도 중복 체크
- court_name이 NULL인 경우도 올바르게 비교
- DB UNIQUE 에러(23505) 시 적절한 409 응답 반환
- 에러 메시지에 기존 사건 정보 포함

---

### TODO 3: 프론트엔드 더블클릭 방지
**File:** `/Users/hskim/luseed/components/NewCaseForm.tsx:743-746`

**Current Code:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  await submitCase()
}
```

**Tasks:**
- [ ] `loading` 상태 체크 추가

**Target Code:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (loading) return  // 더블클릭 방지
  await submitCase()
}
```

**Note:** 제출 버튼의 `disabled={loading}` 속성은 이미 존재함 (1361번 라인) - 별도 작업 불필요

**Acceptance Criteria:**
- 빠른 더블클릭 시 한 번만 API 호출
- 로딩 중 버튼 비활성화 상태 (기존 구현 확인)

---

## Commit Strategy

### Commit 1: DB Migration
```
feat(db): add unique constraint for legal_cases

- Add two partial unique indexes for NULL/NOT NULL court_name cases
- idx_legal_cases_unique_with_court: (tenant_id, court_case_number, court_name)
- idx_legal_cases_unique_no_court: (tenant_id, court_case_number) WHERE court_name IS NULL
- Prevents duplicate case registration at DB level
```

### Commit 2: API Improvements
```
fix(api): improve duplicate case detection in POST /api/admin/cases

- Check for duplicates even when only court_case_number is provided
- Use .is('court_name', null) for proper NULL comparison in Supabase
- Handle DB unique violation error (code 23505) gracefully
- Return existing case info in 409 response
```

### Commit 3: Frontend Improvements
```
fix(ui): prevent double-click on case creation form

- Add loading state check in handleSubmit
```

---

## Success Criteria

1. **Unit Test**: 같은 사건번호+법원으로 2회 POST 시 두 번째 요청 409 반환
2. **Integration Test**: 프론트엔드에서 빠르게 더블클릭 시 하나의 사건만 생성
3. **DB Test**: 직접 SQL로 중복 INSERT 시도 시 에러 발생
4. **Regression**: 기존 사건 조회/수정 기능 정상 동작

---

## Notes

### 기존 중복 데이터 처리
마이그레이션 전에 기존 중복 데이터가 있으면 UNIQUE 인덱스 생성 실패할 수 있음.
**반드시 TODO 1의 "Migration 순서" 섹션을 따를 것.**

### Race Condition 완화
DB UNIQUE 제약조건이 궁극적인 방어선 역할.
API 레벨 체크는 사용자 경험 개선용 (친절한 에러 메시지).

### PostgreSQL NULL 처리 주의사항
- NULL은 UNIQUE 인덱스에서 서로 다른 값으로 취급됨
- 따라서 두 개의 부분 인덱스로 모든 케이스 커버 필요
- Supabase에서 NULL 비교는 `.eq()` 대신 `.is()` 메서드 사용
