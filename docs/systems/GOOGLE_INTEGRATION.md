# Google 연동 시스템

**Last Updated**: 2025-12-31

테넌트별 Google Calendar 및 Google Drive OAuth 연동 시스템입니다.

---

## 개요

각 테넌트(법무법인)가 자신의 Google 계정을 연결하여 Calendar와 Drive를 사용할 수 있습니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| Google Calendar 연동 | 기일/상담 일정 동기화 |
| Google Drive 연동 | 의뢰인 파일 공유 (예정) |
| 테넌트별 토큰 관리 | 각 테넌트 독립적인 OAuth 토큰 |
| 자동 토큰 갱신 | Refresh Token으로 자동 갱신 |

---

## 데이터베이스 스키마

### tenant_integrations 테이블

```sql
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'google_calendar', 'google_drive'

  -- OAuth tokens
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,

  -- Provider-specific settings
  settings JSONB DEFAULT '{}'::jsonb,
  -- Calendar: { "calendarId": "xxx@group.calendar.google.com" }
  -- Drive: { "folderId": "xxx" }

  -- Status
  status VARCHAR(20) DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, provider)
);
```

### oauth_states 테이블 (CSRF 방지)

```sql
CREATE TABLE oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## OAuth 플로우

### 1. 연결 시작

```
사용자 → "연결하기" 클릭
    ↓
POST /api/admin/tenant/integrations
    { provider: "google_calendar" }
    ↓
서버: State 생성 → oauth_states 저장
    ↓
응답: { authUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }
    ↓
사용자 → Google 로그인 페이지로 리다이렉트
```

### 2. OAuth 콜백

```
Google → /api/auth/callback/google?code=xxx&state=xxx
    ↓
서버: State 검증 (oauth_states 조회)
    ↓
서버: Code → Token 교환
    ↓
서버: tenant_integrations에 토큰 저장
    ↓
리다이렉트: /admin/settings/tenant?success=calendar_connected
```

### 3. State 데이터 구조

```typescript
interface OAuthState {
  tenantId: string;
  provider: 'google_calendar' | 'google_drive';
  nonce: string;      // CSRF 방지용 랜덤 값
  timestamp: number;  // 생성 시간
}
```

---

## API 엔드포인트

### 연동 목록 조회

```
GET /api/admin/tenant/integrations

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider": "google_calendar",
      "status": "connected",
      "connectedAt": "2025-12-31T00:00:00Z",
      "settings": { "calendarId": "xxx@group.calendar.google.com" }
    }
  ]
}
```

### 연동 시작

```
POST /api/admin/tenant/integrations
Body: { "provider": "google_calendar" }

Response:
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### 연동 상세 조회 (캘린더 목록 포함)

```
GET /api/admin/tenant/integrations/google_calendar

Response:
{
  "success": true,
  "data": { ... integration data ... },
  "calendars": [
    { "id": "primary", "summary": "기본 캘린더", "primary": true },
    { "id": "xxx@group.calendar.google.com", "summary": "케이스노트" }
  ]
}
```

### 연동 설정 업데이트

```
PUT /api/admin/tenant/integrations/google_calendar
Body: { "settings": { "calendarId": "xxx@group.calendar.google.com" } }

Response:
{
  "success": true,
  "data": { ... updated integration ... }
}
```

### 연동 해제

```
DELETE /api/admin/tenant/integrations?provider=google_calendar

Response:
{ "success": true }
```

---

## OAuth Scopes

### Google Calendar

```typescript
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly'
];
```

### Google Drive

```typescript
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly'
];
```

---

## 환경 변수

```env
# Google OAuth 클라이언트 (Google Cloud Console에서 생성)
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=xxx

# 앱 URL (OAuth 콜백용)
NEXT_PUBLIC_APP_URL=https://theyool-admin.vercel.app
```

---

## Google Cloud Console 설정

### 1. OAuth 동의 화면

- **앱 이름**: SeeD (또는 서비스명)
- **사용자 유형**: 외부
- **게시 상태**: 테스트 중 (프로덕션 전)

### 2. OAuth 클라이언트

- **유형**: 웹 애플리케이션
- **승인된 리디렉션 URI**:
  - `http://localhost:3000/api/auth/callback/google` (개발)
  - `https://theyool-admin.vercel.app/api/auth/callback/google` (프로덕션)

### 3. API 활성화

- Google Calendar API
- Google Drive API

### 4. 테스트 사용자 (테스트 모드일 때)

OAuth 동의 화면 > 대상 > 테스트 사용자에 이메일 추가

---

## 핵심 함수

### lib/google-calendar.ts

```typescript
// 테넌트별 OAuth URL 생성
export async function getTenantAuthUrl(
  tenantId: string,
  provider: IntegrationProvider,
  userId: string
): Promise<string>

// State 검증
export async function validateOAuthState(state: string): Promise<{
  valid: boolean;
  tenantId?: string;
  provider?: IntegrationProvider;
  userId?: string;
  error?: string;
}>

// 테넌트 연동 정보 조회
export async function getTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider
): Promise<TenantIntegrationRecord | null>

// 테넌트 캘린더 목록 조회
export async function getTenantCalendarList(
  tenantId: string
): Promise<calendar_v3.Schema$CalendarListEntry[]>

// 연동 정보 저장/업데이트
export async function upsertTenantIntegration(
  tenantId: string,
  provider: IntegrationProvider,
  data: { ... }
): Promise<TenantIntegrationRecord | null>
```

---

## 파일 구조

```
lib/
├── google-calendar.ts        # OAuth, Calendar API 함수
├── google-calendar-sync.ts   # Calendar 동기화 로직

app/api/
├── auth/callback/google/route.ts           # OAuth 콜백
└── admin/tenant/integrations/
    ├── route.ts                            # GET/POST/DELETE
    └── [provider]/route.ts                 # GET/PUT (상세)

types/
└── integration.ts            # IntegrationProvider, TenantIntegration 타입
```

---

## 타입 정의

```typescript
// types/integration.ts

export type IntegrationProvider = 'google_calendar' | 'google_drive';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface TenantIntegration {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt?: string;
  connectedBy?: string;
  settings: Record<string, unknown>;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  accessRole?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}
```

---

## UI 컴포넌트

### 테넌트 설정 페이지

`app/admin/settings/tenant/page.tsx`

```tsx
{/* Google 연동 섹션 */}
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <h2>Google 연동</h2>

  {/* Google Calendar */}
  <IntegrationCard
    provider="google_calendar"
    status={calendarIntegration?.status}
    onConnect={handleConnect}
    onDisconnect={handleDisconnect}
  />

  {/* 캘린더 선택 (연결 후) */}
  {calendarIntegration?.status === 'connected' && (
    <CalendarSelector
      calendars={calendars}
      selected={calendarIntegration.settings.calendarId}
      onSelect={handleSelectCalendar}
    />
  )}

  {/* Google Drive */}
  <IntegrationCard
    provider="google_drive"
    status={driveIntegration?.status}
    onConnect={handleConnect}
    onDisconnect={handleDisconnect}
  />
</div>
```

---

## 트러블슈팅

### "Access blocked" 오류

**원인**: 앱이 테스트 모드이고 사용자가 테스트 사용자 목록에 없음

**해결**: Google Cloud Console > OAuth 동의 화면 > 대상 > 테스트 사용자 추가

### "redirect_uri_mismatch" 오류

**원인**: OAuth 클라이언트의 리디렉션 URI가 일치하지 않음

**해결**: Google Cloud Console > 클라이언트 > 승인된 리디렉션 URI에 정확한 URL 추가

### "server configuration" 오류

**원인**:
1. 관련 API가 활성화되지 않음
2. 환경변수 설정 오류

**해결**:
1. Google Cloud Console에서 Calendar/Drive API 활성화
2. `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` 확인

---

## 향후 계획

- [ ] Google Drive 파일 목록 조회 API
- [ ] 의뢰인별 Drive 폴더 자동 생성
- [ ] Calendar 양방향 동기화 (현재는 읽기 전용)
- [ ] 연동 상태 모니터링 대시보드
