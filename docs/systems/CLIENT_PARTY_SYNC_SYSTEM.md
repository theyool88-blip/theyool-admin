# 의뢰인/당사자 동기화 시스템

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

## 주의사항

1. **manual_override 보호**: 사용자가 직접 수정한 당사자는 자동 동기화되지 않음
2. **SCOURT 동기화와 충돌**: SCOURT 동기화도 manual_override 플래그를 존중함
3. **삭제 제한**: 사건에서 사용 중인 의뢰인은 삭제 불가
4. **테넌트 격리**: 모든 API는 테넌트 컨텍스트 내에서만 동작
