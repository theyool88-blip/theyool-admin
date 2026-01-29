# 당사자 마스킹 문제 분석 및 수정 계획 (v2 - Critic 피드백 반영)

## 문제 요약

**증상**: 사건상세 히어로와 "일반" 탭에서 사용자가 입력한 당사자의 마스킹이 풀리지 않음

---

## Critic 피드백 반영

### 기존 계획의 오류

1. **`isMaskedPartyName()` 함수는 정상 동작함**
   - 순수 한글 이름 "홍길동"은 마스킹 토큰(○●*)이 없어 line 375에서 `false` 반환
   - 따라서 함수 자체는 문제 아님

2. **SCOURT 동기화 시 `manual_override: true`는 이미 보호됨**
   - `lib/scourt/party-sync.ts:335-337`:
     ```typescript
     const shouldPreserveName =
       (legacyOverride?.manual_override || existingParty?.manual_override || false) ||
       (!!candidateName && !isMaskedPartyName(candidateName));
     ```
   - `manual_override=true`이거나 마스킹되지 않은 이름이면 보존됨

3. **PATCH API는 이미 `manual_override: true` 설정함**
   - `app/api/admin/cases/[id]/parties/route.ts:22`:
     ```typescript
     const payload = { manual_override: true, ... }
     ```

### 누락된 분석

1. **실제 DB 저장값 확인 없음** - 경험적 증거 부족
2. **React 상태 관리 검토 없음** - caching, stale closure, race condition
3. **UI 업데이트 확인 없음** - PATCH 후 상태 반영 여부

---

## 코드 분석 결과

### 데이터 흐름

```
PATCH API 호출
  ↓
setCaseParties() 낙관적 업데이트 (line 813-818)
  ↓
casePartiesWithPending (useMemo, line 708)
  ↓
displayCaseParties (useMemo, line 1447)
  ↓
casePartiesForDisplay (useMemo, line 1451)
  ↓
resolveCasePartyName() (line 2214-2226)
  ↓
히어로/일반 탭 렌더링
```

### PATCH 응답 후 상태 업데이트 로직

**CaseDetail.tsx:810-818**:
```typescript
if (res.ok) {
  const responseData = await res.json();
  // 낙관적 업데이트: 서버 응답으로 직접 상태 갱신 (fetchCaseParties 대신)
  if (responseData.data) {
    setCaseParties((prev) =>
      prev.map((p) =>
        p.id === partyId ? { ...p, ...responseData.data } : p,
      ),
    );
  }
  ...
}
```

**잠재적 문제점**:
1. `responseData.data`가 없으면 상태 업데이트 안됨
2. 서버 응답 구조가 `{ data: {...} }`가 아니면 실패
3. `fetchCaseParties()`가 명시적으로 호출되지 않아 전체 데이터 재조회 없음

### 당사자 이름 해석 로직 (resolveCasePartyName)

**CaseDetail.tsx:2214-2226**:
```typescript
const resolveCasePartyName = (party) => {
  // 1순위: linked_party_id로 연결된 의뢰인 이름
  const clientName = party.clients?.name?.trim();
  if (clientName && !isMaskedPartyName(clientName))
    return removeNumberPrefix(clientName);

  // 2순위: party_name (마스킹 안된 경우)
  const partyName = party.party_name?.trim();
  if (partyName && !isMaskedPartyName(partyName))
    return removeNumberPrefix(partyName);

  return null;
};
```

**분석**:
- 1순위(`party.clients`)가 없으면 2순위(`party_name`)로 충분히 해결 가능
- 2순위 실패 조건: `party_name`이 비어있거나 마스킹으로 판단되는 경우
- 사용자가 실명 입력 시 2순위로 해결되어야 함

---

## Phase 0: 사전 조건 - 원인 확정 (MANDATORY)

**목표**: 경험적 증거를 통해 실제 원인 파악

### Task 0.1: DB 데이터 직접 조회

**파일**: `scripts/debug-party-masking.ts`

```typescript
// 특정 사건 ID로 당사자 데이터 조회
// 확인 항목:
// 1. party_name 실제 저장값
// 2. manual_override 값
// 3. scourt_name_raw vs party_name 비교
// 4. linked_party_id 연결 상태
```

**수행 방법**:
```bash
npx tsx scripts/debug-party-masking.ts <case_id>
```

**예상 출력**:
```
Party ID: xxx
  party_name: "홍길동" (expected) or "홍○동" (problem)
  manual_override: true
  scourt_name_raw: "1. 홍○동"
  linked_party_id: null
```

**판단 기준**:
- `party_name = "홍○동"` → 저장 문제 (PATCH API 또는 동기화 문제)
- `party_name = "홍길동"` → UI 렌더링 문제 (React 상태 문제)

### Task 0.2: PATCH 전/후 값 비교 (Console 로깅)

**임시 수정 위치**: `CaseDetail.tsx:handleSavePartyFromGeneral`

```typescript
console.log("[PATCH 요청] partyId:", partyId, "newPartyName:", newPartyName);
console.log("[PATCH 응답]", responseData);
console.log("[상태 업데이트 후] caseParties:", caseParties);
```

**확인 사항**:
- PATCH 요청 body에 올바른 `party_name` 전송 여부
- 서버 응답에 `data` 필드 존재 여부
- 상태 업데이트 후 `caseParties` 배열의 해당 party 값

### Task 0.3: React 상태 업데이트 검증

**확인 방법**: React DevTools에서 `CaseDetail` 컴포넌트 상태 확인

**확인 항목**:
1. `caseParties` 상태가 PATCH 후 업데이트되는가?
2. `casePartiesWithPending` memo가 재계산되는가?
3. `casePartiesForDisplay` memo가 재계산되는가?

---

## Phase 1: 문제 유형별 수정

### 유형 A: PATCH 후 상태 업데이트 누락

**증상**: DB에는 저장되지만 UI에 반영 안됨

**원인 가능성**:
1. `responseData.data`가 undefined
2. 서버 응답 구조 불일치

**수정 방안**:

**Task 1.1: PATCH 응답 구조 확인 및 수정**

**파일**: `app/api/admin/cases/[id]/parties/route.ts`

```typescript
// 현재 응답
return NextResponse.json({ data: updatedParty });

// 확인 사항:
// 1. updatedParty에 모든 필요 필드 포함?
// 2. 응답 구조가 { data: {...} } 형식인가?
```

**Task 1.2: fetchCaseParties 명시적 호출 추가**

**파일**: `CaseDetail.tsx:handleSavePartyFromGeneral`

```typescript
if (res.ok) {
  const responseData = await res.json();
  // 기존 낙관적 업데이트 유지
  if (responseData.data) {
    setCaseParties(prev => prev.map(p =>
      p.id === partyId ? { ...p, ...responseData.data } : p
    ));
  } else {
    // fallback: 전체 재조회
    await fetchCaseParties();
  }
}
```

### 유형 B: linked_party_id 연결 없음으로 1순위 실패

**증상**: 의뢰인 연결 없이 당사자 이름만 수정한 경우

**분석**:
- 1순위(`party.clients?.name`)가 없으면 2순위(`party.party_name`)로 폴백
- 2순위가 정상 작동하면 문제 없음
- 2순위 실패 시에만 문제

**수정 방안**: 2순위 강화 (Phase 0 결과에 따라)

**Task 1.3: resolveCasePartyName 디버깅 로그 추가**

```typescript
const resolveCasePartyName = (party) => {
  console.log("[resolveCasePartyName] party:", party.id, {
    clientName: party.clients?.name,
    partyName: party.party_name,
    isMaskedClient: party.clients?.name ? isMaskedPartyName(party.clients.name) : 'N/A',
    isMaskedParty: party.party_name ? isMaskedPartyName(party.party_name) : 'N/A',
  });
  // ... 기존 로직
};
```

### 유형 C: SCOURT 동기화 시 덮어쓰기

**증상**: 수정 후 SCOURT 동기화하면 마스킹 이름으로 복구됨

**현재 보호 로직 검증**:

**파일**: `lib/scourt/party-sync.ts:335-341`

```typescript
const shouldPreserveName =
  (legacyOverride?.manual_override || existingParty?.manual_override || false) ||
  (!!candidateName && !isMaskedPartyName(candidateName));

const resolvedName = shouldPreserveName && candidateName
  ? preservePrefix(scourtName, candidateName)
  : scourtName;
```

**확인 사항**:
1. `existingParty.manual_override`가 실제로 `true`로 조회되는가?
2. `shouldPreserveName`이 `true`로 평가되는가?
3. `resolvedName`에 올바른 값이 할당되는가?

**수정 방안** (필요 시):

**Task 1.4: party-sync.ts 디버깅 로그 추가**

```typescript
console.log("[party-sync] party index:", i, {
  existingManualOverride: existingParty?.manual_override,
  candidateName,
  shouldPreserveName,
  resolvedName,
});
```

---

## Phase 2: 검증

### Task 2.1: 단위 테스트 - isMaskedPartyName

**파일**: `__tests__/party-masking.test.ts`

```typescript
describe('isMaskedPartyName', () => {
  it('returns false for plain Korean name', () => {
    expect(isMaskedPartyName('홍길동')).toBe(false);
    expect(isMaskedPartyName('김철수')).toBe(false);
  });

  it('returns true for masked name with token', () => {
    expect(isMaskedPartyName('홍○동')).toBe(true);
    expect(isMaskedPartyName('김●수')).toBe(true);
  });

  it('returns true for pattern-masked name', () => {
    expect(isMaskedPartyName('갑')).toBe(true);  // 현재 false 반환 - r2 버전과 다름
    expect(isMaskedPartyName('원고1')).toBe(true); // 현재 false 반환
  });

  it('handles number prefix', () => {
    expect(isMaskedPartyName('1. 홍○동')).toBe(true);
    expect(isMaskedPartyName('1. 홍길동')).toBe(false);
  });
});
```

### Task 2.2: E2E 시나리오 테스트

**테스트 시나리오**:

1. **기본 수정 테스트**:
   - 사건 상세 페이지 접속
   - 당사자 이름 수정 ("홍○동" → "홍길동")
   - 저장 클릭
   - 히어로 영역 확인 (즉시 반영 여부)
   - 일반 탭 확인

2. **새로고침 후 유지 테스트**:
   - 위 수정 후 페이지 새로고침
   - 히어로 영역 확인 (저장 유지 여부)
   - 일반 탭 확인

3. **SCOURT 동기화 후 유지 테스트**:
   - 위 수정 후 SCOURT 재동기화
   - 히어로 영역 확인 (보호 여부)
   - 일반 탭 확인

---

## 파일 변경 목록

| 파일 | 변경 내용 | 우선순위 |
|------|-----------|----------|
| `scripts/debug-party-masking.ts` | 디버깅 스크립트 신규 | Phase 0 |
| `CaseDetail.tsx` | PATCH 후 fetchCaseParties fallback | Phase 1 (유형 A) |
| `CaseDetail.tsx` | 디버깅 로그 추가 (임시) | Phase 0 |
| `lib/scourt/party-sync.ts` | 디버깅 로그 추가 (임시) | Phase 0 |
| `types/case-party.ts` | isMaskedPartyName 개선 (필요 시) | Phase 1 (유형 C) |
| `__tests__/party-masking.test.ts` | 단위 테스트 | Phase 2 |

---

## 의사결정 트리

```
Phase 0 결과
  ├─ DB에 마스킹 이름 저장됨
  │    ├─ PATCH 직후 → PATCH API 응답 문제 (Task 1.1)
  │    └─ SCOURT 동기화 후 → 동기화 보호 실패 (Task 1.4)
  │
  └─ DB에 실명 저장됨
       ├─ UI에 마스킹 표시 → React 상태 문제 (Task 1.2)
       └─ UI에도 실명 표시 → 문제 재현 불가 (환경 차이)
```

---

## 성공 기준

1. **즉시 반영**: 당사자 이름 수정 → 저장 → 히어로/일반 탭에 실명 표시
2. **영구 유지**: 페이지 새로고침 후에도 실명 유지
3. **동기화 보호**: SCOURT 재동기화 후에도 실명 유지
4. **기존 동작 유지**: 마스킹된 이름(홍○동, 김●수)은 여전히 마스킹으로 판단

---

## 실행 순서

1. **Phase 0 완료** (필수)
   - Task 0.1, 0.2, 0.3 실행하여 원인 확정

2. **Phase 1 실행** (원인에 따라 선택)
   - 의사결정 트리에 따라 해당 Task 실행

3. **Phase 2 실행**
   - 수정 후 검증 테스트

---

## 리스크

1. **Phase 0 결과에 따라 계획 변경 필요**: 원인이 예상과 다를 수 있음
2. **임시 로깅 코드 제거 필요**: 디버깅 로그는 검증 후 제거해야 함
3. **r2 버전 isMaskedPartyName 불일치**: 두 함수의 로직이 달라 통합 필요할 수 있음
