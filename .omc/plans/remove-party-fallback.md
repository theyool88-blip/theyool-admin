# Plan: Fallback 로직 제거 - 당사자 이름 표시

## Context

### Original Request
당사자 이름 표시에서 의뢰인 이름을 마스킹된 당사자에 자동 적용하는 fallback 로직 제거.
한 명 수정 시 다른 당사자에도 같은 이름이 표시되는 버그 해결.

### Decision
**B안: Fallback 로직 완전 제거** - DB에 저장된 party_name을 그대로 표시

### Problem Analysis
- `displayCaseParties` useMemo (lines 1462-1579): 약 120줄의 복잡한 fallback 로직
- 의뢰인 이름(`caseData.client?.name`, `caseClients`)을 마스킹된 당사자에 자동 적용
- `is_primary`, `linked_party_id`, `client_role`, 문자 매칭 등 여러 우선순위로 fallback 시도
- 이로 인해 한 당사자 수정 시 다른 당사자에도 같은 이름이 표시되는 버그 발생

---

## Work Objectives

### Core Objective
`displayCaseParties` useMemo의 fallback 로직을 제거하여 DB에 저장된 `party_name`을 그대로 표시

### Deliverables
1. `displayCaseParties` useMemo 단순화 - `casePartiesWithPending` 직접 반환
2. 불필요해진 변수 및 로직 정리

### Definition of Done
- [ ] `displayCaseParties`가 fallback 없이 `casePartiesWithPending` 반환
- [ ] 기존 당사자 목록 표시 기능 정상 작동
- [ ] 당사자 수정 기능 정상 작동
- [ ] TypeScript 빌드 에러 없음

---

## Guardrails

### Must Have
- DB에 저장된 `party_name` 그대로 표시
- `casePartiesForDisplay` useMemo 구조 유지 (scourt_party_index 필터링 로직)
- 기존 당사자 관련 기능(표시, 수정, 삭제) 유지

### Must NOT Have
- 새로운 fallback 로직 추가
- `casePartiesForDisplay`를 사용하는 다른 코드 변경 (타입 호환 유지)

---

## Task Flow

```
[Task 1: displayCaseParties 단순화]
         |
         v
[Task 2: 빌드 검증]
```

---

## Detailed TODOs

### Task 1: displayCaseParties useMemo 단순화
**File:** `/Users/hskim/luseed/components/CaseDetail.tsx`
**Lines:** 1462-1579

**변경 내용:**
```typescript
// Before (120+ lines of fallback logic)
const displayCaseParties = useMemo(() => {
  if (casePartiesWithPending.length === 0) return casePartiesWithPending;
  // ... 복잡한 fallback 로직 ...
}, [casePartiesWithPending, caseData.client?.name, caseData.client_role, caseClients]);

// After (단순히 반환)
const displayCaseParties = useMemo(() => {
  return casePartiesWithPending;
}, [casePartiesWithPending]);
```

**Acceptance Criteria:**
- [ ] fallback 로직 완전 제거
- [ ] `casePartiesWithPending` 직접 반환
- [ ] dependency array 단순화

### Task 2: 빌드 검증
**Command:** `npm run build` 또는 `npx tsc --noEmit`

**Acceptance Criteria:**
- [ ] TypeScript 컴파일 에러 없음
- [ ] 빌드 성공

---

## Commit Strategy

### Single Commit
```
fix: 당사자 이름 fallback 로직 제거

- displayCaseParties useMemo에서 fallback 로직 제거
- DB에 저장된 party_name을 그대로 표시
- 한 당사자 수정 시 다른 당사자에 같은 이름 표시되는 버그 해결
```

---

## Success Criteria

1. **기능 검증:** 당사자 목록이 DB에 저장된 이름 그대로 표시됨
2. **버그 해결:** 한 당사자 수정 시 다른 당사자에 영향 없음
3. **빌드 성공:** TypeScript 에러 없음

---

## Estimated Complexity
**LOW** - 단일 파일, 단일 useMemo 단순화

## Files Affected
- `/Users/hskim/luseed/components/CaseDetail.tsx` (1 file)
