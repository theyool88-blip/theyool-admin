# 사건 목록 상대방 추출 로직 버그 수정

## 개요
`/cases` 사건 목록 페이지에서 상대방이 의뢰인과 동일인으로 표시되던 버그를 수정했습니다.

## 문제점

### 증상
- 사건 목록에서 "의뢰인: 정정희", "상대방: 정정희"와 같이 동일인으로 표시됨
- 실제 상대방(피고)이 표시되지 않음

### 원인
레거시 데이터(case_clients가 없는 데이터)에서 상대방을 찾는 Fallback 로직이 잘못됨:

```typescript
// 잘못된 로직
const opponentParty = parties.find((p) => !p.is_primary)
```

**문제**: `is_primary`는 "해당 유형(원고/피고)의 대표 당사자"를 의미하며, "의뢰인 여부"가 아님.
- 예: 원고가 3명이면, 대표 원고 1명만 `is_primary: true`
- 레거시 데이터에서는 모든 당사자의 `is_primary`가 `false`일 수 있음
- 이 경우 `!p.is_primary`가 모든 당사자에게 true가 되어 첫 번째 당사자(의뢰인)가 상대방으로 선택됨

## 수정 내용

### 변경된 로직
```typescript
// 올바른 로직: 의뢰인명과 다른 당사자를 상대방으로
const opponentParty = parties.find((p) =>
  p.party_name !== ourClientName
)
```

### 수정 파일
- `/app/cases/page.tsx` (라인 72-75)

### 코드 정리
- 불필요한 인터페이스 제거 (77줄 → 50줄)
- spread 연산자로 필드 전달 방식 단순화

## 검증 결과

### 데이터 흐름 검증
```
사건번호: 2025드단20616
  의뢰인: 정정희 (라벨없음)
  상대방: 김윤길 (피고) ✅

사건번호: 2024드단26718
  의뢰인: 김윤한 (라벨없음)
  상대방: 김진희 (피고) ✅
```

### 검증 항목
| 항목 | 결과 |
|------|------|
| TypeScript 빌드 | ✅ PASSED |
| ESLint | ✅ PASSED |
| 데이터 흐름 | ✅ PASSED |
| Architect 승인 | ✅ APPROVED |

## 관련 스키마

### 당사자 식별 우선순위
1. **case_clients.is_primary_client** → `linked_party_id`로 의뢰인 당사자 식별
2. **의뢰인의 party_type** (plaintiff/defendant) → 반대 타입이 상대방
3. **Fallback (레거시)**: `primary_client_name`과 다른 당사자명을 가진 당사자가 상대방

### 관련 테이블
- `case_parties`: 사건 당사자 정보 (party_name, party_type, is_primary)
- `case_clients`: 의뢰인-당사자 연결 (client_id, linked_party_id, is_primary_client)
- `legal_cases.primary_client_name`: 의뢰인명 캐시 필드

## 날짜
- 수정일: 2026-01-28
- 커밋: `fix: 사건 목록 상대방 추출 로직 버그 수정 및 코드 정리`
