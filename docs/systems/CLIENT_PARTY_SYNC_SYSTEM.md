# 의뢰인/당사자 동기화 시스템

**Last Updated**: 2026-01-13

## 개요

의뢰인(clients) 정보와 당사자(case_parties) 정보 간의 데이터 일관성을 유지하는 시스템입니다.

## 데이터 구조

### 테이블 관계

```
clients (의뢰인 마스터)
    ↓ client_id (FK)
legal_cases (사건 정보)
    ↓ case_id (FK)
case_parties (당사자 상세)
    ↑ client_id (FK) → clients
```

### 주요 필드

| 테이블 | 필드 | 용도 |
|--------|------|------|
| `clients` | name | 의뢰인 이름 |
| `legal_cases` | client_id | 의뢰인 FK |
| `legal_cases` | opponent_name | 상대방 이름 |
| `legal_cases` | client_role | 의뢰인 지위 (plaintiff/defendant) |
| `case_parties` | party_name | 당사자 이름 |
| `case_parties` | is_our_client | 의뢰인 여부 |
| `case_parties` | client_id | 의뢰인 FK |
| `case_parties` | manual_override | 수동 수정 여부 (보호 플래그) |

---

## API 엔드포인트

### 1. 의뢰인 수정 API

**경로:** `PATCH /api/admin/clients/[id]`

**파일:** `app/api/admin/clients/[id]/route.ts`

**동작:**
1. clients 테이블 업데이트
2. 이름 변경 시 case_parties 자동 동기화
   - `manual_override=false`인 당사자만 업데이트
   - 번호 prefix 보존 (예: "1. 홍길동" → "1. 김철수")

**요청 예시:**
```json
{
  "name": "김철수",
  "phone": "010-1234-5678",
  "email": "kim@example.com"
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": { "id": "...", "name": "김철수", ... },
  "syncedParties": 3
}
```

### 2. 사건 수정 API

**경로:** `PATCH /api/admin/cases/[id]`

**파일:** `app/api/admin/cases/[id]/route.ts`

**동작:**

#### opponent_name 변경 시
1. `is_our_client=false`, `manual_override=false`인 당사자 조회
2. party_name 업데이트 (번호 prefix 보존)

#### client_id 변경 시
1. 기존 의뢰인 당사자의 `is_our_client=false`, `client_id=null` 설정
2. 새 의뢰인 이름과 일치하는 당사자 검색
   - 있으면: `is_our_client=true`, `client_id` 설정
   - 없으면: 새 의뢰인 당사자 생성

### 3. 사건 생성 API

**경로:** `POST /api/admin/cases`

**파일:** `app/api/admin/cases/route.ts`

**동작:**
- `court_case_number` 또는 `client_role`이 있을 때 case_parties 자동 생성
- `buildManualPartySeeds` 함수로 당사자 지위 추론
  - 사건번호에서 사건유형 추출 (예: "2024드단1234" → 가사소송)
  - 사건유형별 당사자 라벨 결정 (원고/피고, 채권자/채무자 등)

---

## 보호 메커니즘

### manual_override 플래그

사용자가 직접 수정한 당사자는 자동 동기화에서 제외됩니다.

| 조건 | 동기화 |
|------|--------|
| `manual_override=false` | 자동 동기화됨 |
| `manual_override=true` | 보호됨 (동기화 제외) |

**설정 시점:**
- 당사자 직접 편집 (`PATCH /api/admin/cases/[id]/parties`) → `manual_override=true`
- 사건 생성 시 자동 생성 → `manual_override=false`
- SCOURT 동기화 → `manual_override=false`

### 번호 Prefix 보존

당사자 이름에 번호가 포함된 경우 보존됩니다:
- "1. 홍길동" → "1. 김철수" (prefix "1. " 유지)
- "홍길동" → "김철수" (prefix 없음)

---

## 데이터 흐름

### 시나리오 1: 의뢰인 이름 수정

```
ClientEditForm에서 이름 수정
    ↓
PATCH /api/admin/clients/[id]
    ↓
clients.name 업데이트
    ↓
이름 변경 감지
    ↓
case_parties에서 client_id 일치 + manual_override=false 조회
    ↓
각 당사자의 party_name 업데이트 (prefix 보존)
```

### 시나리오 2: 상대방 이름 수정

```
CaseEditForm에서 opponent_name 수정
    ↓
PATCH /api/admin/cases/[id]
    ↓
legal_cases.opponent_name 업데이트
    ↓
opponent_name 변경 감지
    ↓
case_parties에서 is_our_client=false + manual_override=false 조회
    ↓
각 당사자의 party_name 업데이트 (prefix 보존)
```

### 시나리오 3: 의뢰인 변경

```
CaseEditForm에서 다른 의뢰인 선택
    ↓
PATCH /api/admin/cases/[id]
    ↓
legal_cases.client_id 업데이트
    ↓
client_id 변경 감지
    ↓
기존 의뢰인 당사자: is_our_client=false, client_id=null
    ↓
새 의뢰인 이름으로 당사자 검색
    ├─ 있음 → is_our_client=true, client_id=새ID
    └─ 없음 → 새 당사자 생성
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `app/api/admin/clients/[id]/route.ts` | 의뢰인 CRUD + 동기화 |
| `app/api/admin/cases/[id]/route.ts` | 사건 수정 + 동기화 |
| `app/api/admin/cases/route.ts` | 사건 생성 + 당사자 자동 생성 |
| `app/api/admin/cases/[id]/parties/route.ts` | 당사자 직접 편집 |
| `components/ClientEditForm.tsx` | 의뢰인 수정 UI |
| `components/CaseEditForm.tsx` | 사건 수정 UI |
| `lib/case/party-seeds.ts` | 당사자 시드 생성 로직 |
| `lib/scourt/party-labels.ts` | 사건유형별 당사자 라벨 |

---

## 테스트 체크리스트

### 의뢰인 이름 수정
- [ ] ClientEditForm에서 의뢰인 이름 수정
- [ ] clients 테이블 업데이트 확인
- [ ] case_parties.party_name 동기화 확인
- [ ] manual_override=true인 당사자 보호 확인
- [ ] 번호 prefix 보존 확인

### 상대방 이름 수정
- [ ] CaseEditForm에서 opponent_name 수정
- [ ] legal_cases.opponent_name 업데이트 확인
- [ ] case_parties.party_name 동기화 확인

### 의뢰인 변경
- [ ] CaseEditForm에서 다른 의뢰인 선택
- [ ] 기존 의뢰인 당사자 is_our_client=false 확인
- [ ] 새 의뢰인 당사자 is_our_client=true 확인

---

## SCOURT 당사자 라벨 처리

### 핵심 원칙: SCOURT 라벨 원본 유지

**2026-01-10 업데이트**

SCOURT(나의사건검색) 데이터의 당사자 지위명(`party_type_label`)을 원본 그대로 사용합니다.
사건번호 기반 추론(`getPartyLabelsFromSchema`)으로 라벨을 변환하지 않습니다.

#### 적용 영역

| 영역 | 파일 | 라벨 소스 |
|------|------|-----------|
| 히어로 섹션 | `CaseDetail.tsx` | `party_type_label` 원본 |
| 일반탭 | `ScourtGeneralInfoXml.tsx` | `party_type_label` 원본 |
| 알림탭 당사자 | `CasePartiesSection.tsx` | `party_type_label` 원본 |

#### 예시

```
SCOURT 원본: 신청인 - 정OOO, 피신청인 - 성OOO
사건번호: 2024드단1234 (가사소송)

기존(오류): 원고 - 정OOO, 피고 - 성OOO (사건번호 기반 추론)
수정후: 신청인 - 정OOO, 피신청인 - 성OOO (SCOURT 원본 유지)
```

### 비의뢰인 당사자 유형 필터링

**파일:** `lib/scourt/party-sync.ts`

의뢰인 정보를 이전하면 안 되는 당사자 유형을 필터링합니다.

```typescript
const NON_CLIENT_PARTY_LABELS = [
  '사건본인', '제3자', '제3채무자', '참가인', '보조참가인', '증인', '감정인',
];

function isNonClientPartyLabel(label: string): boolean {
  return NON_CLIENT_PARTY_LABELS.some(l => label.includes(l));
}
```

#### 매칭 조건

SCOURT 당사자와 마이그레이션 당사자를 매칭할 때:

1. **비의뢰인 유형 체크**: `isNonClientPartyLabel()` → true이면 의뢰인 정보 이전 제외
2. **party_type 호환성 체크**: `isCompatiblePartyType()` → 같은 측(원고측/피고측)끼리만 매칭

```typescript
const PLAINTIFF_SIDE = ['plaintiff', 'creditor', 'applicant'];
const DEFENDANT_SIDE = ['defendant', 'debtor', 'respondent'];

function isCompatiblePartyType(migType, scourtType) {
  if (migType === scourtType) return true;
  if (PLAINTIFF_SIDE.includes(migType) && PLAINTIFF_SIDE.includes(scourtType)) return true;
  if (DEFENDANT_SIDE.includes(migType) && DEFENDANT_SIDE.includes(scourtType)) return true;
  return false;
}
```

### 알림탭 당사자 섹션 숨김 조건

**파일:** `CaseDetail.tsx` - `shouldShowPartiesSection`

양측 모두 마스킹 해제된 당사자가 있으면 당사자 섹션을 숨깁니다.

```typescript
// 조건: 원고측 + 피고측 모두 마스킹 해제된 이름 존재
const unmaskedPlaintiff = parties.find(p => isPlaintiffSide(p) && !MASKED_NAME_PATTERN.test(p.party_name));
const unmaskedDefendant = parties.find(p => isDefendantSide(p) && !MASKED_NAME_PATTERN.test(p.party_name));

return !(unmaskedPlaintiff && unmaskedDefendant); // 둘 다 있으면 숨김
```

### partyOverrides 로직

**파일:** `CaseDetail.tsx` - `unmaskedPartyOverrides`

일반탭에 전달하는 당사자 오버라이드 목록:

```typescript
// 기존: manual_override=true인 당사자만
const manualPartyOverrides = caseParties.filter(p => p.manual_override);

// 수정: 마스킹 해제된 모든 당사자
const unmaskedPartyOverrides = caseParties.filter(p => {
  const cleanName = p.party_name.replace(/^\d+\.\s*/, '').trim();
  return !MASKED_NAME_PATTERN.test(cleanName);
});
```

이 변경으로 `ScourtGeneralInfoXml`에서 `clientRole` 추론 로직을 사용하지 않고
SCOURT 라벨 기반으로 당사자를 표시합니다.

---

---

## 일반탭 당사자 수정 모달에서 의뢰인 설정

**2026-01-13 추가**

### 개요

일반탭(`ScourtGeneralInfoXml`)에서 당사자 수정 시 의뢰인 설정(`is_our_client`, `client_id`)도 함께 변경할 수 있습니다.

### 기능

| 항목 | 설명 |
|------|------|
| 이름 수정 | 마스킹된 이름을 실제 이름으로 변경 |
| 대표 설정 | `is_primary` 토글 |
| **의뢰인 설정** | `is_our_client` 체크박스 + `client_id` 드롭다운 |

### 반대측 의뢰인 경고 및 자동 해제

같은 사건에서 **원고측**과 **피고측** 당사자가 동시에 의뢰인이 될 수 없습니다.

#### 측 분류

```typescript
const PLAINTIFF_SIDE = ['plaintiff', 'creditor', 'applicant', 'actor']
const DEFENDANT_SIDE = ['defendant', 'debtor', 'respondent', 'third_debtor', 'accused', 'juvenile']
```

#### 동작

1. **경고 표시**: 반대측에 기존 의뢰인이 있으면 경고 메시지 표시 (차단하지 않음)
2. **저장 시 자동 해제**: 반대측 당사자를 의뢰인으로 설정하면 기존 반대측 의뢰인 자동 해제

```
사용자: 피고측 당사자를 의뢰인으로 설정
    ↓
API: 기존 원고측 의뢰인 조회
    ↓
    ├─ 있음 → is_our_client=false, client_id=null 설정
    └─ 없음 → 그대로 진행
    ↓
새 당사자에 is_our_client=true 설정
    ↓
legal_cases.client_id, client_role 동기화
```

#### 같은 측 복수 의뢰인

같은 측 당사자는 **여러 명이 동시에 의뢰인**이 될 수 있습니다 (공동원고 등).
`legal_cases.client_id`는 마지막으로 설정된 의뢰인으로 갱신됩니다.

### 의뢰인 해제 시 동기화

의뢰인 체크박스를 해제하면:

1. `case_parties`: `is_our_client=false`, `client_id=null`
2. `legal_cases`: 다른 의뢰인이 있으면 해당 정보로 갱신, 없으면 `client_id=null`, `client_role=null`

### 관련 파일

| 파일 | 역할 |
|------|------|
| `components/CaseDetail.tsx` | 일반탭 모달 UI, `isOppositeSideClient` 감지 |
| `components/CasePartiesSection.tsx` | 알림탭 의뢰인 설정 UI |
| `app/api/admin/cases/[id]/parties/route.ts` | 반대측 자동 해제, legal_cases 동기화 |

---

## 주의사항

1. **manual_override 보호**: 사용자가 직접 수정한 당사자는 자동 동기화되지 않음
2. **SCOURT 동기화와 충돌**: SCOURT 동기화도 manual_override 플래그를 존중함
3. **삭제 제한**: 사건에서 사용 중인 의뢰인은 삭제 불가
4. **테넌트 격리**: 모든 API는 테넌트 컨텍스트 내에서만 동작
5. **SCOURT 라벨 우선**: 당사자 지위명은 SCOURT 원본(`party_type_label`)을 사용, 사건번호 기반 추론 사용 안함
6. **반대측 의뢰인 자동 해제**: 반대측 당사자를 의뢰인으로 설정 시 기존 반대측 의뢰인 자동 해제
