# 사건 상세 당사자 마스킹 해제 수정

## 개요

사건 상세 페이지에서 당사자 이름이 마스킹된 상태("유OO", "조OO")로 표시되던 버그를 수정했습니다.

## 수정된 버그

### 1. Hero 섹션 "의뢰인" 표시 안됨
- **증상**: Hero 섹션에서 의뢰인 측 당사자에 "의뢰인" 배지가 표시되지 않음
- **원인**: `client_role` 컬럼이 스키마에서 제거되었고, `case_clients.linked_party_id`가 활용되지 않음
- **해결**: `caseClients` 데이터를 활용하여 의뢰인 측 판단 로직 개선

### 2. "당사자내용" 테이블 마스킹 유지
- **증상**: 일반 탭의 "당사자내용" 테이블에서 이름이 "1. 유OO", "1. 조OO"로 표시됨
- **원인**: `scourt_party_index`가 설정되지 않아 매칭 실패
- **해결**: label 기반 fallback 매칭 로직 추가

## 변경된 파일

### components/CaseDetail.tsx

```typescript
// resolvedClientName memo 추가
const resolvedClientName = useMemo(() => {
  // 1순위: caseData.client?.name (캐시된 값)
  let name = caseData.client?.name?.trim() || "";

  // 2순위: caseClients에서 primary client의 이름
  if (!name || isMaskedPartyName(name)) {
    const primaryCaseClient = caseClients.find(cc => cc.is_primary_client);
    if (primaryCaseClient?.client?.name) {
      name = primaryCaseClient.client.name.trim();
    }
  }

  // 3순위: caseClients의 첫 번째 클라이언트
  if (!name || isMaskedPartyName(name)) {
    const firstCaseClient = caseClients.find(cc => cc.client?.name);
    if (firstCaseClient?.client?.name) {
      name = firstCaseClient.client.name.trim();
    }
  }

  return name && !isMaskedPartyName(name) ? name : undefined;
}, [caseData.client?.name, caseClients]);
```

### components/scourt/ScourtGeneralInfoXml.tsx

`substitutePartyListNames` 함수에 3단계 fallback 추가:

| 우선순위 | 조건 | 동작 |
|----------|------|------|
| 1순위 | `scourt_party_index` 일치 | 기존 로직 (resolveCasePartyName) |
| 2순위 | `partiesByIndex.size === 0` | 라벨 기반 측(원고/피고) 매칭 |
| 3순위 | 매칭 실패 + clientName/clientSide 존재 | 측이 일치하면 직접 치환 |

### components/case/CaseHeroSection.tsx

의뢰인 측(`isClientSide`) 판단 로직:

1. `primaryParties.clientSide` (case_clients.linked_party_id 반영)
2. `caseClients`의 `linked_party_id`로 당사자 찾기
3. `is_primary` 플래그
4. `client_role` (레거시)

## 데이터 흐름

```
API: /api/admin/cases/[id]/parties
    ↓
caseClients 상태 (case_clients + clients 조인)
    ↓
resolvedClientName memo (의뢰인 이름 추출)
    ↓
ScourtGeneralInfoXml
    ↓
substitutePartyListNames (마스킹 해제)
    ↓
당사자내용 테이블 렌더링
```

## Edge Cases

### 부분적 scourt_party_index 설정
- **상황**: 일부 당사자만 `scourt_party_index`가 설정된 경우
- **처리**: 3순위 fallback (clientName/clientSide 직접 치환)으로 완화

## 관련 커밋

- `988baa3`: fix: 사건 상세 당사자 마스킹 해제 및 UI 개선

## 테스트 방법

1. 사건 상세 페이지 접속
2. Hero 섹션에서 "의뢰인 [측]" 표시 확인
3. "일반" 탭 클릭
4. "당사자내용" 테이블에서 마스킹 해제된 이름 확인
