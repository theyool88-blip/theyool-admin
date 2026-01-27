# Work Plan: Fix Party Name Display Issue

## Context

### Original Request
사건상세 페이지에서 당사자 이름이 "1. 피고 2." 같은 잘못된 형식으로 표시되는 문제 해결

### Problem Analysis
1. **Root Cause**: `preservePrefix` 함수가 빈 문자열이나 마스킹된 이름으로 호출될 때 발생
   - `preservePrefix("1. 피고", "")` → `"1. 피고"` (빈 newName)
   - 이후 다른 party의 prefix와 결합되어 "1. 피고 2." 같은 형태 생성

2. **Data Flow**:
   ```
   SCOURT API → party_name에 "1. 피고 이○○" 저장
                         ↓
   displayCaseParties → fallback 로직에서 빈 문자열 전달
                         ↓
   preservePrefix("1. 피고 이○○", "") → 깨진 결과
   ```

3. **Key Files**:
   - `/Users/hskim/luseed/types/case-party.ts` (lines 560-569): `preservePrefix` 함수
   - `/Users/hskim/luseed/components/CaseDetail.tsx` (lines 1462-1566): `displayCaseParties` 로직
   - `/Users/hskim/luseed/components/CaseDetail.tsx` (lines 2323-2622): `renderPartyInfo` 렌더링

---

## Work Objectives

### Core Objective
당사자 이름이 항상 유효한 형태로 표시되도록 수정

### Deliverables
1. `preservePrefix` 함수에 빈 문자열/마스킹된 이름 방어 로직 추가
2. `displayCaseParties`에서 fallback 실패 시 원본 유지 로직 강화
3. `renderPartyInfo`에서 최종 렌더링 전 검증 추가

### Definition of Done
- "1. 피고 2." 같은 깨진 형태가 절대 표시되지 않음
- 실명이 있으면 실명으로 표시
- 실명이 없으면 SCOURT 원본 그대로 표시 (마스킹 포함)
- 기존 정상 케이스에 영향 없음

---

## Guardrails

### Must Have
- 스키마에 모든 당사자 데이터 보존
- 사용자가 제공한 실명 우선 표시
- 빈 문자열이나 undefined 방어
- 기존 테스트 통과

### Must NOT Have
- 스키마 변경
- 새로운 의존성 추가
- SCOURT 동기화 로직 변경
- 기존 데이터 마이그레이션

---

## Task Flow

```
[Task 1] preservePrefix 함수 방어 로직 추가
         ↓
[Task 2] displayCaseParties fallback 로직 강화
         ↓
[Task 3] renderPartyInfo 최종 검증 추가
         ↓
[Task 4] 검증 및 테스트
```

---

## Detailed TODOs

### Task 1: preservePrefix 함수 방어 로직 추가
**File**: `/Users/hskim/luseed/types/case-party.ts`
**Lines**: 560-569

**Current Code**:
```typescript
export function preservePrefix(originalValue: string, newName: string): string {
  if (!originalValue) return newName;
  const prefixMatch = originalValue.match(PARTY_NAME_PREFIX_REGEX);
  const suffixMatch = originalValue.match(PARTY_NAME_SUFFIX_REGEX);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const cleanedName = newName.replace(PARTY_NAME_SUFFIX_REGEX, '').trim();
  const combined = `${prefix}${cleanedName}${suffix}`;
  return combined.trim() || cleanedName;
}
```

**Required Changes**:
```typescript
export function preservePrefix(originalValue: string, newName: string): string {
  // 방어: newName이 비어있거나 유효하지 않으면 원본 그대로 반환
  if (!newName || !newName.trim()) {
    return originalValue || '';
  }
  // 방어: newName이 마스킹된 이름이면 원본 유지
  if (isMaskedPartyName(newName)) {
    return originalValue || newName;
  }
  if (!originalValue) return newName;
  const prefixMatch = originalValue.match(PARTY_NAME_PREFIX_REGEX);
  const suffixMatch = originalValue.match(PARTY_NAME_SUFFIX_REGEX);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const cleanedName = newName.replace(PARTY_NAME_SUFFIX_REGEX, '').trim();
  const combined = `${prefix}${cleanedName}${suffix}`;
  return combined.trim() || cleanedName || originalValue;
}
```

**Acceptance Criteria**:
- [x] `preservePrefix("1. 피고", "")` → `"1. 피고"` (원본 유지)
- [x] `preservePrefix("1. 이○○", "이○○")` → `"1. 이○○"` (마스킹된 이름 → 원본 유지)
- [x] `preservePrefix("1. 이○○", "이명규")` → `"1. 이명규"` (정상 치환)

---

### Task 2: displayCaseParties fallback 로직 강화
**File**: `/Users/hskim/luseed/components/CaseDetail.tsx`
**Lines**: 1556-1562

**Current Code**:
```typescript
if (!fallbackName) return party;

updated = true;
return {
  ...party,
  party_name: preservePrefix(party.party_name || "", fallbackName),
};
```

**Required Changes**:
```typescript
if (!fallbackName) return party;

// 방어: fallbackName이 유효한 실명인지 확인
const isValidFallback = fallbackName &&
  fallbackName.trim() &&
  !isMaskedPartyName(fallbackName);

if (!isValidFallback) return party;

const newPartyName = preservePrefix(party.party_name || "", fallbackName);
// 방어: 결과가 원본보다 나쁘면 원본 유지
if (!newPartyName || isMaskedPartyName(newPartyName)) {
  return party;
}

updated = true;
return {
  ...party,
  party_name: newPartyName,
};
```

**Acceptance Criteria**:
- [x] fallbackName이 빈 문자열이면 원본 유지
- [x] fallbackName이 마스킹된 이름이면 원본 유지
- [x] 치환 결과가 더 나쁘면 원본 유지

---

### Task 3: renderPartyInfo 최종 검증 추가
**File**: `/Users/hskim/luseed/components/CaseDetail.tsx`
**Lines**: 2566-2582

**Current Code**:
```typescript
let displayName = preferredParty?.party_name || "-";
if (
  isClientSide &&
  caseData.client?.name &&
  !isMaskedPartyName(caseData.client.name)
) {
  displayName = applyDisplayName(baseName, caseData.client.name);
} else {
  const resolvedName = preferredParty
    ? resolveCasePartyName(preferredParty)
    : null;
  if (resolvedName) {
    displayName = applyDisplayName(baseName, resolvedName);
  } else if (preferredParty?.party_name) {
    displayName = removeNumberPrefix(preferredParty.party_name);
  }
}
```

**Required Changes**:
1. `applyDisplayName` 함수 내에 최종 검증 추가 (line 2340-2345):
```typescript
const applyDisplayName = (originalName: string, fullName: string) => {
  // 방어: fullName이 비어있거나 마스킹되면 원본 사용
  if (!fullName || !fullName.trim() || isMaskedPartyName(fullName)) {
    return originalName ? removeNumberPrefix(originalName) : '-';
  }
  const combined = originalName
    ? preservePrefix(originalName, fullName)
    : fullName;
  const result = removeNumberPrefix(combined);
  // 방어: 결과가 유효하지 않으면 원본 사용
  return result && result.trim() ? result : (originalName ? removeNumberPrefix(originalName) : '-');
};
```

2. displayName 최종 검증 (line 2582 이후):
```typescript
// 최종 방어: displayName이 "1. 피고 2." 같은 깨진 형태인지 확인
const isBrokenFormat = /^\d+\.\s*[가-힣]+\s+\d+\.?$/.test(displayName);
if (isBrokenFormat || !displayName || displayName === '-') {
  displayName = preferredParty?.party_name
    ? removeNumberPrefix(preferredParty.party_name)
    : '-';
}
```

**Acceptance Criteria**:
- [x] "1. 피고 2." 형태 감지 및 원본으로 대체
- [x] 빈 displayName → "-" 표시
- [x] 정상적인 이름은 그대로 표시

---

### Task 4: 검증 및 테스트
**Actions**:
1. TypeScript 컴파일 확인: `npx tsc --noEmit`
2. 린트 확인: `npm run lint`
3. 개발 서버 실행 후 다음 케이스 확인:
   - 실명이 있는 사건: 실명 표시
   - 실명이 없는 사건: SCOURT 원본 표시 (마스킹 포함)
   - 빈 당사자 데이터: 깨진 형태 없이 표시

**Acceptance Criteria**:
- [x] 컴파일 에러 없음
- [x] 린트 에러 없음
- [x] UI에서 "1. 피고 2." 형태가 표시되지 않음

---

## Commit Strategy

### Single Commit
```
fix: 당사자 이름 표시 오류 수정 - "1. 피고 2." 형태 방지

- preservePrefix 함수에 빈 문자열/마스킹 이름 방어 로직 추가
- displayCaseParties fallback 로직 강화
- renderPartyInfo 최종 검증 추가
```

---

## Success Criteria

| Criteria | Verification Method |
|----------|---------------------|
| 깨진 형태 표시 안됨 | UI 테스트: 여러 사건 상세 페이지 확인 |
| 실명 정상 표시 | 실명 설정된 사건에서 실명 표시 확인 |
| 마스킹 원본 유지 | 실명 없는 사건에서 "이○○" 형태 유지 |
| 기존 기능 유지 | 컴파일/린트 통과, 기존 동작 유지 |
