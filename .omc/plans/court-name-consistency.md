# Plan: 법원명 표시 일관성 개선 (확장판)

## Context

### Original Request
법원명 표시 일관성 개선:
- /cases 페이지에서 단축형이 아닌 형식으로 표시되는 법원명을 시스템 전체에서 일관된 단축형으로 통일
- 대법원 API에는 원래 형식(정식명) 유지 필요

### Problem Analysis

**현재 상태: 두 가지 축약 함수가 병존 + 축약 없이 직접 표시하는 곳 존재**

| 함수/방식 | 위치 | 로직 |
|---------|------|------|
| `shortenCourtName()` | CasesList.tsx (로컬) | 단순 문자열 치환 (`지방법원` → `지법`) |
| `getCourtAbbrev()` | court-codes.ts (공유) | 패턴 기반 지능형 축약 |
| 직접 표시 | client-preview 페이지들 | 축약 없이 정식명 그대로 표시 |

**결과물 비교**

| 입력 | shortenCourtName() | getCourtAbbrev() | 직접 표시 |
|------|-------------------|------------------|----------|
| 수원가정법원 평택지원 | 수원가법 평택지원 | 평택가정 | 수원가정법원 평택지원 |
| 대전지방법원 천안지원 | 대전지법 천안지원 | 천안지원 | 대전지방법원 천안지원 |
| 서울중앙지방법원 | 서울중앙지법 | 서울중앙지방 | 서울중앙지방법원 |

### 영향 범위 분석

**1. 중복 함수 사용 (필수 수정)**
- `CasesList.tsx` - 로컬 `shortenCourtName()` 함수 사용

**2. 축약 없이 직접 표시 (검토 및 수정)**
- `app/admin/client-preview/[clientId]/page.tsx` - 3곳
- `app/admin/client-preview/[clientId]/cases/[caseId]/page.tsx` - 3곳

**3. 캘린더 관련 중복 함수 (통합 권장)**
- `MonthlyCalendar.tsx` - 로컬 `shortenCourtLocation()`
- `ScheduleListView.tsx` - 로컬 `shortenCourtLocation()`
- `eventTransformers.ts` - 공유 `shortenCourtLocation()`

**4. getCourtAbbrev() 정상 사용 (확인만)**
- 18개 파일에서 이미 올바르게 사용 중

---

## Work Objectives

### Core Objective
시스템 전체에서 법원명 축약 로직을 `getCourtAbbrev()` 단일 함수로 통일

### Deliverables
1. CasesList.tsx에서 `shortenCourtName()` 함수 제거 및 `getCourtAbbrev()` 사용
2. client-preview 페이지들에서 hearing.court_name을 `getCourtAbbrev()`로 축약
3. 캘린더 관련 `shortenCourtLocation()` 중복 함수 정리

### Definition of Done
- [ ] CasesList.tsx에서 `shortenCourtName()` 함수 정의 삭제됨
- [ ] CasesList.tsx에서 `getCourtAbbrev` import 추가 및 사용
- [ ] client-preview 페이지들에서 법원명 축약 적용됨
- [ ] MonthlyCalendar.tsx, ScheduleListView.tsx에서 중복 함수 제거됨
- [ ] TypeScript 컴파일 에러 없음
- [ ] 시스템 전체에서 일관된 법원명 축약 형식 표시됨

---

## Guardrails

### MUST Have
- `getCourtAbbrev()`를 법원명 축약의 Single Source of Truth로 사용
- `shortenCourtLocation()`을 location(법정 정보 포함) 축약의 Single Source of Truth로 사용
- 대법원 API 관련 코드는 변경하지 않음 (정식명→코드 매핑 유지)

### MUST NOT Have
- court-codes.ts의 기존 함수 수정 (이미 잘 동작함)
- eventTransformers.ts의 공유 함수 수정
- 새로운 축약 로직 추가

---

## Task Flow

```
[Phase 1: CasesList.tsx 수정]
    Task 1.1: import 추가
    Task 1.2: 함수 호출 교체
    Task 1.3: 로컬 함수 삭제
        ↓
[Phase 2: client-preview 페이지 수정]
    Task 2.1: [clientId]/page.tsx 수정
    Task 2.2: [clientId]/cases/[caseId]/page.tsx 수정
        ↓
[Phase 3: 캘린더 중복 함수 정리]
    Task 3.1: MonthlyCalendar.tsx 중복 함수 제거
    Task 3.2: ScheduleListView.tsx 중복 함수 제거
        ↓
[Phase 4: 검증]
    Task 4.1: TypeScript 컴파일 검사
    Task 4.2: 린트 검사
    Task 4.3: 기능 테스트
```

---

## Detailed TODOs

## Phase 1: CasesList.tsx 수정

### Task 1.1: getCourtAbbrev import 추가
**File:** `/Users/hskim/luseed/components/CasesList.tsx`

**Action:**
- 파일 상단에 `getCourtAbbrev` import 추가

**Acceptance Criteria:**
- `import { getCourtAbbrev } from '@/lib/scourt/court-codes'` 형태로 추가됨

---

### Task 1.2: shortenCourtName 호출을 getCourtAbbrev로 교체
**File:** `/Users/hskim/luseed/components/CasesList.tsx`

**Changes:**
1. **Line 258:** `{shortenCourtName(item.court_name) || '-'}` → `{getCourtAbbrev(item.court_name) || '-'}`
2. **Line 610:** `{shortenCourtName(legalCase.court_name)}` → `{getCourtAbbrev(legalCase.court_name)}`

**Note:**
- **반환값 차이**: `shortenCourtName()`은 null 반환, `getCourtAbbrev()`는 빈 문자열 `''` 반환
- fallback `|| '-'`가 두 경우 모두 처리하므로 기능적 차이 없음
- 빈 문자열도 falsy이므로 `|| '-'`로 정상 처리됨

**Acceptance Criteria:**
- 두 곳 모두 교체됨

---

### Task 1.3: shortenCourtName 함수 정의 삭제
**File:** `/Users/hskim/luseed/components/CasesList.tsx`

**Action:**
- Line 655-663의 `shortenCourtName` 함수 정의 전체 삭제

```typescript
// 삭제할 코드 (Line 655-663)
function shortenCourtName(name: string | null): string | null {
  if (!name) return null
  return name
    .replace('지방법원', '지법')
    .replace('고등법원', '고법')
    .replace('대법원', '대법')
    .replace('가정법원', '가법')
    .replace('행정법원', '행법')
}
```

**Acceptance Criteria:**
- 함수 정의가 완전히 삭제됨

---

## Phase 2: client-preview 페이지 수정

### Task 2.1: [clientId]/page.tsx에 법원명 축약 적용
**File:** `/Users/hskim/luseed/app/admin/client-preview/[clientId]/page.tsx`

**Actions:**
1. `getCourtAbbrev` import 추가
2. 3곳의 직접 표시를 축약 형식으로 변경:
   - **Line 466:** `{primaryCaseHearings[0]?.court_name || '-'}` → `{getCourtAbbrev(primaryCaseHearings[0]?.court_name) || '-'}`
   - **Line 552:** `{hearing.court_name || '장소 미정'}` → `{getCourtAbbrev(hearing.court_name) || '장소 미정'}`
   - **Line 803:** `{selectedHearing.court_name || '-'}` → `{getCourtAbbrev(selectedHearing.court_name) || '-'}`

**Acceptance Criteria:**
- import 추가됨
- 3곳 모두 축약 적용됨

---

### Task 2.2: [clientId]/cases/[caseId]/page.tsx에 법원명 축약 적용
**File:** `/Users/hskim/luseed/app/admin/client-preview/[clientId]/cases/[caseId]/page.tsx`

**Actions:**
1. `getCourtAbbrev` import 추가
2. 3곳의 직접 표시를 축약 형식으로 변경:
   - **Line 271:** `{hearing.court_name || '장소 미정'}` → `{getCourtAbbrev(hearing.court_name) || '장소 미정'}`
   - **Line 297:** `{hearing.court_name || '-'}` → `{getCourtAbbrev(hearing.court_name) || '-'}`
   - **Line 400:** `{selectedHearing.court_name || '-'}` → `{getCourtAbbrev(selectedHearing.court_name) || '-'}`

**Acceptance Criteria:**
- import 추가됨
- 3곳 모두 축약 적용됨

---

## Phase 3: 캘린더 중복 함수 정리

### Task 3.1: MonthlyCalendar.tsx 중복 함수 제거
**File:** `/Users/hskim/luseed/components/MonthlyCalendar.tsx`

**Actions:**
1. `shortenCourtLocation` import 추가 (from `@/components/calendar/utils/eventTransformers`)
2. Line 397-430의 로컬 `shortenCourtLocation()` 함수 정의 삭제

**Note:**
- 검증 완료: 로컬 함수와 공유 함수(eventTransformers.ts)의 로직이 동일함
- 동일한 정규식 패턴 사용: 지원명 추출, 고등법원→고법, 가정법원→가정, 지방법원→지법

**Acceptance Criteria:**
- 로컬 함수 정의 삭제됨
- import로 교체됨
- 기존 동작 유지됨

---

### Task 3.2: ScheduleListView.tsx 중복 함수 제거
**File:** `/Users/hskim/luseed/components/ScheduleListView.tsx`

**Actions:**
1. `shortenCourtLocation` import 추가 (from `@/components/calendar/utils/eventTransformers`)
2. Line 85-113의 로컬 `shortenCourtLocation()` 함수 정의 삭제

**Acceptance Criteria:**
- 로컬 함수 정의 삭제됨
- import로 교체됨
- 기존 동작 유지됨

---

## Phase 4: 검증

### Task 4.1: TypeScript 컴파일 검사
**Command:** `npx tsc --noEmit`

**Acceptance Criteria:**
- 컴파일 에러 없음

---

### Task 4.2: 린트 검사
**Command:** `npm run lint`

**Acceptance Criteria:**
- 린트 에러 없음

---

### Task 4.3: 기능 테스트
**Test Cases:**
1. `/cases` 페이지에서 법원명이 축약형으로 표시 확인
2. `/admin/client-preview/[id]` 페이지에서 법원명이 축약형으로 표시 확인
3. `/admin/client-preview/[id]/cases/[caseId]` 페이지에서 법원명이 축약형으로 표시 확인
4. 캘린더에서 법정 정보가 정상 표시 확인

**Acceptance Criteria:**
- 모든 페이지에서 일관된 축약 형식 표시
- 기능 정상 동작

---

## Commit Strategy

**Commit 1: CasesList 수정**
```
refactor: CasesList 법원명 축약을 getCourtAbbrev()로 통일

- shortenCourtName() 로컬 함수 제거
- court-codes.ts의 getCourtAbbrev()로 교체

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Commit 2: client-preview 수정**
```
refactor: client-preview 페이지 법원명 축약 적용

- getCourtAbbrev()로 법원명 축약 통일
- 6곳의 직접 표시를 축약형으로 변경

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Commit 3: 캘린더 중복 함수 정리**
```
refactor: 캘린더 shortenCourtLocation 중복 함수 제거

- MonthlyCalendar.tsx, ScheduleListView.tsx 로컬 함수 제거
- eventTransformers.ts의 공유 함수로 통일

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Success Criteria

| Criteria | Verification |
|----------|--------------|
| 코드 일관성 | 프로젝트 전체에서 `shortenCourtName` 검색 결과 0건 |
| 중복 제거 | `shortenCourtLocation` 정의가 1곳(eventTransformers.ts)에만 존재 |
| 빌드 성공 | `npx tsc --noEmit` 통과 |
| 린트 통과 | `npm run lint` 통과 |
| 기능 동작 | 모든 페이지에서 법원명이 일관된 축약형으로 표시 |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| getCourtAbbrev 반환값 형식 차이 | 낮음 | 낮음 | 이미 18개 파일에서 사용 중이므로 검증됨 |
| null 처리 차이 | 낮음 | 낮음 | getCourtAbbrev는 빈 문자열 반환, fallback으로 처리 |
| shortenCourtLocation 로직 차이 | 없음 | 없음 | 검증 완료: 3개 파일의 로직이 동일함 (정규식 패턴 일치) |

---

## Files to Modify

| File | Action |
|------|--------|
| `/Users/hskim/luseed/components/CasesList.tsx` | import 추가, 함수 호출 교체, 로컬 함수 삭제 |
| `/Users/hskim/luseed/app/admin/client-preview/[clientId]/page.tsx` | import 추가, 3곳 축약 적용 |
| `/Users/hskim/luseed/app/admin/client-preview/[clientId]/cases/[caseId]/page.tsx` | import 추가, 3곳 축약 적용 |
| `/Users/hskim/luseed/components/MonthlyCalendar.tsx` | import 추가, 로컬 함수 삭제 |
| `/Users/hskim/luseed/components/ScheduleListView.tsx` | import 추가, 로컬 함수 삭제 |

**Total: 5 files**
