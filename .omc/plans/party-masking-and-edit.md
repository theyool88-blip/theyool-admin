# 당사자 마스킹 해제 및 일반탭 수정 기능 수정 계획 (v2)

## 문제 요약

### 문제 1: 당사자 이름 마스킹이 여전히 표시됨
- 이전 수정에서 `fetchCaseParties()` 호출을 추가했으나 효과 없음
- **근본 원인**: `substitutePartyListNames()` 함수의 fallback 조건 버그

### 문제 2: 일반탭에서 당사자 이름 수정 기능이 없음
- **근본 원인**: `findMatchingParty()` 함수가 `scourt_party_index`만 사용하여 매칭

---

## 근본 원인 분석 (Critic 피드백 반영)

### 핵심 버그 발견

**파일: `components/scourt/ScourtGeneralInfoXml.tsx:536`**

```typescript
if (!matchedParty && partiesByIndex.size === 0) {
```

**문제점**: 이 조건은 **모든 당사자**가 `scourt_party_index`가 없을 때만 fallback 매칭을 시도함.

**시나리오 예시**:
- 당사자 A: `scourt_party_index = 0` (SCOURT 동기화됨)
- 당사자 B: `scourt_party_index = null` (수동 추가됨)

이 경우 `partiesByIndex.size = 1`이므로 당사자 B에 대한 fallback 매칭이 **절대 실행되지 않음**.

### `scourt_party_index`가 null인 경우

1. **수동으로 추가된 당사자**: `buildManualPartySeeds()`로 생성
2. **복사된 당사자**: 소스 사건에서 복사 시
3. **SCOURT 동기화 전**: 초기 생성된 당사자

`scourt_party_index`는 **SCOURT 동기화 시에만** 설정됨 (`lib/scourt/party-sync.ts:160, 372`)

---

## 수정 계획

### 수정 1: `substitutePartyListNames()` 조건 수정

**파일: `components/scourt/ScourtGeneralInfoXml.tsx:536`**

```typescript
// 변경 전:
if (!matchedParty && partiesByIndex.size === 0) {

// 변경 후:
if (!matchedParty) {
```

**이유**: 각 행에서 `scourt_party_index` 매칭 실패 시 **항상** fallback 매칭을 시도해야 함.

### 수정 2: `findMatchingParty()` fallback 매칭 추가

**파일: `components/scourt/ScourtGeneralInfoXml.tsx:1223-1231`**

```typescript
function findMatchingParty(
  row: Record<string, unknown>,
  rowIndex: number,
  caseParties?: CasePartyInfo[]
): CasePartyInfo | null {
  if (!caseParties || caseParties.length === 0) return null;

  // 1순위: scourt_party_index 매칭
  const indexMatch = caseParties.find(p => p.scourt_party_index === rowIndex);
  if (indexMatch) return indexMatch;

  // 2순위: 라벨 기반 측 매칭 + party_order 우선순위
  const rowLabel = getPartyRowLabel(row);
  const normalizedLabel = normalizePartyLabel(rowLabel);
  const rowSide = getSideFromLabel(normalizedLabel);

  if (rowSide) {
    // 같은 측의 당사자들 필터링
    const sideParties = caseParties.filter(p => {
      const partyLabel = normalizePartyLabel(
        p.scourt_label_raw || p.party_type_label || ''
      );
      const partySide = getSideFromLabel(partyLabel) || getPartySide(p.party_type as PartyType);
      return partySide === rowSide;
    });

    if (sideParties.length > 0) {
      // is_primary 우선, 그 다음 party_order 순
      const sorted = [...sideParties].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return 0;
      });
      return sorted[0];
    }
  }

  // 매칭 실패 시 null 반환 (잘못된 party_type 반환 방지)
  return null;
}
```

**변경점**:
- 3순위 `caseParties[rowIndex]` fallback 제거 (잘못된 party_type 반환 가능)
- 라벨 기반 측 매칭 + `is_primary` 우선순위 적용

---

## 검증 계획

### 테스트 시나리오

| 시나리오 | 설명 | 예상 결과 |
|---------|------|----------|
| 0 SCOURT 동기화 | 모든 당사자 `scourt_party_index = null` | label 기반 fallback 매칭으로 마스킹 해제 + 편집 가능 |
| 부분 동기화 | 일부만 index 있음 | index 있는 것은 정확 매칭, 없는 것은 fallback |
| 동일 라벨 다수 | 원고 1, 원고 2 등 | `is_primary` 우선, 그 다음 첫 번째 |

### 검증 단계

1. TypeScript 빌드 통과 확인
2. 개발 서버에서 실제 사건 페이지 로드
3. 콘솔 로그로 fallback 매칭 경로 확인
4. 편집 버튼 표시 확인
5. 편집 → 저장 → 새로고침 후 반영 확인

---

## 파일 수정 목록

| 파일 | 라인 | 수정 내용 |
|------|------|----------|
| `components/scourt/ScourtGeneralInfoXml.tsx` | 536 | `partiesByIndex.size === 0` 조건 제거 |
| `components/scourt/ScourtGeneralInfoXml.tsx` | 1223-1231 | `findMatchingParty()` fallback 로직 추가 |

---

## Critic 피드백 대응

| 피드백 | 대응 |
|--------|------|
| 536번 줄 조건 버그 명시 필요 | ✅ 추가됨 |
| `scourt_party_index` null 케이스 설명 | ✅ 추가됨 |
| fallback 알고리즘 구체화 | ✅ `is_primary` + label 기반 매칭 명시 |
| 3순위 fallback 위험성 | ✅ 제거됨 (null 반환) |
| 테스트 시나리오 추가 | ✅ 3가지 시나리오 명시 |
