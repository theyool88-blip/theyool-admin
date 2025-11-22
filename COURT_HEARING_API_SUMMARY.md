# 법원 기일 관리 시스템 백엔드 API 완성 요약

**생성일**: 2025-11-22
**프로젝트**: 법무법인 더율 - 법원 기일 및 데드라인 관리 시스템

---

## 구축 완료 항목

### 1. TypeScript 타입 정의

**파일**: `/types/court-hearing.ts`

#### ENUM 타입
- `HearingType`: 법원 기일 유형 (6종)
- `DeadlineType`: 불변기간 유형 (5종)
- `HearingStatus`: 법원 기일 상태 (4종)
- `DeadlineStatus`: 데드라인 상태 (3종)

#### 데이터베이스 모델
- `DeadlineTypeMaster`: 불변기간 마스터 데이터 (5개 고정)
- `CourtHearing`: 법원 기일
- `CaseDeadline`: 사건별 데드라인

#### VIEW 타입
- `UpcomingHearing`: 다가오는 법원 기일 (30일 이내)
- `UrgentDeadline`: 긴급 데드라인 (7일 이내)

#### API 타입
- `CreateCourtHearingRequest` / `UpdateCourtHearingRequest`
- `CreateCaseDeadlineRequest` / `UpdateCaseDeadlineRequest`
- `CourtHearingListQuery` / `CaseDeadlineListQuery`
- `ApiResponse<T>` / `ApiListResponse<T>`

#### 유틸리티 함수
- `formatDaysUntil(days)`: D-day 표시
- `isUrgent(daysUntil)`: 긴급도 판정 (7일 이내)
- `isOverdue(daysUntil)`: 기한초과 판정

---

### 2. Supabase 헬퍼 함수

#### 법원 기일 (`/lib/supabase/court-hearings.ts`)
- `getCourtHearings(filters?)` - 목록 조회 (필터링, 페이지네이션)
- `getCourtHearingById(id)` - 상세 조회
- `getCourtHearingsByCaseNumber(caseNumber)` - 사건별 조회
- `getUpcomingHearings()` - 다가오는 기일 (VIEW)
- `createCourtHearing(request)` - 생성
- `updateCourtHearing(id, request)` - 수정
- `deleteCourtHearing(id)` - 삭제
- `updateHearingStatus(id, status)` - 상태 변경

#### 사건 데드라인 (`/lib/supabase/case-deadlines.ts`)
- `getCaseDeadlines(filters?)` - 목록 조회 (필터링, 페이지네이션)
- `getCaseDeadlineById(id)` - 상세 조회
- `getCaseDeadlinesByCaseNumber(caseNumber)` - 사건별 조회
- `getUrgentDeadlines()` - 긴급 데드라인 (VIEW)
- `createCaseDeadline(request)` - 생성 (자동 계산)
- `updateCaseDeadline(id, request)` - 수정 (자동 재계산)
- `deleteCaseDeadline(id)` - 삭제
- `completeDeadline(id, notes?)` - 완료 처리
- `updateDeadlineStatus(id, status)` - 상태 변경
- `calculateDaysUntil(deadlineDate)` - D-day 계산

#### 불변기간 타입 (`/lib/supabase/deadline-types.ts`)
- `getDeadlineTypes()` - 전체 목록 조회
- `getDeadlineTypeByType(type)` - 타입으로 조회
- `getDeadlineTypeById(id)` - ID로 조회
- `getDeadlineTypeOptions()` - UI 셀렉트박스용 옵션
- `getDeadlineDays(type)` - 불변기간 일수 조회

**특징**: 모든 헬퍼 함수는 `createAdminClient()` (Service Role Key) 사용

---

### 3. API 엔드포인트

#### 법원 기일 API

##### `GET /api/admin/court-hearings`
목록 조회 (관리자 전용)

**쿼리 파라미터**:
- `case_number` (string, optional): 사건번호
- `hearing_type` (HearingType, optional): 기일 유형
- `status` (HearingStatus, optional): 상태
- `from_date` (string, optional): 시작일 (ISO 8601 date)
- `to_date` (string, optional): 종료일 (ISO 8601 date)
- `limit` (number, optional, default: 50): 페이지당 개수
- `offset` (number, optional, default: 0): 오프셋

**응답**:
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
      "notes": "변론준비기일",
      "status": "SCHEDULED",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 10
}
```

##### `POST /api/admin/court-hearings`
신규 생성

**요청 Body**:
```json
{
  "case_number": "2024드단12345",
  "hearing_type": "HEARING_MAIN",
  "hearing_date": "2025-02-15T10:00:00Z",
  "location": "서울가정법원 301호",
  "judge_name": "홍길동",
  "notes": "변론준비기일",
  "status": "SCHEDULED"
}
```

##### `GET /api/admin/court-hearings/[id]`
상세 조회

##### `PATCH /api/admin/court-hearings/[id]`
수정

##### `DELETE /api/admin/court-hearings/[id]`
삭제

---

#### 사건 데드라인 API

##### `GET /api/admin/case-deadlines`
목록 조회 (관리자 전용)

**쿼리 파라미터**:
- `case_number` (string, optional): 사건번호
- `deadline_type` (DeadlineType, optional): 데드라인 유형
- `status` (DeadlineStatus, optional): 상태
- `urgent_only` (boolean, optional): 긴급(7일 이내)만 조회
- `limit` (number, optional, default: 50): 페이지당 개수
- `offset` (number, optional, default: 0): 오프셋

**응답**:
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
      "deadline_datetime": "2025-01-29T23:59:59Z",
      "notes": "1심 판결 선고일",
      "status": "PENDING",
      "completed_at": null,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 5
}
```

##### `POST /api/admin/case-deadlines`
신규 생성 (자동 계산)

**요청 Body**:
```json
{
  "case_number": "2024드단12345",
  "deadline_type": "DL_APPEAL",
  "trigger_date": "2025-01-15",
  "notes": "1심 판결 선고일",
  "status": "PENDING"
}
```

**주의**: `deadline_date`와 `deadline_datetime`은 데이터베이스 트리거가 자동 계산

##### `GET /api/admin/case-deadlines/[id]`
상세 조회

##### `PATCH /api/admin/case-deadlines/[id]`
수정 (trigger_date 변경 시 자동 재계산)

##### `DELETE /api/admin/case-deadlines/[id]`
삭제

---

#### 불변기간 타입 API

##### `GET /api/admin/deadline-types`
마스터 데이터 조회 (읽기 전용)

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "DL_APPEAL",
      "name": "항소기간",
      "days": 14,
      "description": "판결 선고일로부터 14일",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "type": "DL_MEDIATION_OBJ",
      "name": "조정결정 이의신청",
      "days": 14,
      "description": "조정결정 통지일로부터 14일",
      "created_at": "2025-01-01T00:00:00Z"
    },
    ...
  ],
  "count": 5
}
```

**특징**: 5개 고정 데이터, 생성/수정/삭제 불가

---

## 데이터베이스 스키마

### 테이블

#### `deadline_types` (불변기간 마스터)
- `id` (UUID, PK)
- `type` (DeadlineType, UNIQUE)
- `name` (TEXT): 한글명
- `days` (INTEGER): 기간(일수)
- `description` (TEXT, nullable): 설명
- `created_at` (TIMESTAMPTZ)

**데이터**: 5개 고정 (DL_APPEAL, DL_MEDIATION_OBJ, DL_IMM_APPEAL, DL_APPEAL_BRIEF, DL_RETRIAL)

#### `court_hearings` (법원 기일)
- `id` (UUID, PK)
- `case_number` (TEXT): 사건번호
- `hearing_type` (HearingType): 기일 유형
- `hearing_date` (TIMESTAMPTZ): 기일 일시
- `location` (TEXT, nullable): 법정
- `judge_name` (TEXT, nullable): 담당 판사
- `notes` (TEXT, nullable): 메모
- `status` (HearingStatus): 상태
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**인덱스**: `case_number`, `hearing_date`, `status`

#### `case_deadlines` (사건별 데드라인)
- `id` (UUID, PK)
- `case_number` (TEXT): 사건번호
- `deadline_type` (DeadlineType): 데드라인 유형
- `trigger_date` (DATE): 기산일
- `deadline_date` (DATE, 자동 계산): 만료일
- `deadline_datetime` (TIMESTAMPTZ, 자동 계산): 만료 일시
- `notes` (TEXT, nullable): 메모
- `status` (DeadlineStatus): 상태
- `completed_at` (TIMESTAMPTZ, nullable): 완료 일시
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**인덱스**: `case_number`, `deadline_type`, `deadline_date`, `status`

**트리거**: `before_insert_case_deadline`, `before_update_case_deadline`
- `trigger_date`와 `deadline_type`으로 `deadline_date` 자동 계산
- `deadline_date`에서 23:59:59로 `deadline_datetime` 자동 계산

### VIEW

#### `upcoming_hearings`
향후 30일 이내 예정된 법원 기일 (상태 SCHEDULED만)

**컬럼**: `court_hearings.*` + `days_until_hearing` (남은 일수)

#### `urgent_deadlines`
7일 이내 만료 데드라인 (상태 PENDING만)

**컬럼**: `case_deadlines.*` + `deadline_type_name` (한글명) + `days_until_deadline` (남은 일수)

---

## 파일 구조

```
/Users/hskim/theyool-admin/
├── types/
│   └── court-hearing.ts                    # TypeScript 타입 정의
├── lib/
│   └── supabase/
│       ├── admin.ts                        # Service Role Key 클라이언트
│       ├── court-hearings.ts               # 법원 기일 헬퍼
│       ├── case-deadlines.ts               # 사건 데드라인 헬퍼
│       └── deadline-types.ts               # 불변기간 타입 헬퍼
└── app/
    └── api/
        └── admin/
            ├── court-hearings/
            │   ├── route.ts                # GET, POST
            │   └── [id]/
            │       └── route.ts            # GET, PATCH, DELETE
            ├── case-deadlines/
            │   ├── route.ts                # GET, POST
            │   └── [id]/
            │       └── route.ts            # GET, PATCH, DELETE
            └── deadline-types/
                └── route.ts                # GET (읽기 전용)
```

---

## 주요 특징

### 1. 자동 계산 시스템
- **데드라인 생성 시**: `trigger_date` + `deadline_type` → 자동으로 `deadline_date`, `deadline_datetime` 계산
- **트리거 변경 시**: `trigger_date` 수정 시 자동 재계산
- **데이터베이스 레벨**: PostgreSQL 트리거로 안전하게 계산

### 2. 보안
- **Service Role Key 사용**: 모든 헬퍼 함수에서 `createAdminClient()` 사용
- **인증 확인**: 모든 API 엔드포인트에서 `isAuthenticated()` 체크
- **관리자 전용**: Admin 사용자만 접근 가능

### 3. 일관된 API 응답
```typescript
// 단일 항목
ApiResponse<T> = { success: boolean; data?: T; error?: string; }

// 목록
ApiListResponse<T> = { success: boolean; data?: T[]; count?: number; error?: string; }
```

### 4. 에러 처리
- Try-catch 블록으로 모든 에러 포착
- 명확한 에러 메시지 반환
- Console.error로 서버 로그 기록

---

## 사용 예시

### 법원 기일 생성
```bash
curl -X POST http://localhost:3000/api/admin/court-hearings \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "2024드단12345",
    "hearing_type": "HEARING_MAIN",
    "hearing_date": "2025-02-15T10:00:00Z",
    "location": "서울가정법원 301호",
    "judge_name": "홍길동"
  }'
```

### 데드라인 생성 (자동 계산)
```bash
curl -X POST http://localhost:3000/api/admin/case-deadlines \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "2024드단12345",
    "deadline_type": "DL_APPEAL",
    "trigger_date": "2025-01-15",
    "notes": "1심 판결 선고일"
  }'
```
→ `deadline_date`는 자동으로 "2025-01-29" (14일 후) 계산됨

### 긴급 데드라인 조회
```bash
curl -X GET "http://localhost:3000/api/admin/case-deadlines?urgent_only=true"
```

### 불변기간 타입 조회
```bash
curl -X GET http://localhost:3000/api/admin/deadline-types
```

---

## 다음 단계

### 1. 프론트엔드 UI 구축
- 법원 기일 목록/상세/생성/수정 페이지
- 데드라인 목록/상세/생성/수정 페이지
- 캘린더 뷰
- D-day 알림

### 2. 추가 기능
- 알림 시스템 (이메일, SMS)
- 데드라인 완료 체크리스트
- 통계 대시보드
- Excel/PDF 내보내기

### 3. 테스트
- Unit 테스트
- Integration 테스트
- E2E 테스트

---

## 변경 이력

- **2025-11-22**: 백엔드 API 완성 (타입 정의, 헬퍼 함수, API 엔드포인트)
- 데이터베이스 마이그레이션 완료 (이전 작업)

---

**완료 상태**: ✅ 백엔드 CRUD API 100% 완성
