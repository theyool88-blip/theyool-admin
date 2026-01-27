# 당사자 이름 Fallback 로직 제거

## 개요

사건상세 페이지에서 당사자 이름 표시 시 복잡한 fallback 로직을 제거하고, DB에 저장된 `party_name`을 그대로 표시하도록 단순화.

## 문제

### 증상
- 피고가 여러 명(1. 피고, 2. 피고)일 때
- 한 명의 이름만 수정하면 모든 피고에 동일한 이름이 표시됨

### 원인
`displayCaseParties` useMemo의 복잡한 fallback 로직 (~100줄):

```typescript
// Before: 복잡한 fallback 로직
const displayCaseParties = useMemo(() => {
  // 1순위: caseData.client?.name
  // 2순위: caseClients에서 primary client 이름
  // 3순위: caseClients의 첫 번째 클라이언트
  // ... linked_party_id, is_primary, client_role 등으로 fallback 시도
  // 마스킹된 당사자에 의뢰인 이름 자동 적용
}, [casePartiesWithPending, caseData.client?.name, caseData.client_role, caseClients]);
```

**문제 발생 흐름:**
1. 피고 1을 "김철수"로 수정 (DB에 저장됨)
2. 피고 1은 실명이므로 스킵됨
3. 하지만 `usedClientFallback` 플래그가 설정되지 않음
4. 피고 2(마스킹)에 fallback 로직 적용
5. 의뢰인 이름 = 피고 1 이름 → 피고 2도 "김철수"로 표시

## 해결

### B안 채택: Fallback 로직 완전 제거

```typescript
// After: 단순화 (3줄)
const displayCaseParties = useMemo(() => {
  return casePartiesWithPending;
}, [casePartiesWithPending]);
```

### 변경 사항
- **파일**: `components/CaseDetail.tsx`
- **변경**: `displayCaseParties` useMemo 단순화 (~100줄 → 3줄)
- **원칙**: DB에 저장된 `party_name` 그대로 표시

## 관련 파일

| 파일 | 역할 |
|------|------|
| `components/CaseDetail.tsx` | 당사자 표시 로직 (변경됨) |
| `components/CasePartiesSection.tsx` | 당사자 수정 UI |
| `app/api/admin/cases/[id]/parties/route.ts` | 당사자 CRUD API |
| `lib/scourt/party-sync.ts` | SCOURT 당사자 동기화 |

## 데이터 흐름

```
SCOURT API → party_name 저장 (마스킹된 이름 포함)
    ↓
사용자 수정 → PATCH API → 개별 party_name 업데이트
    ↓
caseParties → casePartiesWithPending → displayCaseParties (단순 전달)
    ↓
casePartiesForDisplay → UI 렌더링
```

## 커밋

```
34827e3 fix: 당사자 이름 fallback 로직 제거
```

## 날짜

2026-01-27
