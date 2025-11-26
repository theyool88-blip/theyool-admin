# 의뢰인 포털 미리보기 API 문서

법무법인 더율 관리자 시스템의 의뢰인 포털 미리보기 API 사용 가이드입니다.

## 개요

관리자가 의뢰인에게 보여질 포털 화면을 미리 확인할 수 있는 API입니다. 의뢰인의 기본 정보, 사건 목록, 다가오는 재판기일 및 기한을 조회할 수 있습니다.

## 인증

모든 API 엔드포인트는 인증이 필요합니다. Supabase 세션 쿠키를 통해 자동으로 인증됩니다.

## API 엔드포인트

### 1. 의뢰인 포털 미리보기

의뢰인의 포털 대시보드에 표시될 정보를 조회합니다.

**Endpoint:** `GET /api/admin/client-preview/[clientId]`

**Parameters:**
- `clientId` (path parameter, required): 의뢰인 UUID

**Response 200 (Success):**
```typescript
{
  success: true,
  client: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  },
  cases: [
    {
      id: string;
      case_name: string;
      contract_number: string;
      case_type: string;
      status: string;
      office: string;
      contract_date: string;
      created_at: string;
    }
  ],
  upcomingHearings: [
    {
      id: string;
      hearing_date: string;
      hearing_time: string;
      court_name: string;
      case_number: string;
      case_name: string;
    }
  ],
  upcomingDeadlines: [
    {
      id: string;
      deadline_date: string;
      deadline_type: string;
      description: string;
      case_name: string;
    }
  ]
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "유효하지 않은 의뢰인 ID입니다."
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "인증이 필요합니다."
}
```

**Response 404 (Not Found):**
```json
{
  "error": "의뢰인을 찾을 수 없습니다."
}
```

**Response 500 (Server Error):**
```json
{
  "error": "서버 오류가 발생했습니다."
}
```

**주요 기능:**
- 의뢰인 기본 정보 조회
- 의뢰인의 모든 사건 목록 (최신순)
- 30일 이내 다가오는 재판기일 (최대 10건)
- 30일 이내 다가오는 미완료 기한 (최대 10건)

**Example Request:**
```typescript
const response = await fetch('/api/admin/client-preview/550e8400-e29b-41d4-a716-446655440000');
const data = await response.json();
```

---

### 2. 의뢰인 사건 상세 미리보기

특정 사건의 상세 정보를 조회합니다.

**Endpoint:** `GET /api/admin/client-preview/[clientId]/cases/[caseId]`

**Parameters:**
- `clientId` (path parameter, required): 의뢰인 UUID
- `caseId` (path parameter, required): 사건 UUID

**Response 200 (Success):**
```typescript
{
  success: true,
  case: {
    id: string;
    case_name: string;
    contract_number: string;
    case_type: string;
    status: string;
    office: string;
    contract_date: string;
    created_at: string;
  },
  hearings: [
    {
      id: string;
      hearing_date: string;
      hearing_time: string | null;
      court_name: string | null;
      hearing_type: string | null;
      hearing_result: string | null;
      judge_name: string | null;
      hearing_report: string | null;
      case_number: string | null;
    }
  ],
  deadlines: [
    {
      id: string;
      deadline_date: string;
      deadline_type: string | null;
      description: string | null;
      is_completed: boolean;
    }
  ]
}
```

**Response 400 (Bad Request):**
```json
{
  "error": "유효하지 않은 ID 형식입니다."
}
```

**Response 401 (Unauthorized):**
```json
{
  "error": "인증이 필요합니다."
}
```

**Response 404 (Not Found):**
```json
{
  "error": "사건을 찾을 수 없습니다."
}
```

**Response 500 (Server Error):**
```json
{
  "error": "서버 오류가 발생했습니다."
}
```

**주요 기능:**
- 사건 기본 정보 조회
- 사건의 모든 재판기일 목록 (최신순)
- 사건의 모든 기한 목록 (미완료 우선, 날짜순)
- 의뢰인 소유권 검증 (clientId와 caseId 매칭 확인)

**Example Request:**
```typescript
const response = await fetch(
  '/api/admin/client-preview/550e8400-e29b-41d4-a716-446655440000/cases/6ba7b810-9dad-11d1-80b4-00c04fd430c8'
);
const data = await response.json();
```

---

## 데이터베이스 스키마

### 사용되는 테이블

#### clients
- `id` (uuid, PK)
- `name` (text)
- `phone` (text)
- `email` (text, nullable)

#### legal_cases
- `id` (uuid, PK)
- `client_id` (uuid, FK → clients.id)
- `case_name` (text)
- `contract_number` (text)
- `case_type` (text)
- `status` (text)
- `office` (text)
- `contract_date` (date)
- `created_at` (timestamp)

#### court_hearings
- `id` (uuid, PK)
- `case_id` (uuid, FK → legal_cases.id)
- `hearing_date` (date)
- `hearing_time` (time, nullable)
- `court_name` (text, nullable)
- `hearing_type` (text, nullable)
- `hearing_result` (text, nullable)
- `judge_name` (text, nullable)
- `hearing_report` (text, nullable)
- `case_number` (text, nullable)

#### case_deadlines
- `id` (uuid, PK)
- `case_id` (uuid, FK → legal_cases.id)
- `deadline_date` (date)
- `deadline_type` (text, nullable)
- `description` (text, nullable)
- `is_completed` (boolean)

---

## 보안 및 성능

### 보안
- **인증**: 모든 요청은 `isAuthenticated()` 체크를 통과해야 합니다
- **권한**: `createAdminClient()`를 사용하여 RLS 우회 (관리자 전용)
- **입력 검증**: UUID 형식 검증을 통해 SQL Injection 방지
- **소유권 검증**: 사건 상세 조회 시 `client_id`와 `case_id` 매칭 확인

### 성능 최적화
- **쿼리 최적화**:
  - 필요한 컬럼만 선택 (SELECT *)
  - 적절한 인덱스 활용 (FK, 날짜 필드)
  - LIMIT를 통한 결과 제한 (재판기일, 기한 최대 10건)
- **병렬 처리**: 재판기일과 기한 조회는 독립적으로 실행
- **에러 핸들링**: 부분 실패 시에도 가능한 데이터 반환

### 로깅
모든 에러는 구조화된 로그로 기록됩니다:
```typescript
console.error('[Client Preview] Client fetch error:', {
  clientId,
  error: clientError.message,
  code: clientError.code
});
```

---

## TypeScript 타입 사용

프론트엔드에서 타입 안전성을 보장하기 위해 `/types/client-preview.ts`의 타입을 사용하세요:

```typescript
import type {
  ClientPreviewResponse,
  CaseDetailResponse,
  ErrorResponse
} from '@/types/client-preview';

// 의뢰인 포털 미리보기
async function fetchClientPreview(clientId: string): Promise<ClientPreviewResponse> {
  const response = await fetch(`/api/admin/client-preview/${clientId}`);
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error);
  }
  return response.json();
}

// 사건 상세 미리보기
async function fetchCaseDetail(
  clientId: string,
  caseId: string
): Promise<CaseDetailResponse> {
  const response = await fetch(
    `/api/admin/client-preview/${clientId}/cases/${caseId}`
  );
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error);
  }
  return response.json();
}
```

---

## 테스트

### 수동 테스트

1. **의뢰인 목록에서 ID 확인**
   ```bash
   curl -H "Cookie: <your-session-cookie>" \
     http://localhost:3000/api/admin/clients
   ```

2. **의뢰인 포털 미리보기**
   ```bash
   curl -H "Cookie: <your-session-cookie>" \
     http://localhost:3000/api/admin/client-preview/[clientId]
   ```

3. **사건 상세 미리보기**
   ```bash
   curl -H "Cookie: <your-session-cookie>" \
     http://localhost:3000/api/admin/client-preview/[clientId]/cases/[caseId]
   ```

### 자동 테스트 (예정)

추후 Jest를 사용한 통합 테스트 추가 예정:
- 인증 실패 시나리오
- 유효하지 않은 UUID 형식
- 존재하지 않는 의뢰인/사건
- 권한 검증 (다른 의뢰인의 사건 접근 차단)

---

## 에러 처리 가이드

### 클라이언트 측 에러 처리

```typescript
try {
  const data = await fetchClientPreview(clientId);
  // 성공 처리
} catch (error) {
  if (error instanceof Response) {
    switch (error.status) {
      case 400:
        alert('유효하지 않은 요청입니다.');
        break;
      case 401:
        router.push('/login');
        break;
      case 404:
        alert('의뢰인을 찾을 수 없습니다.');
        break;
      case 500:
        alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        break;
    }
  }
}
```

---

## 향후 개선 사항

- [ ] Zod를 사용한 런타임 타입 검증
- [ ] Redis 캐싱 추가 (자주 조회되는 의뢰인 정보)
- [ ] Rate Limiting 적용
- [ ] GraphQL API 고려
- [ ] 웹소켓을 통한 실시간 업데이트
- [ ] Pagination 추가 (사건이 많은 경우)
- [ ] 검색 및 필터링 기능

---

## 관련 파일

- **API 구현**: `/app/api/admin/client-preview/[clientId]/route.ts`
- **사건 상세 API**: `/app/api/admin/client-preview/[clientId]/cases/[caseId]/route.ts`
- **타입 정의**: `/types/client-preview.ts`
- **Admin Client**: `/lib/supabase/admin.ts`
- **인증 헬퍼**: `/lib/auth/auth.ts`

---

**마지막 업데이트**: 2025-11-26
**API 버전**: v1.0
**작성자**: Claude Code (Backend & SEO Specialist)
