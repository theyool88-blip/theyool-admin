# API Reference

**Last Updated**: 2025-12-02

법무법인 더율 관리자 시스템 API 레퍼런스입니다.

---

## 인증

모든 API는 인증이 필요합니다. Supabase 세션 쿠키를 통해 자동으로 인증됩니다.

```typescript
// 인증 확인
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
}
```

---

## 응답 형식

### 성공 응답

```typescript
// 단일 항목
interface ApiResponse<T> {
  success: true
  data: T
}

// 목록
interface ApiListResponse<T> {
  success: true
  data: T[]
  count: number
}
```

### 에러 응답

```typescript
interface ErrorResponse {
  success: false
  error: string
}
```

---

## 법원 기일 API

### 목록 조회

**Endpoint**: `GET /api/admin/court-hearings`

**쿼리 파라미터**:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| case_number | string | 사건번호 필터 |
| hearing_type | HearingType | 기일 유형 필터 |
| status | HearingStatus | 상태 필터 |
| from_date | string | 시작일 (ISO 8601) |
| to_date | string | 종료일 (ISO 8601) |
| limit | number | 페이지당 개수 (기본: 50) |
| offset | number | 오프셋 (기본: 0) |

**응답 예시**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "case_number": "2024드단12345",
      "hearing_type": "HEARING_MAIN",
      "hearing_date": "2025-02-15T10:00:00Z",
      "location": "서울가정법원 301호",
      "judge_name": "홍길동",
      "status": "SCHEDULED"
    }
  ],
  "count": 10
}
```

### 상세 조회

**Endpoint**: `GET /api/admin/court-hearings/[id]`

### 생성

**Endpoint**: `POST /api/admin/court-hearings`

**요청 Body**:

```json
{
  "case_number": "2024드단12345",
  "hearing_type": "HEARING_MAIN",
  "hearing_date": "2025-02-15T10:00:00Z",
  "location": "서울가정법원 301호",
  "judge_name": "홍길동"
}
```

### 수정

**Endpoint**: `PATCH /api/admin/court-hearings/[id]`

### 삭제

**Endpoint**: `DELETE /api/admin/court-hearings/[id]`

---

## 사건 데드라인 API

### 목록 조회

**Endpoint**: `GET /api/admin/case-deadlines`

**쿼리 파라미터**:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| case_number | string | 사건번호 필터 |
| deadline_type | DeadlineType | 데드라인 유형 |
| status | DeadlineStatus | 상태 필터 |
| urgent_only | boolean | 긴급(7일 이내)만 조회 |
| limit | number | 페이지당 개수 (기본: 50) |
| offset | number | 오프셋 (기본: 0) |

**응답 예시**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "case_number": "2024드단12345",
      "deadline_type": "DL_APPEAL",
      "trigger_date": "2025-01-15",
      "deadline_date": "2025-01-29",
      "status": "PENDING"
    }
  ],
  "count": 5
}
```

### 생성 (자동 계산)

**Endpoint**: `POST /api/admin/case-deadlines`

**요청 Body**:

```json
{
  "case_number": "2024드단12345",
  "deadline_type": "DL_APPEAL",
  "trigger_date": "2025-01-15",
  "notes": "1심 판결 선고일"
}
```

> `deadline_date`는 데이터베이스 트리거가 자동 계산합니다.

### 수정

**Endpoint**: `PATCH /api/admin/case-deadlines/[id]`

### 삭제

**Endpoint**: `DELETE /api/admin/case-deadlines/[id]`

---

## 불변기간 타입 API

### 목록 조회 (읽기 전용)

**Endpoint**: `GET /api/admin/deadline-types`

**응답 예시**:

```json
{
  "success": true,
  "data": [
    {
      "type": "DL_APPEAL",
      "name": "항소기간",
      "days": 14,
      "description": "판결 선고일로부터 14일"
    },
    {
      "type": "DL_MEDIATION_OBJ",
      "name": "조정결정 이의신청",
      "days": 14
    }
  ],
  "count": 5
}
```

---

## 의뢰인 포털 미리보기 API

### 의뢰인 대시보드

**Endpoint**: `GET /api/admin/client-preview/[clientId]`

**응답**:

```typescript
{
  success: true,
  client: {
    id: string
    name: string
    phone: string
    email?: string
  },
  cases: Array<{
    id: string
    case_name: string
    case_type: string
    status: string
  }>,
  upcomingHearings: Array<{
    id: string
    hearing_date: string
    court_name: string
    case_number: string
  }>,
  upcomingDeadlines: Array<{
    id: string
    deadline_date: string
    deadline_type: string
    description: string
  }>
}
```

### 사건 상세 미리보기

**Endpoint**: `GET /api/admin/client-preview/[clientId]/cases/[caseId]`

**응답**:

```typescript
{
  success: true,
  case: {
    id: string
    case_name: string
    case_type: string
    status: string
  },
  hearings: Array<CourtHearing>,
  deadlines: Array<CaseDeadline>
}
```

---

## 캘린더 API

### 통합 일정 조회

**Endpoint**: `GET /api/admin/calendar`

**쿼리 파라미터**:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| start | string | 시작일 (YYYY-MM-DD) |
| end | string | 종료일 (YYYY-MM-DD) |

**응답**:

```typescript
{
  success: true,
  data: Array<{
    id: string
    date: string
    time?: string
    title: string
    schedule_type: 'trial' | 'consultation' | 'meeting' | 'court_hearing' | 'deadline'
    case_number?: string
    location?: string
  }>
}
```

### Google Calendar 동기화

**Endpoint**: `POST /api/admin/google-calendar/sync`

---

## 입금 관리 API

### 입금 목록 조회

**Endpoint**: `GET /api/admin/payments`

**쿼리 파라미터**:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| case_id | string | 사건 ID 필터 |
| is_confirmed | boolean | 확인 여부 필터 |
| from_date | string | 시작일 |
| to_date | string | 종료일 |

### 입금 생성

**Endpoint**: `POST /api/admin/payments`

**요청 Body**:

```json
{
  "case_id": "uuid",
  "amount": 1000000,
  "depositor_name": "홍길동",
  "payment_date": "2025-01-15",
  "payment_category": "수임료"
}
```

### 입금 확인 처리

**Endpoint**: `PATCH /api/admin/payments/[id]/confirm`

---

## 지출 관리 API

### 지출 목록 조회

**Endpoint**: `GET /api/admin/expenses`

### 지출 생성

**Endpoint**: `POST /api/admin/expenses`

**요청 Body**:

```json
{
  "office": "평택",
  "category": "사무실 임대료",
  "amount": 500000,
  "expense_date": "2025-01-01",
  "is_fixed": true
}
```

---

## 상담 관리 API

### 상담 목록 조회

**Endpoint**: `GET /api/admin/consultations`

**쿼리 파라미터**:

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| status | string | 상태 필터 |
| consultation_type | string | 상담 유형 |
| office | string | 지점 필터 |

### 상담 상태 변경

**Endpoint**: `PATCH /api/admin/consultations/[id]/status`

**요청 Body**:

```json
{
  "status": "상담완료",
  "notes": "메모 내용"
}
```

---

## 공휴일 API

### 공휴일 목록

**Endpoint**: `GET /api/admin/holidays`

### 공휴일 추가

**Endpoint**: `POST /api/admin/holidays`

**요청 Body**:

```json
{
  "date": "2025-01-01",
  "name": "신정",
  "is_custom": false
}
```

### 공휴일 삭제

**Endpoint**: `DELETE /api/admin/holidays/[id]`

---

## ENUM 타입

### HearingType (법원 기일 유형)

| 값 | 설명 |
|----|------|
| HEARING_MAIN | 변론기일 |
| HEARING_PREP | 변론준비기일 |
| HEARING_MEDIATION | 조정기일 |
| HEARING_DECISION | 판결선고기일 |
| HEARING_EXAMINATION | 심문기일 |
| HEARING_OTHER | 기타 |

### DeadlineType (불변기간 유형)

| 값 | 설명 | 기간 |
|----|------|------|
| DL_APPEAL | 항소기간 | 14일 |
| DL_MEDIATION_OBJ | 조정결정 이의신청 | 14일 |
| DL_IMM_APPEAL | 즉시항고 | 7일 |
| DL_APPEAL_BRIEF | 항소이유서 | 20일 |
| DL_RETRIAL | 재심청구 | 30일 |

### HearingStatus (기일 상태)

| 값 | 설명 |
|----|------|
| SCHEDULED | 예정 |
| COMPLETED | 완료 |
| POSTPONED | 연기 |
| CANCELLED | 취소 |

### DeadlineStatus (데드라인 상태)

| 값 | 설명 |
|----|------|
| PENDING | 대기중 |
| COMPLETED | 완료 |
| OVERDUE | 기한초과 |

---

## 에러 코드

| 상태 코드 | 설명 |
|-----------|------|
| 400 | 잘못된 요청 (파라미터 오류) |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 500 | 서버 오류 |

---

## 사용 예시

### cURL

```bash
# 법원 기일 생성
curl -X POST http://localhost:3000/api/admin/court-hearings \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "case_number": "2024드단12345",
    "hearing_type": "HEARING_MAIN",
    "hearing_date": "2025-02-15T10:00:00Z",
    "location": "서울가정법원 301호"
  }'

# 긴급 데드라인 조회
curl "http://localhost:3000/api/admin/case-deadlines?urgent_only=true" \
  -H "Cookie: <session-cookie>"
```

### TypeScript

```typescript
// 의뢰인 포털 미리보기
async function fetchClientPreview(clientId: string) {
  const response = await fetch(`/api/admin/client-preview/${clientId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch')
  }
  return response.json()
}

// 데드라인 생성
async function createDeadline(data: CreateDeadlineRequest) {
  const response = await fetch('/api/admin/case-deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  return response.json()
}
```

