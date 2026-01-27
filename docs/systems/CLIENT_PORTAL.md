# 의뢰인 포털 시스템

**Last Updated**: 2025-12-02

의뢰인이 자신의 사건 진행 상황을 확인할 수 있는 포털 시스템입니다.

---

## 개요

### 주요 기능

| 기능 | 설명 |
|------|------|
| **의뢰인 대시보드** | 사건 목록, 다가오는 기일 |
| **사건 상세 조회** | 기일 목록, 데드라인 현황 |
| **관리자 미리보기** | 의뢰인 화면 미리보기 |
| **카카오 로그인** | OAuth 기반 인증 |

---

## 의뢰인 포털

### 의뢰인 대시보드

- 본인의 모든 사건 목록
- 30일 이내 다가오는 재판기일
- 30일 이내 다가오는 미완료 기한

### 사건 상세

- 사건 기본 정보
- 모든 재판기일 목록
- 모든 기한 목록
- 진행 상태 확인

---

## 관리자 미리보기 API

### 의뢰인 포털 미리보기

**Endpoint**: `GET /api/admin/client-preview/[clientId]`

**응답**:
```json
{
  "client": {
    "id": "uuid",
    "name": "홍길동",
    "phone": "010-1234-5678",
    "email": "hong@example.com"
  },
  "cases": [
    {
      "id": "uuid",
      "case_name": "홍길동 v 김철수",
      "case_type": "이혼",
      "court_case_number": "2024드단12345",
      "status": "진행중"
    }
  ],
  "upcomingHearings": [
    {
      "id": "uuid",
      "case_number": "2024드단12345",
      "hearing_type": "HEARING_MAIN",
      "hearing_date": "2025-01-15T10:00:00",
      "court_name": "서울가정법원 301호"
    }
  ],
  "upcomingDeadlines": [
    {
      "id": "uuid",
      "case_number": "2024드단12345",
      "deadline_type": "DL_APPEAL",
      "deadline_date": "2025-01-10",
      "description": "상소기간"
    }
  ]
}
```

### 사건 상세 미리보기

**Endpoint**: `GET /api/admin/client-preview/[clientId]/cases/[caseId]`

**응답**:
```json
{
  "case": {
    "id": "uuid",
    "case_name": "홍길동 v 김철수",
    "case_type": "이혼",
    "court_case_number": "2024드단12345",
    "status": "진행중"
  },
  "hearings": [...],
  "deadlines": [...]
}
```

---

## 보안

### 인증

- 관리자: NextAuth (이메일/비밀번호)
- 의뢰인: 카카오 로그인 (OAuth)

### 권한 검증

- `isAuthenticated()` 체크
- `createAdminClient()` 사용 (관리자)
- UUID 형식 검증
- 사건 소유권 검증 (clientId-caseId 매칭)

### SQL Injection 방지

- Supabase Query Builder 사용
- 파라미터 바인딩

---

## 데이터 매핑

### court_hearings → API 응답

| API 필드 | DB 컬럼 | 비고 |
|----------|---------|------|
| hearing_date | hearing_date | YYYY-MM-DD HH:MM |
| hearing_time | (추출) | hearing_date에서 추출 |
| court_name | location | 법원 위치 |
| hearing_result | result | 재판 결과 |
| hearing_report | report | 재판 보고 |
| hearing_type | hearing_type | 재판 유형 |
| judge_name | judge_name | 판사명 |

### case_deadlines → API 응답

| API 필드 | DB 컬럼 | 비고 |
|----------|---------|------|
| deadline_date | deadline_date | YYYY-MM-DD |
| deadline_type | deadline_type | DL_APPEAL 등 |
| description | notes | 기한 설명 |
| is_completed | (계산) | status === 'COMPLETED' |

---

## 파일 구조

```
luseed/
├── app/
│   ├── admin/
│   │   └── client-preview/
│   │       └── [clientId]/
│   │           ├── page.tsx              # 포털 미리보기 UI
│   │           └── cases/
│   │               └── [caseId]/
│   │                   └── page.tsx      # 사건 상세 미리보기 UI
│   ├── client/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   └── cases/
│   │       └── [id]/
│   │           └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       ├── client/
│       │   ├── cases/
│       │   │   └── [id]/
│       │   │       └── files/
│       │   │           └── route.ts      # 파일 목록 API
│       │   ├── files/
│       │   │   └── [fileId]/
│       │   │       └── route.ts          # 파일 보기/다운로드 API
│       │   └── dashboard/
│       └── admin/
│           └── client-preview/
│               └── [clientId]/
│                   ├── route.ts
│                   └── cases/
│                       └── [caseId]/
│                           └── route.ts
│
├── components/
│   ├── ClientPreviewModal.tsx
│   └── client/
│       └── CaseDocuments.tsx             # 서류 목록 UI (아코디언)
│
├── types/
│   ├── client-preview.ts
│   └── case-files.ts                     # 파일 관련 타입
│
└── supabase/migrations/
    └── 20251202_add_client_visible_columns.sql
```

---

## 사용 예제

### 프론트엔드에서 사용

```typescript
import type { ClientPreviewResponse } from '@/types/client-preview';

async function fetchClientPreview(clientId: string) {
  const response = await fetch(`/api/admin/client-preview/${clientId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch client preview');
  }

  const data: ClientPreviewResponse = await response.json();

  console.log('의뢰인:', data.client.name);
  console.log('사건 수:', data.cases.length);

  return data;
}
```

### 모달 컴포넌트

```tsx
import ClientPreviewModal from '@/components/ClientPreviewModal';

function ClientManagementPage() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  return (
    <>
      <button onClick={() => setSelectedClientId(clientId)}>
        포털 미리보기
      </button>

      <ClientPreviewModal
        clientId={selectedClientId}
        isOpen={!!selectedClientId}
        onClose={() => setSelectedClientId(null)}
      />
    </>
  );
}
```

---

## 성능

### 예상 응답 시간

- 의뢰인 포털 미리보기: < 300ms (4개 쿼리)
- 사건 상세 미리보기: < 200ms (3개 쿼리)

### 쿼리 최적화

- 필요한 컬럼만 SELECT
- 적절한 인덱스 활용
- LIMIT으로 결과 제한 (최대 10건)

---

## 소송 서류 조회 시스템

### 개요

Google Drive에 업로드된 소송 서류를 의뢰인이 자동으로 조회할 수 있는 시스템입니다.

### 문서 카테고리

| 카테고리 | client_doc_type | 아이콘 | 설명 |
|----------|-----------------|--------|------|
| 의뢰인 서류 | brief_client | 📄 | 준비서면, 답변서 등 |
| 상대방 서류 | brief_defendant | 📋 | 피고측 제출 서류 |
| 증거 서류 | evidence | 📎 | 갑호증, 을호증 |
| 판결문 | judgment | ⚖️ | 판결문, 결정문 |
| 참고 서류 | third_party | 📁 | 제3자 제출 서류 |

### 공개/비공개 범위

| 폴더 | client_doc_type | 공개 여부 |
|------|-----------------|-----------|
| 01_서면 (의뢰인) | brief_client | 공개 |
| 01_서면 (상대방) | brief_defendant | 공개 |
| 02_증거/갑,을 | evidence | 공개 |
| 03_법원문서 | - | 비공개 |
| 03_법원문서 (판결/결정) | judgment | 공개 |
| 04_AI참고 | - | 비공개 |

### UI 컴포넌트 (CaseDocuments)

아코디언 스타일의 문서 목록 UI를 제공합니다.

```
┌─────────────────────────────────────────┐
│ 소송 서류                      3개 파일   │
├─────────────────────────────────────────┤
│ ▼ 📄 의뢰인 서류                    [2]  │
│   ├─ 📕 준비서면_제1회.pdf   [보기][저장] │
│   └─ 📕 답변서.pdf           [보기][저장] │
│ ▶ 📎 증거 서류                      [1]  │
└─────────────────────────────────────────┘
```

**기능:**
- 카테고리별 접기/펼치기 (아코디언)
- PDF: 새 탭에서 브라우저 뷰어로 열기
- 이미지: 모달에서 미리보기
- 기타 파일: 다운로드

### 제한 사항

- **40MB 이상 파일**: "(고용량)" 라벨 표시, 미리보기/다운로드 불가
- **법원 서류**: 판결문/결정문 제외하고 비공개

### 데이터 흐름

```
Google Drive 파일 변경
        ↓
the0 Webhook 수신 (/api/drive/webhook)
        ↓
the0 분류 동기화 (/api/drive/sync-classifications)
        ↓
drive_file_classifications 테이블 업데이트
  - client_visible: boolean (공개 여부)
  - client_doc_type: enum (문서 유형)
        ↓
luseed 클라이언트 포털에서 조회
```

### API 엔드포인트

**파일 목록 조회**

`GET /api/client/cases/[caseId]/files`

응답:
```json
{
  "files": {
    "brief_client": [
      {
        "id": "uuid",
        "fileName": "준비서면_제1회.pdf",
        "mimeType": "application/pdf",
        "fileSize": 1234567,
        "isLargeFile": false
      }
    ],
    "evidence": [...],
    "judgment": [...]
  }
}
```

**파일 보기/다운로드**

`GET /api/client/files/[fileId]?action=view` - 브라우저에서 보기
`GET /api/client/files/[fileId]?action=download` - 다운로드

### DB 스키마 (drive_file_classifications)

```sql
-- 추가된 컬럼 (20251202_add_client_visible_columns.sql)
ALTER TABLE drive_file_classifications
ADD COLUMN client_visible BOOLEAN DEFAULT false,
ADD COLUMN client_doc_type TEXT;
```

### 관련 파일

| 위치 | 설명 |
|------|------|
| `lib/google/drive-client.ts` | Google Drive API 클라이언트 |
| `app/api/client/cases/[id]/files/route.ts` | 파일 목록 API |
| `app/api/client/files/[fileId]/route.ts` | 미리보기/다운로드 API |
| `components/client/CaseDocuments.tsx` | 서류 목록 UI (아코디언) |
| `types/case-files.ts` | 타입 정의 |
| `supabase/migrations/20251202_add_client_visible_columns.sql` | DB 마이그레이션 |

---

## 향후 계획

### 우선순위: 높음

- [ ] Rate Limiting 적용
- [ ] Zod 런타임 타입 검증
- [ ] 에러 로깅 개선 (Sentry)

### 우선순위: 중간

- [ ] Redis 캐싱
- [ ] Pagination 추가
- [ ] 검색/필터링 기능

### 우선순위: 낮음

- [ ] 실시간 업데이트 (WebSocket)
- [ ] 자동화 테스트
