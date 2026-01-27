# Work Plan: Party Display Fix - "1. 피고 2." Issue

## Context

### Original Request
사건상세 페이지에서 당사자 내용에 피고가 "1. 피고 2." 같은 이름으로 표시되는 문제 분석 및 수정

### Background
- 스키마에는 당사자 내용이 모두 정상적으로 저장됨
- 사용자가 제공한 실명이 있으면 이를 사용해야 함
- DB 데이터는 정상 - 실제 party_name에 정상 이름들이 저장되어 있음 확인됨
- 기존 fallback 로직은 2026-01-27에 제거됨 (PARTY_FALLBACK_REMOVAL.md 참조)

### Recent Work Completed
1. case_parties 테이블에 missing columns 추가 완료 (manual_override, is_primary, scourt_label_raw, scourt_name_raw)
2. 방어 코드 일부 제거 완료 (isBrokenFormat 체크)
3. DB 데이터 검증 완료 - 실제 party_name에는 정상 이름들이 저장됨
4. displayCaseParties fallback 로직 제거 완료 (단순 전달로 변경)

---

## Problem Analysis

### Root Cause Identification

문제가 발생할 수 있는 지점은 UI 렌더링 단계:

**1. CaseHeroSection.tsx - renderPartyInfo() 함수**
- Line 237-507: 당사자 정보를 그룹화하고 표시하는 복잡한 로직
- Line 416-427: `preferredParty?.party_name`을 `displayName`으로 설정하고 처리
- Line 248-251: `applyDisplayName` 함수에서 `preservePrefix` 호출

**2. types/case-party.ts - preservePrefix() 함수**
- Line 560-577: 번호 prefix를 보존하며 이름 치환
- 방어 로직이 이미 추가되어 있음 (빈 문자열, 마스킹 이름 처리)

### Data Flow Analysis

```
SCOURT API
    ↓
party-sync.ts (syncPartiesFromScourt)
    - party_name = scourtName (btprNm) 또는 기존 이름 보존
    - scourt_name_raw = scourtName (마스킹된 원본)
    - scourt_label_raw = scourtLabel (btprDvsNm - "피고" 등)
    ↓
DB (case_parties)
    - party_name: "1. 이명규" 또는 "1. 이○○" (마스킹)
    - scourt_name_raw: "1. 이○○" (SCOURT 원본)
    - scourt_label_raw: "피고"
    ↓
GET /api/admin/cases/[id]/parties
    - parties 배열 반환
    ↓
CaseDetail.tsx
    - fetchCaseParties() → caseParties state
    - displayCaseParties = casePartiesWithPending (단순 전달)
    - casePartiesForDisplay = scourt_party_index 있는 것 우선
    ↓
CaseHeroSection.tsx
    - renderPartyInfo() 함수
    - buildSideGroup() 함수
    - 여기서 displayName 계산
```

### Potential Issue Points

1. **party_name 자체가 "1. 피고 2."로 저장된 경우**
   - SCOURT API에서 잘못된 데이터 반환 가능성
   - party-sync.ts에서 btprNm이 비정상적인 경우

2. **UI에서 party_name 대신 다른 필드 조합 사용**
   - scourt_label_raw를 party_name으로 잘못 사용
   - 여러 party의 정보가 잘못 합쳐짐

3. **preservePrefix 함수의 edge case**
   - 특정 조건에서 "1. 피고" + "2." 결합 가능성

---

## Work Objectives

### Core Objective
당사자 이름이 DB에 저장된 그대로 표시되도록 하고, "1. 피고 2." 같은 비정상 형태가 절대 표시되지 않도록 수정

### Deliverables
1. 버그 원인 정확히 파악 (DB vs UI)
2. 필요한 수정 적용
3. 검증 및 테스트

### Definition of Done
- [ ] "1. 피고 2." 형태가 UI에서 절대 표시되지 않음
- [ ] 실명이 있는 당사자는 실명으로 표시
- [ ] 마스킹된 당사자는 마스킹된 이름 그대로 표시
- [ ] TypeScript 빌드 오류 없음

---

## Guardrails

### Must Have
- DB에 저장된 party_name 우선 표시
- 방어 코드로 비정상 형태 감지 및 fallback

### Must NOT Have
- 스키마 변경
- SCOURT 동기화 로직 변경
- 기존 정상 작동 케이스 손상

---

## Task Flow

```
[Task 1: 원인 확인] DB 데이터 vs UI 렌더링 확인
         ↓
[Task 2: CaseHeroSection 수정] displayName 계산 로직 단순화
         ↓
[Task 3: 최종 방어 코드] 비정상 형태 감지 및 원본 fallback
         ↓
[Task 4: 검증] 빌드 및 UI 테스트
```

---

## Detailed TODOs

### Task 1: 원인 확인

**목적**: "1. 피고 2." 형태가 DB에서 오는지 UI에서 생성되는지 확인

**방법**:
1. DB에서 직접 party_name 조회
2. API 응답 확인 (/api/admin/cases/[id]/parties)
3. 콘솔 로깅으로 렌더링 시점 값 확인

**예상 결과**:
- DB와 API에는 정상 데이터
- UI 렌더링 로직에서 문제 발생

---

### Task 2: CaseHeroSection displayName 로직 단순화

**File**: `/Users/hskim/luseed/components/case/CaseHeroSection.tsx`
**Location**: buildSideGroup 함수 (Line 378-453)

**현재 코드** (Line 416-428):
```typescript
const baseName = preferredParty?.party_name || ''

let displayName = preferredParty?.party_name || '-'
if (isClientSide && caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
  displayName = applyDisplayName(baseName, caseData.client.name)
} else {
  const resolvedName = preferredParty ? resolveCasePartyName(preferredParty) : null
  if (resolvedName) {
    displayName = applyDisplayName(baseName, resolvedName)
  } else if (preferredParty?.party_name) {
    displayName = removeNumberPrefix(preferredParty.party_name)
  }
}
```

**문제점**:
- `applyDisplayName`이 복잡한 조합을 수행
- `resolveCasePartyName`이 null 반환 시 party_name 사용하지만 edge case 존재

**수정 방향**:
```typescript
const baseName = preferredParty?.party_name || ''

// 1순위: DB party_name 그대로 사용 (이미 실명으로 업데이트 됨)
let displayName = baseName ? removeNumberPrefix(baseName) : '-'

// 2순위: 마스킹된 경우에만 대체 시도
if (isMaskedPartyName(baseName)) {
  // 의뢰인 이름으로 대체 시도
  if (isClientSide && caseData.client?.name && !isMaskedPartyName(caseData.client.name)) {
    displayName = caseData.client.name
  } else {
    const resolvedName = preferredParty ? resolveCasePartyName(preferredParty) : null
    if (resolvedName && !isMaskedPartyName(resolvedName)) {
      displayName = resolvedName
    }
  }
}

// 최종 방어: 비정상 형태 감지
if (isBrokenPartyName(displayName)) {
  displayName = baseName ? removeNumberPrefix(baseName) : '-'
}
```

**Acceptance Criteria**:
- [ ] DB에 실명이 있으면 실명 표시
- [ ] DB에 마스킹된 이름이 있으면 의뢰인 이름으로 대체 시도
- [ ] 대체 실패 시 마스킹된 이름 그대로 표시

---

### Task 3: 비정상 형태 감지 함수 추가

**File**: `/Users/hskim/luseed/components/case/CaseHeroSection.tsx`
**Location**: renderPartyInfo 함수 상단 (Line 237 이후)

**추가 코드**:
```typescript
// 비정상 당사자 이름 형태 감지
// 예: "1. 피고 2.", "피고 2.", "1. 2." 등
const isBrokenPartyName = (name: string): boolean => {
  if (!name) return true
  const trimmed = name.trim()
  // 빈 문자열
  if (!trimmed) return true
  // "N. 라벨 M." 형태 (예: "1. 피고 2.")
  if (/^\d+\.\s*[가-힣]+\s+\d+\.?$/.test(trimmed)) return true
  // "라벨 N." 형태 (예: "피고 2.")
  if (/^[가-힣]+\s+\d+\.?$/.test(trimmed)) return true
  // "N. M." 형태 (예: "1. 2.")
  if (/^\d+\.\s*\d+\.?$/.test(trimmed)) return true
  // 숫자와 점만 있는 경우
  if (/^[\d.\s]+$/.test(trimmed)) return true
  return false
}
```

**Acceptance Criteria**:
- [ ] "1. 피고 2." → true (비정상)
- [ ] "피고 2." → true (비정상)
- [ ] "1. 2." → true (비정상)
- [ ] "1. 이명규" → false (정상)
- [ ] "이명규" → false (정상)
- [ ] "이○○" → false (마스킹, 정상)

---

### Task 4: 검증 및 테스트

**검증 명령**:
```bash
# TypeScript 컴파일
npx tsc --noEmit

# 린트 확인
npm run lint

# 빌드 확인
npm run build
```

**UI 테스트 시나리오**:
1. 당사자 실명이 설정된 사건 → 실명 표시
2. 당사자 마스킹된 사건 (의뢰인 연결 O) → 의뢰인 이름 표시
3. 당사자 마스킹된 사건 (의뢰인 연결 X) → 마스킹된 이름 표시
4. 피고가 여러 명인 사건 → 각각 개별 이름 표시

**Acceptance Criteria**:
- [ ] 컴파일 에러 없음
- [ ] 린트 에러 없음
- [ ] 빌드 성공
- [ ] UI에서 "1. 피고 2." 형태 미표시

---

## Commit Strategy

### Single Commit
```
fix: 당사자 이름 표시 오류 수정 - "1. 피고 2." 형태 방지

- CaseHeroSection displayName 로직 단순화 (DB 우선)
- 비정상 이름 형태 감지 함수 추가
- 마스킹된 경우에만 대체 로직 적용
```

---

## Success Criteria

| Criteria | Verification Method |
|----------|---------------------|
| "1. 피고 2." 미표시 | UI 테스트: 문제 사건 확인 |
| 실명 정상 표시 | 실명 설정된 사건에서 확인 |
| 마스킹 정상 표시 | 실명 없는 사건에서 "이○○" 유지 |
| 빌드 성공 | npm run build 통과 |

---

## Key Files

| File | Purpose |
|------|---------|
| `components/case/CaseHeroSection.tsx` | 당사자 표시 UI (주요 수정 대상) |
| `components/CaseDetail.tsx` | 당사자 데이터 로딩 (이미 수정 완료) |
| `types/case-party.ts` | 당사자 유틸리티 함수 (preservePrefix 등) |
| `lib/scourt/party-sync.ts` | SCOURT 동기화 (확인용) |
| `app/api/admin/cases/[id]/parties/route.ts` | API (확인용) |

---

## Implementation Notes

### 왜 이 방안인가?

**핵심 원칙**: DB에 저장된 party_name을 신뢰하고 우선 사용

- party_name이 이미 실명으로 업데이트되어 있으면 그대로 표시
- party_name이 마스킹된 경우에만 대체 로직 적용
- 대체 로직 실패 시에도 원본 party_name 유지 (마스킹 상태 그대로)

### 변경 범위
- 파일 1개: `CaseHeroSection.tsx`
- 함수 2개: `renderPartyInfo` 내부의 `buildSideGroup`, 새 `isBrokenPartyName`
- 라인 추가: ~30줄
