# 당사자 중복 표시 버그 수정 계획

## Context

### Original Request
피고가 여러 명일 때 (1. 피고, 2. 피고), 한 명의 이름만 수정하면 모든 피고에 같은 이름이 표시되는 버그 수정

### Problem Analysis
**증상**:
- 피고 1을 "김철수"로 수정 (manual_override=true)
- 피고 2는 여전히 마스킹 상태 "홍○○"
- 하지만 UI에서 피고 2도 "김철수"로 표시됨

**근본 원인** (`CaseDetail.tsx:displayCaseParties`):
```typescript
// Line 1526-1527: 이미 실명인 당사자는 스킵
if (party.party_name && !isMaskedPartyName(party.party_name))
  return party;  // usedClientFallback이 true로 설정되지 않음!

// Line 1532: 다음 당사자 처리 시
if (!usedClientFallback && hasClientFallback) {
  // usedClientFallback이 여전히 false라서 fallback 적용됨
  // → 두 번째 피고에도 의뢰인 이름이 적용됨
}
```

### Research Findings
- `displayCaseParties` 함수는 마스킹된 당사자 이름을 의뢰인 이름으로 대체하는 fallback 로직
- `usedClientFallback` 플래그로 fallback이 한 번만 적용되도록 제어
- 하지만 수동 수정된 당사자(실명)를 스킵할 때 이 플래그가 설정되지 않음

---

## Work Objectives

### Core Objective
같은 측(원고/피고)에 여러 당사자가 있을 때, 한 명의 이름만 수정해도 다른 당사자에 중복 적용되지 않도록 수정

### Deliverables
1. `displayCaseParties` 함수의 fallback 로직 수정
2. 수동 수정된 당사자가 있으면 같은 측의 다른 당사자에 fallback 적용 방지

### Definition of Done
- [ ] 피고 1만 수정 시 피고 2는 원래 마스킹된 이름 유지
- [ ] 원고 1만 수정 시 원고 2는 원래 마스킹된 이름 유지
- [ ] 기존 fallback 로직 (의뢰인 이름 → primary 당사자) 정상 작동
- [ ] TypeScript 빌드 오류 없음

---

## Guardrails

### Must Have
- 수동 수정된 당사자가 있으면 같은 측의 다른 당사자에 fallback 적용 안 함
- 기존 fallback 우선순위 유지 (linked_party_id > is_primary > client_role > 문자 매칭)

### Must NOT Have
- 기존 정상 작동하는 fallback 로직 손상
- 새로운 의존성 추가
- 복잡한 상태 관리 추가

---

## Task Flow

```
[Task 1: 실명 당사자 감지 로직 추가]
          ↓
[Task 2: fallback 적용 조건 강화]
          ↓
[Task 3: 빌드 검증]
```

---

## Detailed TODOs

### Task 1: 실명 당사자 감지 로직 추가
**File**: `/Users/hskim/luseed/components/CaseDetail.tsx`
**Location**: `displayCaseParties` 함수 내부 (line ~1524 이전)

**변경 내용**:
```typescript
// map 호출 전에 각 측(side)별로 이미 실명인 당사자가 있는지 확인
const sidesWithRealName = new Set<string>();
casePartiesWithPending.forEach((party) => {
  if (party.party_name && !isMaskedPartyName(party.party_name)) {
    const side = resolvePartySide(party);
    if (side) sidesWithRealName.add(side);
  }
});
```

**Acceptance Criteria**:
- [ ] 각 측별로 실명 당사자 존재 여부 추적
- [ ] resolvePartySide 함수 재사용

### Task 2: fallback 적용 조건 강화
**File**: `/Users/hskim/luseed/components/CaseDetail.tsx`
**Location**: `displayCaseParties` 함수의 map 콜백 내부 (line ~1532)

**변경 내용**:
```typescript
// 기존 조건에 "같은 측에 실명 당사자가 없을 때만" 조건 추가
const side = resolvePartySide(party);

// 같은 측에 이미 실명인 당사자가 있으면 fallback 적용 안 함
if (side && sidesWithRealName.has(side)) {
  return party;
}

// 기존 fallback 로직 유지
if (!usedClientFallback && hasClientFallback) {
  // ...
}
```

**Acceptance Criteria**:
- [ ] 같은 측에 실명 당사자가 있으면 fallback 스킵
- [ ] 기존 fallback 우선순위 로직 유지
- [ ] usedClientFallback 플래그 정상 작동

### Task 3: 빌드 검증
**Command**: `npm run build`

**Acceptance Criteria**:
- [ ] TypeScript 컴파일 오류 없음
- [ ] 빌드 성공

---

## Commit Strategy

### Single Commit
```
fix: 당사자 중복 표시 버그 수정

- 같은 측에 실명 당사자가 있으면 fallback 적용 방지
- displayCaseParties 함수의 fallback 조건 강화
```

---

## Success Criteria

1. **기능 검증**: 피고 1만 수정 시 피고 2는 원래 마스킹 이름 유지
2. **회귀 방지**: 기존 fallback 로직 (primary 당사자 자동 표시) 정상 작동
3. **빌드 성공**: TypeScript 오류 없음

---

## Implementation Notes

### 왜 이 방안인가?

**방안 A** (채택): 같은 측에 실명 당사자가 있으면 fallback 안 함
- 장점: 논리적으로 명확, 부작용 최소화
- 단점: 없음

**방안 B** (기각): usedClientFallback을 실명 스킵 시에도 true로 설정
- 단점: 다른 측의 primary 당사자에도 영향

**방안 C** (기각): fallback을 is_primary에만 적용
- 단점: 기존 동작 변경 범위가 큼

### 변경 범위

- 파일 1개: `CaseDetail.tsx`
- 함수 1개: `displayCaseParties`
- 라인 추가: ~10줄
