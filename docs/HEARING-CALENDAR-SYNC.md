# 기일 관리 및 Google Calendar 동기화

## 개요

SCOURT(대법원 나의사건검색)에서 기일 정보를 가져와 `court_hearings` 테이블에 저장하고, Google Calendar에 자동 등록하는 시스템입니다.

## 데이터 흐름

```
SCOURT API
    ↓
scourt_case_snapshots.hearings (JSONB)
    ↓
court_hearings 테이블 (정규화)
    ↓
Google Calendar (쓰기 전용)
    ↓
google_event_id 저장
```

## 주요 컴포넌트

### 1. SCOURT → court_hearings 동기화

**파일**: `lib/scourt/hearing-sync.ts`

```typescript
// SCOURT 기일을 court_hearings에 동기화
await syncHearingsToCourtHearings(caseId, caseNumber, hearings);
```

**특징**:
- `scourt_hearing_hash`로 중복 방지 (date|time|type SHA256)
- 기일 유형 자동 매핑 (변론기일, 조정기일 등)
- 기일 결과 자동 매핑 (속행, 종결 등)
- 상태 자동 결정 (SCHEDULED, COMPLETED)

### 2. court_hearings → Google Calendar 동기화

**API**: `POST /api/admin/court-hearings/sync-to-calendar`

```typescript
// 모든 미래 기일 동기화
fetch('/api/admin/court-hearings/sync-to-calendar', {
  method: 'POST',
  body: JSON.stringify({})
});

// 특정 사건의 기일만 동기화
fetch('/api/admin/court-hearings/sync-to-calendar', {
  method: 'POST',
  body: JSON.stringify({ caseId: 'uuid...' })
});
```

**생성되는 이벤트 형식**:
- 제목: `[조정기일] 2024드단26718`
- 설명: 사건번호, 기일 유형
- 시간: 1시간 (기본)
- 알림: 1일 전, 1시간 전
- 색상: 청록색 (colorId: 7)

### 3. Google Calendar 쓰기 함수

**파일**: `lib/google-calendar.ts`

```typescript
// 이벤트 생성
await createTenantCalendarEvent(tenantId, calendarId, eventData);

// 이벤트 수정
await updateTenantCalendarEvent(tenantId, calendarId, eventId, updates);

// 이벤트 삭제
await deleteTenantCalendarEvent(tenantId, calendarId, eventId);
```

## 데이터베이스 스키마

### court_hearings 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| case_id | UUID | legal_cases FK |
| case_number | TEXT | 사건번호 |
| hearing_type | TEXT | 기일 유형 (HEARING_MAIN 등) |
| hearing_date | TIMESTAMPTZ | 기일 일시 |
| location | TEXT | 장소 |
| result | TEXT | 결과 (CONTINUED 등) |
| status | TEXT | 상태 (SCHEDULED, COMPLETED) |
| source | TEXT | 출처 (scourt, manual) |
| scourt_hearing_hash | TEXT | 중복 방지 해시 |
| google_event_id | TEXT | Google Calendar 이벤트 ID |

### 마이그레이션

```sql
-- scourt_hearing_hash 컬럼
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS scourt_hearing_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_court_hearings_case_hash
ON court_hearings (case_id, scourt_hearing_hash)
WHERE scourt_hearing_hash IS NOT NULL;

-- google_event_id 컬럼
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_court_hearings_google_event_id
ON court_hearings (google_event_id)
WHERE google_event_id IS NOT NULL;
```

## 기일 유형 매핑

| SCOURT 기일명 | HearingType |
|--------------|-------------|
| 변론, 변론기일, 변론준비, 증인신문 | HEARING_MAIN |
| 조정, 조정기일, 화해권고 | HEARING_MEDIATION |
| 조사, 조사기일, 면접조사 | HEARING_INVESTIGATION |
| 선고, 판결선고 | HEARING_JUDGMENT |
| 심문, 가처분, 가압류 | HEARING_INTERIM |
| 상담, 양육상담, 부모교육 | HEARING_PARENTING |

## Google Calendar 설정

### OAuth Scope

```
https://www.googleapis.com/auth/calendar
```

전체 액세스 권한 (캘린더 목록 조회 + 이벤트 읽기/쓰기)

### 연동 방법

1. `/admin/settings/tenant` 페이지 접속
2. Google Calendar **연결하기** 클릭
3. Google OAuth 동의
4. 동기화할 캘린더 선택

## 비활성화된 기능

### Google Calendar 읽기 (Deprecated)

기존에는 Google Calendar에서 이벤트를 읽어와 `court_hearings`에 저장했으나, 이제 SCOURT가 Single Source of Truth입니다.

**비활성화된 API**:
- `POST /api/admin/google-calendar/sync` → 410 Gone
- `GET /api/admin/google-calendar/sync` → 410 Gone
- `PUT /api/admin/google-calendar/sync` (Watch 등록) → 410 Gone
- `DELETE /api/admin/google-calendar/sync` (Watch 해제) → 410 Gone

**비활성화된 Webhook**:
- `POST /api/webhooks/google-calendar` → 무시 (200 반환)

## 사용 예시

### SCOURT 동기화 시 자동 기일 저장

```typescript
// app/api/admin/scourt/sync/route.ts
const hearingsForSync = generalData.hearings.map(h => ({
  date: h.trmDt || '',
  time: h.trmHm || '',
  type: h.trmNm || '',
  location: h.trmPntNm || '',
  result: h.rslt || '',
}));

await syncHearingsToCourtHearings(legalCaseId, caseNumber, hearingsForSync);
```

### 수동 Calendar 동기화

```javascript
// 브라우저 콘솔에서
fetch('/api/admin/court-hearings/sync-to-calendar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
}).then(r => r.json()).then(console.log);
```

## 트러블슈팅

### Calendar 목록이 안 보임
- OAuth scope가 `calendar` (전체 액세스)인지 확인
- Google Calendar 재연결 필요

### 기일이 중복 생성됨
- `scourt_hearing_hash` 인덱스 확인
- 동일 case_id + hash 조합은 유니크

### Calendar 이벤트가 안 만들어짐
- `tenant_integrations.settings.calendarId` 확인
- Access token 만료 여부 확인 (자동 갱신됨)
