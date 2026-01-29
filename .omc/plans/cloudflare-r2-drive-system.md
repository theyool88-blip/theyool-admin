# Cloudflare 풀스택 마이그레이션 + R2 드라이브 시스템 구축

> **버전**: 2.0 (Cloudflare Pages 도입 포함)
> **최종 수정**: 2026-01-28
> **RALPLAN 승인**: Iteration 2 OKAY + Cloudflare Pages 추가

## 1. 요구사항 요약 (Requirements Summary)

### 1.1 비즈니스 요구사항

| 요구사항 | 설명 | 우선순위 |
|---------|------|---------|
| **Cloudflare Pages 마이그레이션** | Vercel → Cloudflare Pages 전환 (비용 절감 + 통합 에코시스템) | P0 |
| **R2 스토리지 도입** | Supabase Storage/Google Drive 의존성 제거, Cloudflare R2로 통합 | P0 |
| **테넌트별 용량 할당** | 특정 플랜 50GB 기본, 추가 30GB 유료 옵션 | P0 |
| **계층별 접근 권한** | 테넌트 회원 전체 열람, "계약서 폴더"는 회계 권한자만 | P0 |
| **드라이브 UX** | "내 컴퓨터"처럼 직관적 파일 탐색 (웹 구현) | P1 |
| **Inbox 자동화** | 파일명 자동 변경, 폴더 자동 생성/이동 (the0 참조) | P1 |
| **사건 페이지 연동** | 사건 상세/목록에서 해당 폴더 직접 접근 | P1 |
| **마스킹 제거** | 업로드 파일명 기반 "진행탭" 마스킹 해제 | P2 |

### 1.2 기술적 제약조건

- Next.js 16 + React 19
- Supabase PostgreSQL (RLS 기반 멀티테넌시) - **Hyperdrive로 연결**
- 기존 `case_contracts`, `drive_file_classifications` 테이블과 호환
- Google Drive Service Account 연동 유지 (마이그레이션 기간)
- **SCOURT 동기화: REST API 기반** (Puppeteer 불필요 - 로컬 개발용만)

### 1.3 Cloudflare 에코시스템 활용

| Cloudflare 서비스 | 용도 | 대체 대상 |
|------------------|------|----------|
| **Pages + Workers** | Next.js 호스팅 (OpenNext adapter) | Vercel |
| **R2** | 파일 스토리지 | Supabase Storage, Google Drive |
| **Images** | 이미지 리사이징/최적화 | Sharp |
| **Cron Triggers** | 스케줄링 작업 | Vercel Cron |
| **Queues** | 비동기 작업 큐 | - (신규) |
| **Hyperdrive** | Supabase PostgreSQL 연결 가속 | - (신규) |

### 1.4 예상 비용 절감

| 항목 | Vercel (현재) | Cloudflare (예상) | 절감 |
|------|--------------|-------------------|------|
| 호스팅 기본료 | $20/월 | $5/월 | **-75%** |
| 팀 멤버 추가 | $20/월/인 | 무료 | **-100%** |
| 요청 초과 | $0.60/백만 | $0.30/백만 | **-50%** |
| DDoS/WAF | 별도 | 포함 | **무료** |
| **총 예상** | ~$60-100/월 | ~$10-20/월 | **~70-80%** |

---

## 2. 아키텍처 개요 (Architecture Overview)

### 2.1 시스템 아키텍처 (Cloudflare 풀스택)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE EDGE NETWORK                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Cloudflare Pages + Workers                      │  │
│  │              Next.js 16 via @opennextjs/cloudflare                 │  │
│  │                                                                    │  │
│  │  +------------------+  +------------------+  +------------------+  │  │
│  │  | Static Assets    |  | Server Functions |  | API Routes      |  │  │
│  │  | (React, CSS, JS) |  | (SSR, ISR)       |  | (168 endpoints) |  │  │
│  │  +--------+---------+  +--------+---------+  +--------+---------+  │  │
│  └───────────|─────────────────────|─────────────────────|───────────┘  │
│              │                     │                     │              │
│  ┌───────────┴─────────────────────┴─────────────────────┴───────────┐  │
│  │                     Cloudflare Services                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │    R2    │  │  Images  │  │  Queues  │  │   Cron   │           │  │
│  │  │ 파일저장 │  │이미지최적화│  │ 비동기큐 │  │ Triggers │           │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │  │
│  └───────┴─────────────┴─────────────┴─────────────┴─────────────────┘  │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     │ Hyperdrive (Connection Pooling)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (유지)                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      PostgreSQL + Auth + RLS                       │  │
│  │  +------------------+  +------------------+  +------------------+  │  │
│  │  | r2_files         |  | r2_folders       |  | tenant_storage   |  │  │
│  │  | legal_cases      |  | tenants          |  | tenant_members   |  │  │
│  │  +------------------+  +------------------+  +------------------+  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Vercel → Cloudflare 마이그레이션 매핑

| Vercel 기능 | Cloudflare 대체 | 비고 |
|------------|----------------|------|
| Serverless Functions | Workers (via OpenNext) | 자동 변환 |
| Edge Functions | Workers (Edge) | 네이티브 |
| Vercel Cron | Cron Triggers | `wrangler.toml` 설정 |
| Image Optimization | Cloudflare Images | R2 연동 |
| Analytics | Workers Analytics | 무료 |
| Environment Variables | Secrets + Vars | `wrangler secret put` |
| Build Cache | Pages Build Cache | 자동 |

### 2.2 폴더 구조 (7레벨 계층)

```
/{tenant_id}/
  ├── inbox/                          # 미분류 파일 (Inbox)
  │   └── {uploaded_files}
  │
  ├── cases/                          # 사건별 폴더
  │   └── {case_id}/
  │       ├── 00_inbox/               # 사건 Inbox (미분류)
  │       ├── 01_서면/
  │       │   ├── 준비서면/
  │       │   └── 소장_답변서/
  │       ├── 02_증거/
  │       │   ├── 갑/
  │       │   └── 을/
  │       ├── 03_법원문서/
  │       │   ├── 송달문서/
  │       │   └── 판결_결정/
  │       ├── 04_AI참고/
  │       └── 99_기타/
  │
  ├── contracts/                      # 계약서 (회계 권한자 전용)
  │   └── {case_id}/
  │       └── {contract_files}
  │
  └── shared/                         # 공유 폴더 (테넌트 전체)
      └── templates/
```

### 2.3 접근 권한 매트릭스

| 폴더 경로 | owner | admin | lawyer | staff | client |
|-----------|-------|-------|--------|-------|--------|
| `/inbox/**` | RW | RW | RW | RW | - |
| `/cases/{담당사건}/**` | RW | RW | RW | RW | R* |
| `/cases/{미담당사건}/**` | RW | RW | - | - | - |
| `/contracts/**` | RW | RW | - | - | - |
| `/shared/**` | RW | RW | R | R | - |

*R = 읽기, W = 쓰기, R* = client_visible=true인 파일만

---

## 3. 데이터베이스 스키마 변경 (Database Schema)

### 3.1 신규 테이블

```sql
-- ============================================================================
-- 1. r2_files 테이블 (파일 메타데이터)
-- ============================================================================
CREATE TABLE IF NOT EXISTS r2_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- R2 정보
  r2_key TEXT NOT NULL,                    -- R2 object key (full path)
  r2_etag TEXT,                            -- 무결성 검증용

  -- 파일 정보
  original_name TEXT NOT NULL,             -- 원본 파일명
  display_name TEXT NOT NULL,              -- 표시 파일명 (자동 변환 후)
  mime_type TEXT,
  file_size BIGINT,

  -- 분류 정보
  folder_id UUID REFERENCES r2_folders(id),
  case_id UUID REFERENCES legal_cases(id),

  -- 자동분류 메타데이터
  doc_type VARCHAR(50),                    -- brief, evidence, court_doc, reference 등
  doc_subtype VARCHAR(50),                 -- 갑1호증, 준비서면 등
  parsed_date DATE,                        -- 파일명에서 추출한 날짜
  exhibit_number VARCHAR(20),              -- 호증 번호 (갑 제1호증 -> 갑1)

  -- 권한 제어
  is_contract BOOLEAN DEFAULT FALSE,       -- 계약서 여부 (회계 권한 필요)
  client_visible BOOLEAN DEFAULT FALSE,    -- 의뢰인 공개 여부

  -- 감사
  uploaded_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_r2_files_tenant_id ON r2_files(tenant_id);
CREATE INDEX idx_r2_files_folder_id ON r2_files(folder_id);
CREATE INDEX idx_r2_files_case_id ON r2_files(case_id);
CREATE INDEX idx_r2_files_r2_key ON r2_files(r2_key);
CREATE UNIQUE INDEX idx_r2_files_tenant_key ON r2_files(tenant_id, r2_key);

-- ============================================================================
-- 2. r2_folders 테이블 (가상 폴더 구조)
-- ============================================================================
CREATE TABLE IF NOT EXISTS r2_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 폴더 정보
  name VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,                      -- 전체 경로 (/{tenant_id}/cases/...)
  parent_id UUID REFERENCES r2_folders(id),

  -- 연결 정보
  case_id UUID REFERENCES legal_cases(id), -- 사건 폴더인 경우

  -- 권한 제어
  is_contract_folder BOOLEAN DEFAULT FALSE, -- 계약서 폴더 (회계 권한)

  -- 메타
  depth INTEGER DEFAULT 0,                  -- 폴더 깊이 (0 = root)
  display_order INTEGER DEFAULT 0,          -- 정렬 순서
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_r2_folders_tenant_id ON r2_folders(tenant_id);
CREATE INDEX idx_r2_folders_parent_id ON r2_folders(parent_id);
CREATE INDEX idx_r2_folders_case_id ON r2_folders(case_id);
CREATE UNIQUE INDEX idx_r2_folders_tenant_path ON r2_folders(tenant_id, path);

-- ============================================================================
-- 3. tenant_storage 테이블 (스토리지 할당/사용량)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 할당량
  quota_bytes BIGINT NOT NULL DEFAULT 53687091200,  -- 기본 50GB
  extra_quota_bytes BIGINT DEFAULT 0,               -- 추가 구매 용량

  -- 사용량
  used_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,

  -- 과금 정보
  extra_quota_started_at TIMESTAMPTZ,
  extra_quota_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tenant_storage UNIQUE(tenant_id)
);

-- ============================================================================
-- 4. inbox_rules 테이블 (자동분류 규칙)
-- ============================================================================
CREATE TABLE IF NOT EXISTS inbox_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 규칙 정의
  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0,              -- 높을수록 먼저 적용
  is_active BOOLEAN DEFAULT TRUE,

  -- 조건 (JSON)
  conditions JSONB NOT NULL,
  -- {
  --   "filename_pattern": "갑.*호증",
  --   "mime_types": ["application/pdf"],
  --   "size_min": 0,
  --   "size_max": 52428800
  -- }

  -- 액션 (JSON)
  actions JSONB NOT NULL,
  -- {
  --   "target_folder": "/cases/{case_id}/02_증거/갑/",
  --   "rename_pattern": "갑 제{exhibit_num}호증 {description}.{ext}",
  --   "doc_type": "evidence",
  --   "client_visible": true
  -- }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 기존 테이블 수정

```sql
-- tenants.features 확장
UPDATE tenants
SET features = features || '{
  "storageEnabled": true,
  "maxStorageGB": 50,
  "inboxAutomation": true
}'::jsonb;

-- legal_cases에 r2 폴더 참조 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS r2_folder_id UUID REFERENCES r2_folders(id);

-- drive_file_classifications에 r2_file_id 참조 추가 (마이그레이션 Phase 1)
ALTER TABLE drive_file_classifications
ADD COLUMN IF NOT EXISTS r2_file_id UUID REFERENCES r2_files(id);
```

### 3.3 RLS 정책

```sql
-- r2_files: 테넌트 격리 + 계약서 권한
CREATE POLICY "r2_files_tenant_isolation" ON r2_files
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND
     (NOT is_contract OR has_accounting_permission()))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND
     (NOT is_contract OR has_accounting_permission()))
  );

-- r2_folders: 테넌트 격리 + 계약서 폴더 권한
CREATE POLICY "r2_folders_tenant_isolation" ON r2_folders
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND
     (NOT is_contract_folder OR has_accounting_permission()))
  );

-- has_accounting_permission 함수 (DB-level RLS용)
-- NOTE: 이 함수는 기존 RLS 패턴(is_super_admin, has_role_or_higher)을 따름
-- API 레벨에서는 lib/auth/permissions.ts의 canAccessAccounting()을 사용
-- 동기화 테스트 필수: Section 15 참조
CREATE OR REPLACE FUNCTION has_accounting_permission()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
    AND tenant_id = get_current_tenant_id()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Permission System 설계 노트:**

| 레이어 | 구현체 | 용도 |
|--------|--------|------|
| DB RLS | `has_accounting_permission()` SQL function | Row-level security (Supabase 직접 쿼리 시) |
| API | `canAccessAccounting()` in `lib/auth/permissions.ts` | API route 권한 검증 |

두 구현체는 동일한 로직을 유지해야 함: `role IN ('owner', 'admin')` = `FULL_ACCESS_ROLES.includes(role)`

---

## 4. Cloudflare R2 설정 (R2 Configuration)

### 4.1 버킷 구성

```
Bucket Name: luseed-files
Region: APAC (Asia Pacific)
Public Access: Disabled (presigned URLs only)
```

### 4.2 CORS 설정

```json
[
  {
    "AllowedOrigins": [
      "https://luseed.kr",
      "https://*.luseed.kr",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### 4.3 환경변수

```env
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=luseed-files
R2_PUBLIC_URL=https://files.luseed.kr  # 선택: CDN 연동 시

# Presigned URL 설정
R2_UPLOAD_URL_EXPIRY=3600      # 1시간
R2_DOWNLOAD_URL_EXPIRY=300     # 5분

# Gemini AI (자동분류 fallback)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### 4.4 Presigned URL 전략

| 작업 | URL 유형 | 만료 시간 | 용도 |
|------|---------|-----------|------|
| 업로드 | PUT | 1시간 | 클라이언트 직접 업로드 |
| 다운로드 | GET | 5분 | 파일 다운로드 |
| 미리보기 | GET | 15분 | PDF/이미지 뷰어 |
| 대용량 업로드 | Multipart | 24시간 | 100MB 이상 파일 |

---

## 5. 구현 단계 (Implementation Steps)

> **참고**: Phase 0과 Phase 1-5는 동시에 진행합니다.

---

### Phase 0: Cloudflare 인프라 마이그레이션 (Week 1-2, Phase 1과 병행)

#### Task 0.1: OpenNext Adapter 설치 및 설정
**파일**: `package.json`, `wrangler.toml`, `open-next.config.ts`

```bash
# 설치
npm install @opennextjs/cloudflare

# 빌드 스크립트 추가
# package.json scripts에 추가:
# "build:cloudflare": "npx @opennextjs/cloudflare"
```

**wrangler.toml 생성**:
```toml
name = "luseed"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Pages 설정
pages_build_output_dir = ".open-next"

# R2 바인딩 (Phase 1에서 추가)
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "luseed-files"

# Hyperdrive 바인딩 (Supabase 연결)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-config-id>"

# Cron Triggers (Vercel Cron 대체)
[triggers]
crons = [
  "0 0 * * *",      # daily-reminders
  "*/10 * * * *",   # scourt-sync-scheduler
  "*/2 * * * *",    # scourt-sync-worker
  "* * * * *"       # batch-import-worker
]
```

**Acceptance Criteria**:
- [ ] `npx @opennextjs/cloudflare` 빌드 성공
- [ ] `npx wrangler dev` 로컬 실행 성공
- [ ] 모든 168개 API 라우트 정상 동작

#### Task 0.2: Hyperdrive 설정 (Supabase 연결 가속)
**명령어**:
```bash
# Hyperdrive 설정 생성
npx wrangler hyperdrive create luseed-db \
  --connection-string="postgres://user:pass@db.xxx.supabase.co:5432/postgres"
```

**Supabase 연결 수정** (`lib/supabase/server.ts`):
```typescript
// 기존: 직접 연결
// 신규: Hyperdrive 통한 연결 (Workers 환경에서)
import { createClient } from '@supabase/supabase-js'

export function createServerClient(env?: { HYPERDRIVE?: Hyperdrive }) {
  // Cloudflare Workers 환경
  if (env?.HYPERDRIVE) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: {
          connectionString: env.HYPERDRIVE.connectionString
        }
      }
    )
  }
  // 기존 로직 (로컬 개발)
  return createClient(/* ... */)
}
```

**Acceptance Criteria**:
- [ ] Hyperdrive 연결 테스트 통과
- [ ] 쿼리 레이턴시 개선 확인 (목표: -30% 이상)

#### Task 0.3: 환경변수 마이그레이션
**Vercel → Cloudflare Secrets 이전**:
```bash
# 환경변수를 Cloudflare Secrets으로 이전
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
npx wrangler secret put GEMINI_API_KEY
# ... 기타 환경변수
```

**Acceptance Criteria**:
- [ ] 모든 환경변수 Cloudflare에 등록
- [ ] 프로덕션 빌드에서 환경변수 접근 확인

#### Task 0.4: Sharp → Cloudflare Images 전환
**기존 파일**: `app/api/admin/homepage/upload/route.ts`

**변경 전 (Sharp)**:
```typescript
import sharp from 'sharp';
const optimized = await sharp(buffer)
  .resize(1920, null, { withoutEnlargement: true })
  .webp({ quality: 80 })
  .toBuffer();
```

**변경 후 (Cloudflare Images)**:
```typescript
// Cloudflare Images 변환 URL 사용
const imageUrl = `https://imagedelivery.net/${ACCOUNT_HASH}/${imageId}/w=1920,format=webp,quality=80`;

// 또는 R2 + Image Resizing 조합
// R2에 원본 저장 → 요청 시 Image Resizing 적용
```

**open-next.config.ts**:
```typescript
import type { OpenNextConfig } from '@opennextjs/cloudflare';

export default {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      // Cloudflare Images를 Next.js Image Optimization 대체로 사용
      imageLoader: 'cloudflare',
    },
  },
} satisfies OpenNextConfig;
```

**Acceptance Criteria**:
- [ ] 이미지 업로드 → R2 저장 성공
- [ ] 이미지 리사이징/WebP 변환 정상 동작
- [ ] Sharp 의존성 제거 후 빌드 성공

#### Task 0.5: Vercel Cron → Cloudflare Cron Triggers 전환
**기존 (`vercel.json`)**:
```json
{
  "crons": [
    { "path": "/api/cron/daily-reminders", "schedule": "0 0 * * *" },
    { "path": "/api/cron/scourt-sync-scheduler", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/scourt-sync-worker", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/batch-import-worker", "schedule": "* * * * *" }
  ]
}
```

**신규 Cron Handler** (`app/api/cron/_scheduled.ts`):
```typescript
// Cloudflare Workers scheduled handler
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;

    switch (cron) {
      case '0 0 * * *':
        await fetch(`${env.SITE_URL}/api/cron/daily-reminders`);
        break;
      case '*/10 * * * *':
        await fetch(`${env.SITE_URL}/api/cron/scourt-sync-scheduler`);
        break;
      case '*/2 * * * *':
        await fetch(`${env.SITE_URL}/api/cron/scourt-sync-worker`);
        break;
      case '* * * * *':
        await fetch(`${env.SITE_URL}/api/cron/batch-import-worker`);
        break;
    }
  },
};
```

**Acceptance Criteria**:
- [ ] 4개 Cron 작업 모두 Cloudflare에서 실행 확인
- [ ] 로그/모니터링 설정
- [ ] `vercel.json` 삭제 후 정상 동작

#### Task 0.6: DNS 및 도메인 설정 (선택)
**시나리오 A: Cloudflare DNS 사용 중**
```bash
# Pages에 도메인 연결만 하면 됨
npx wrangler pages project create luseed
# Cloudflare Dashboard에서 Custom Domain 추가
```

**시나리오 B: 다른 DNS 사용 중**
```bash
# CNAME 레코드 추가 필요
# @ CNAME luseed.pages.dev
```

**Acceptance Criteria**:
- [ ] 커스텀 도메인 연결 완료
- [ ] HTTPS 인증서 자동 발급 확인
- [ ] 기존 URL에서 정상 접근

#### Task 0.7: 배포 파이프라인 설정
**GitHub Actions → Cloudflare Pages 연동**:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build:cloudflare
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: luseed
          directory: .open-next
```

**Acceptance Criteria**:
- [ ] main 브랜치 푸시 시 자동 배포
- [ ] Preview 배포 (PR별) 동작
- [ ] 롤백 가능 확인

---

### Phase 1: R2 기반 인프라 (Week 1-2, Phase 0과 병행)

#### Task 1.1: R2 클라이언트 구현
**파일**: `lib/r2/r2-client.ts`

```typescript
// S3-compatible client for Cloudflare R2
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// 기능:
// - 싱글톤 S3Client 인스턴스
// - Presigned URL 생성 (upload/download)
// - 파일 삭제
// - 폴더 목록 조회 (prefix-based)
// - Multipart upload 지원
```

**Acceptance Criteria**:
- [ ] S3Client 초기화 및 연결 테스트 통과
- [ ] Presigned URL로 파일 업로드/다운로드 성공
- [ ] 100MB 파일 Multipart 업로드 성공

#### Task 1.2: 데이터베이스 마이그레이션
**파일**: `supabase/migrations/20260128_r2_storage_schema.sql`

```sql
-- r2_files, r2_folders, tenant_storage, inbox_rules 테이블 생성
-- RLS 정책 설정
-- has_accounting_permission 함수 생성
-- drive_file_classifications.r2_file_id 컬럼 추가
```

**Acceptance Criteria**:
- [ ] 마이그레이션 성공 (supabase db push)
- [ ] RLS 정책 테스트 통과
- [ ] 회계 권한 없는 사용자가 contracts 폴더 접근 불가
- [ ] Permission sync 테스트 통과 (Section 15.1 참조)

#### Task 1.3: 스토리지 서비스 레이어
**파일**: `lib/r2/storage-service.ts`

```typescript
// 고수준 스토리지 API
export class StorageService {
  // 파일 CRUD
  async uploadFile(tenantId, folderId, file, options)
  async downloadFile(tenantId, fileId)
  async deleteFile(tenantId, fileId)
  async moveFile(tenantId, fileId, targetFolderId)

  // 폴더 CRUD
  async createFolder(tenantId, parentId, name)
  async deleteFolder(tenantId, folderId)
  async listFolder(tenantId, folderId)

  // 용량 관리
  async getStorageUsage(tenantId)
  async checkQuota(tenantId, additionalBytes)
}
```

**Acceptance Criteria**:
- [ ] 모든 CRUD 작업 정상 동작
- [ ] tenant_storage 사용량 자동 갱신
- [ ] 용량 초과 시 업로드 차단

---

### Phase 2: API 레이어 (Week 2-3)

#### Task 2.1: 파일 업로드 API
**파일**: `app/api/drive/upload/route.ts`

```typescript
// POST /api/drive/upload
// - FormData 또는 presigned URL 반환
// - 용량 체크
// - 파일 메타데이터 저장
// - Inbox 규칙 자동 적용
```

#### Task 2.2: 파일 다운로드/미리보기 API
**파일**: `app/api/drive/files/[id]/route.ts`

```typescript
// GET /api/drive/files/[id]?action=download|preview
// - presigned URL 생성
// - 권한 검증 (회계 권한, 담당 사건)
// - 의뢰인 접근 시 client_visible 체크
```

#### Task 2.3: 폴더 관리 API
**파일**: `app/api/drive/folders/route.ts`

```typescript
// GET  /api/drive/folders?parentId=xxx - 폴더 목록
// POST /api/drive/folders - 폴더 생성
// PUT  /api/drive/folders/[id] - 이름 변경
// DELETE /api/drive/folders/[id] - 폴더 삭제
```

#### Task 2.4: Inbox 자동분류 API
**파일**: `app/api/inbox/classify/route.ts`

```typescript
// POST /api/inbox/classify
// 1. 파일명 파싱 (Section 13 참조)
// 2. 규칙 기반 분류 (70-80% 목표)
// 3. AI 분류 fallback (20-30%) - Gemini 2.5 Flash
// 4. 자동 파일명 변환
// 5. 대상 폴더로 이동
```

**Gemini AI 분류 구현 요구사항** (Task 2.4.1):
- [ ] API 키 관리: 환경변수 `GEMINI_API_KEY` 사용, 하드코딩 금지
- [ ] Rate limiting: 분당 60 requests 제한, 초과 시 429 반환
- [ ] Error handling:
  - 401 (Invalid key): 로그 + 규칙 기반 fallback
  - 429 (Rate limit): 지수 백오프 재시도 (최대 3회)
  - 500 (Server error): 규칙 기반 fallback + 에러 리포트
  - Timeout (30초): 규칙 기반 fallback
- [ ] Cost tracking: 월별 API 호출 수 + 토큰 사용량 기록
- [ ] Fallback 체인: Gemini 실패 시 -> 규칙 기반 분류 -> 미분류(00_inbox)

**Acceptance Criteria**:
- [ ] 모든 API 엔드포인트 통합 테스트 통과
- [ ] 에러 핸들링 및 rate limiting 적용
- [ ] 의뢰인 포털 호환성 유지
- [ ] Gemini API 에러 시 graceful degradation 확인

---

### Phase 3: UI 컴포넌트 (Week 3-4)

#### Task 3.1: 파일 탐색기 컴포넌트
**파일**: `components/drive/FileExplorer.tsx`

```typescript
// 기능:
// - 트리 네비게이션 (좌측 사이드바)
// - 파일/폴더 그리드/리스트 뷰
// - 드래그앤드롭 업로드
// - 컨텍스트 메뉴 (복사, 이동, 삭제, 이름변경)
// - 빵가루 네비게이션
// - 검색 필터
```

#### Task 3.2: Inbox 패널
**파일**: `components/drive/InboxPanel.tsx`

```typescript
// 기능:
// - 미분류 파일 목록
// - 자동분류 미리보기
// - 수동 분류 (드래그앤드롭)
// - 일괄 처리
```

#### Task 3.3: 사건 페이지 통합
**파일**: `components/CaseDetail.tsx` (수정)

```typescript
// 변경사항:
// - "파일" 탭 추가
// - 해당 사건 폴더 바로가기
// - 간소화된 파일 목록 (임베디드)
```

#### Task 3.4: 스토리지 대시보드
**파일**: `components/drive/StorageDashboard.tsx`

```typescript
// 기능:
// - 사용량/할당량 프로그레스 바
// - 추가 용량 구매 CTA
// - 파일 유형별 사용량 차트
```

**Acceptance Criteria**:
- [ ] 웹 드라이브 UX 테스트 (3명 사용자) - Section 15.4 참조
- [ ] 모바일 반응형 지원
- [ ] 다크모드 호환

---

### Phase 4: 마스킹 제거 연동 (Week 4 - Phase 2/3과 병행 가능)

> **NOTE**: Phase 4는 Phase 2/3와 독립적이므로 병렬 진행 가능

#### Task 4.1: 파일명 기반 마스킹 해제
**파일**: `lib/r2/party-name-resolver.ts`

```typescript
// 파일명에서 당사자 정보 추출
// - "갑 제1호증 홍길동_진술서.pdf" -> 홍길동
// - "20251126_준비서면(피고 김철수).pdf" -> 김철수

// ScourtGeneralInfoXml 연동
// - r2_files에서 파일명 조회
// - case_parties.scourt_party_index 매칭
// - 마스킹된 이름 치환
```

#### Task 4.2: 진행탭 마스킹 해제 강화
**파일**: `components/scourt/ScourtGeneralInfoXml.tsx` (수정)

```typescript
// substitutePartyListNames 함수 개선
// 4순위 fallback 추가:
// - r2_files 파일명에서 추출한 이름 사용
```

---

### Phase 5: 마이그레이션 (Week 5)

#### Task 5.1: Supabase Storage -> R2 마이그레이션
**파일**: `scripts/migrate-supabase-to-r2.ts`

```typescript
// 1. case_contracts 테이블 순회
// 2. Supabase Storage에서 다운로드
// 3. R2에 업로드
// 4. r2_files 레코드 생성
// 5. 원본 삭제 (선택적)
```

#### Task 5.2: drive_file_classifications 마이그레이션
**파일**: `scripts/migrate-classifications-to-r2.ts`

**상세 계획: Section 14 참조**

```typescript
// Phase 1: Dual-write 설정
// Phase 2: 기존 데이터 마이그레이션
// Phase 3: Client Portal 전환
```

#### Task 5.3: Google Drive -> R2 마이그레이션 (선택)
**파일**: `scripts/migrate-gdrive-to-r2.ts`

```typescript
// drive_file_classifications 순회
// Google Drive API로 다운로드
// R2 업로드 + 메타데이터 이관
```

**Acceptance Criteria**:
- [ ] 모든 기존 파일 마이그레이션 완료
- [ ] 무결성 검증 (파일 크기, ETag)
- [ ] 롤백 스크립트 준비

---

## 6. API 엔드포인트 (API Endpoints)

### 6.1 드라이브 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/drive/folders` | 폴더 목록 |
| POST | `/api/drive/folders` | 폴더 생성 |
| PUT | `/api/drive/folders/[id]` | 폴더 수정 |
| DELETE | `/api/drive/folders/[id]` | 폴더 삭제 |
| GET | `/api/drive/files` | 파일 목록 (폴더 내) |
| POST | `/api/drive/upload` | 업로드 URL 요청 |
| POST | `/api/drive/upload/complete` | 업로드 완료 처리 |
| GET | `/api/drive/files/[id]` | 파일 상세/다운로드 |
| PUT | `/api/drive/files/[id]` | 파일 수정 (이름, 폴더) |
| DELETE | `/api/drive/files/[id]` | 파일 삭제 |
| POST | `/api/drive/files/[id]/move` | 파일 이동 |

### 6.2 Inbox API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/inbox` | Inbox 파일 목록 |
| POST | `/api/inbox/classify` | 자동분류 실행 |
| POST | `/api/inbox/move` | 수동 이동 |
| GET | `/api/inbox/rules` | 규칙 목록 |
| POST | `/api/inbox/rules` | 규칙 생성 |

### 6.3 스토리지 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/storage/usage` | 사용량 조회 |
| POST | `/api/storage/purchase` | 추가 용량 구매 |

---

## 7. UI 컴포넌트 (Frontend Components)

### 7.1 신규 컴포넌트

| 컴포넌트 | 경로 | 설명 |
|---------|------|------|
| `FileExplorer` | `components/drive/FileExplorer.tsx` | 메인 파일 탐색기 |
| `FolderTree` | `components/drive/FolderTree.tsx` | 좌측 폴더 트리 |
| `FileGrid` | `components/drive/FileGrid.tsx` | 파일 그리드 뷰 |
| `FileList` | `components/drive/FileList.tsx` | 파일 리스트 뷰 |
| `FileUploader` | `components/drive/FileUploader.tsx` | 드래그앤드롭 업로더 |
| `InboxPanel` | `components/drive/InboxPanel.tsx` | Inbox 관리 패널 |
| `StorageDashboard` | `components/drive/StorageDashboard.tsx` | 용량 대시보드 |
| `FilePreview` | `components/drive/FilePreview.tsx` | 파일 미리보기 모달 |

### 7.2 수정할 컴포넌트

| 컴포넌트 | 수정 내용 |
|---------|----------|
| `CaseDetail.tsx` | "파일" 탭 추가, 폴더 바로가기 |
| `CasesList.tsx` | 파일 개수 컬럼 추가 |
| `AdminSidebar.tsx` | "드라이브" 메뉴 추가 |
| `ScourtGeneralInfoXml.tsx` | 마스킹 해제 fallback 강화 |

### 7.3 신규 페이지

| 페이지 | 경로 | 설명 |
|-------|------|------|
| 드라이브 | `app/(admin)/drive/page.tsx` | 파일 탐색기 메인 |
| 스토리지 설정 | `app/(admin)/settings/storage/page.tsx` | 용량 관리 |

---

## 8. 마이그레이션 전략 (Migration Strategy)

### 8.1 단계별 마이그레이션

| 단계 | 대상 | 전략 | 예상 시간 |
|------|------|------|----------|
| 1 | case_contracts (Supabase) | 자동 스크립트 | 1시간 |
| 2 | drive_file_classifications | Phased migration (Section 14) | 1-2일 |
| 3 | 실제 Drive 파일 | 수동/배치 (선택) | 테넌트당 1-4시간 |

### 8.2 롤백 계획

1. `r2_files` 테이블에 `migrated_from` 컬럼 추가
2. 원본 삭제는 마이그레이션 완료 7일 후
3. 롤백 스크립트: `scripts/rollback-to-supabase.ts`

### 8.3 듀얼 라이트 기간

- **기간**: 2주
- **동작**: 새 업로드는 R2만, 기존 파일은 원본 위치에서 서빙
- **전환**: 마이그레이션 완료 후 R2 전용 모드 활성화

---

## 9. 성공 기준 (Acceptance Criteria)

### 9.1 기능적 기준

- [ ] 파일 업로드/다운로드 성공률 99.9% 이상
- [ ] Inbox 자동분류 정확도 70% 이상 (규칙 기반)
- [ ] 계약서 폴더 접근 권한 100% 정확
- [ ] 마이그레이션 데이터 무결성 100%

### 9.2 성능 기준

- [ ] 50MB 파일 업로드 < 30초
- [ ] 폴더 목록 조회 < 500ms
- [ ] Presigned URL 생성 < 100ms

### 9.3 UX 기준

- [ ] 사용자 테스트 만족도 4.0/5.0 이상
- [ ] 모바일 사용 가능 (반응형)
- [ ] 키보드 네비게이션 지원

---

## 10. 리스크 및 완화 (Risk Mitigation)

| 리스크 | 영향 | 확률 | 완화 전략 |
|--------|------|------|----------|
| R2 API 제한 초과 | 높음 | 낮음 | Rate limiting, 백오프 재시도 |
| 대용량 파일 업로드 실패 | 중간 | 중간 | Multipart upload, 재개 가능한 업로드 |
| 마이그레이션 중 데이터 손실 | 높음 | 낮음 | 원본 보존, 무결성 검증, 롤백 스크립트 |
| 권한 설정 오류 | 높음 | 중간 | RLS 테스트 케이스, 감사 로그 |
| 용량 계산 불일치 | 낮음 | 중간 | 주기적 재계산 cron job |
| Gemini API 비용 초과 | 중간 | 중간 | 규칙 기반 우선, AI는 fallback만 |

---

## 11. 타임라인 요약

> **참고**: Phase 0과 Phase 1-5는 동시에 진행합니다.

| 주차 | 작업 | 담당 |
|------|------|------|
| Week 1-2 | **Phase 0**: Cloudflare 인프라 (OpenNext, Hyperdrive, Cron) | DevOps |
| Week 1-2 | Phase 1: R2 클라이언트, DB 스키마, 서비스 레이어 | Backend |
| Week 2-3 | Phase 2: API 엔드포인트 구현 | Backend |
| Week 3-4 | Phase 3: UI 컴포넌트 개발 | Frontend |
| Week 2-4 | Phase 4: 마스킹 해제 연동 (병렬) | Backend |
| Week 5 | Phase 5: 마이그레이션 실행 (Vercel → Cloudflare 전환 포함) | DevOps |

### 11.1 Phase 0 상세 일정

| 일차 | 작업 | 검증 |
|------|------|------|
| Day 1 | OpenNext 설치, wrangler.toml 생성 | 로컬 빌드 성공 |
| Day 2 | Hyperdrive 설정, Supabase 연결 | 쿼리 테스트 통과 |
| Day 3 | 환경변수 마이그레이션, Secrets 등록 | 프로덕션 빌드 성공 |
| Day 4-5 | Sharp → Images 전환, Cron Triggers 설정 | 이미지 처리 + Cron 테스트 |
| Day 6-7 | DNS 설정, 배포 파이프라인 구축 | Preview 배포 성공 |

---

## 12. 관련 문서

- the0 Inbox 자동화: Section 13 (Inline Reference)
- 기존 파일 시스템: `/docs/systems/SCOURT_INTEGRATION.md`
- 권한 시스템: `/lib/auth/permissions.ts`
- 당사자 마스킹: `/docs/archived/summaries/PARTY_MASKING_FIX.md`

---

## 13. the0 Inbox 자동화 상세 (Inline Reference)

> 외부 문서 참조 대신 핵심 로직을 직접 기술

### 13.1 분류 우선순위

| 순위 | 방식 | 예상 매칭률 | 설명 |
|------|------|------------|------|
| 1 | 규칙 기반 파일명 패턴 매칭 | 70-80% | 정규식 + 키워드 매칭 |
| 2 | AI 분류 (Gemini 2.5 Flash) | 20-30% | 규칙 실패 시 fallback |
| 3 | 미분류 (00_inbox) | - | AI도 실패 시 |

### 13.2 폴더 계층 구조

```
{case_id}/
├── 00_inbox/           # 미분류 (자동분류 실패 시)
├── 01_서면/
│   ├── 준비서면/
│   └── 소장_답변서/
├── 02_증거/
│   ├── 갑/             # 원고측 증거
│   └── 을/             # 피고측 증거
│       ├── 을가/       # 다수 피고 시
│       └── 을나/
├── 03_법원문서/
│   ├── 송달문서/
│   └── 판결_결정/
├── 04_AI참고/          # AI 분석용 참고자료
└── 99_기타/            # 기타 문서
```

### 13.3 파일명 파싱 규칙 (한국 전자소송 기준)

#### 13.3.1 파일명 패턴

| 패턴 | 예시 | 추출 필드 |
|------|------|----------|
| 사건번호 | `2024가합12345_` | case_number |
| 날짜 | `20260115_` | parsed_date |
| 문서유형 | `준비서면`, `답변서`, `판결문` | doc_type |
| 증거번호 | `갑 제1호증`, `을가2-1` | exhibit_number |
| 제출자 | `(피고 김철수)`, `_홍길동_` | submitter |

#### 13.3.2 정규식 패턴

```typescript
const PATTERNS = {
  // 사건번호: 2024가합12345, 2024나98765
  caseNumber: /(\d{4}[가-힣]{1,3}\d{3,6})/,

  // 날짜: 20260115, 2026-01-15
  date: /(\d{8})|(\d{4}-\d{2}-\d{2})/,

  // 증거번호: 갑 제1호증, 갑1, 을가2-1, 을나2-2
  exhibit: /([갑을])(?:가|나)?(?:\s*제?\s*)?(\d+)(?:-(\d+))?(?:호증)?/,

  // 문서유형
  docType: {
    brief: /준비서면|답변서|소장|항소이유서/,
    evidence: /호증|증거|자료/,
    courtDoc: /판결|결정|명령|조서|송달/,
  },

  // 제출자: (피고 김철수), 홍길동_진술서
  submitter: /\((?:원고|피고|제3자)?\s*([가-힣]{2,4})\)|_([가-힣]{2,4})_/,
};
```

#### 13.3.3 다수당사자 증거 패턴

| 패턴 | 의미 | 대상 폴더 |
|------|------|----------|
| `갑1`, `갑 제1호증` | 원고 증거 #1 | `02_증거/갑/` |
| `을1`, `을 제1호증` | 피고 증거 #1 (단일 피고) | `02_증거/을/` |
| `을가1` | 피고 가 증거 #1 | `02_증거/을/을가/` |
| `을나2-1` | 피고 나 증거 #2-1 (첨부) | `02_증거/을/을나/` |

### 13.4 자동 파일명 변환 규칙

| 입력 | 출력 | 설명 |
|------|------|------|
| `20260115_2024가합12345_갑1.pdf` | `갑 제1호증.pdf` | 정규화 |
| `준비서면(원고).hwp` | `준비서면_원고_20260115.hwp` | 날짜 추가 |
| `untitled.pdf` | AI 분류 → 적절한 이름 | AI fallback |

### 13.5 분류 로직 흐름

```typescript
async function classifyFile(file: R2File): Promise<ClassificationResult> {
  // Step 1: 파일명에서 정보 추출
  const parsed = parseFilename(file.original_name);

  // Step 2: 규칙 기반 매칭 시도
  const ruleMatch = await matchRules(file.tenant_id, parsed);
  if (ruleMatch.confidence >= 0.7) {
    return {
      doc_type: ruleMatch.doc_type,
      target_folder: ruleMatch.target_folder,
      display_name: ruleMatch.display_name,
      method: 'rule',
    };
  }

  // Step 3: AI 분류 fallback
  const aiResult = await classifyWithGemini(file);
  if (aiResult.confidence >= 0.5) {
    return {
      doc_type: aiResult.doc_type,
      target_folder: aiResult.target_folder,
      display_name: aiResult.suggested_name,
      method: 'ai',
    };
  }

  // Step 4: 미분류
  return {
    doc_type: null,
    target_folder: `${file.case_id}/00_inbox/`,
    display_name: file.original_name,
    method: 'unclassified',
  };
}
```

---

## 14. drive_file_classifications 마이그레이션 상세

### 14.1 현황 분석

**현재 테이블 구조** (`drive_file_classifications`):
- `id`: UUID
- `drive_file_id`: Google Drive 파일 ID
- `file_name`: 파일명
- `folder_path`: Drive 폴더 경로
- `case_id`: 사건 UUID
- `client_visible`: 의뢰인 공개 여부
- `client_doc_type`: 문서 유형 (brief_client, brief_defendant, evidence, third_party, judgment)

**영향받는 파일** (10개):
1. `app/api/client/cases/[id]/files/route.ts`
2. `app/api/client/files/[fileId]/route.ts`
3. `types/case-files.ts`
4. `docs/systems/CLIENT_PORTAL.md`
5. `scripts/add-client-visible-columns.ts`
6. 마이그레이션 백업 파일들

### 14.2 필드 매핑

| drive_file_classifications | r2_files | 변환 규칙 |
|---------------------------|----------|----------|
| `drive_file_id` | - | 삭제 (R2 key로 대체) |
| `file_name` | `display_name` | 직접 복사 |
| `folder_path` | `r2_key` | 경로 재구성 |
| `case_id` | `case_id` | 직접 복사 |
| `client_visible` | `client_visible` | 직접 복사 |
| `client_doc_type` | `doc_type` | 매핑 필요 (아래 참조) |

**client_doc_type -> doc_type 매핑**:

| 기존 (client_doc_type) | 신규 (doc_type) |
|----------------------|----------------|
| `brief_client` | `brief` |
| `brief_defendant` | `brief` |
| `evidence` | `evidence` |
| `third_party` | `reference` |
| `judgment` | `court_doc` |

### 14.3 마이그레이션 Phase

#### Phase 1: Dual-Write 설정 (Week 5 Day 1)

```sql
-- drive_file_classifications에 r2_file_id 컬럼 추가
ALTER TABLE drive_file_classifications
ADD COLUMN r2_file_id UUID REFERENCES r2_files(id);

-- 인덱스 추가
CREATE INDEX idx_dfc_r2_file_id ON drive_file_classifications(r2_file_id);
```

```typescript
// lib/r2/dual-write.ts
export async function dualWriteFile(params: {
  r2File: R2FileInsert;
  driveLegacy?: {
    driveFileId: string;
    folderPath: string;
  };
}): Promise<{ r2FileId: string; classificationId?: string }> {
  // 1. r2_files에 삽입
  const { data: r2File } = await supabase
    .from('r2_files')
    .insert(params.r2File)
    .select()
    .single();

  // 2. drive_file_classifications에 참조 추가 (선택적)
  if (params.driveLegacy) {
    await supabase
      .from('drive_file_classifications')
      .insert({
        drive_file_id: params.driveLegacy.driveFileId,
        folder_path: params.driveLegacy.folderPath,
        case_id: params.r2File.case_id,
        client_visible: params.r2File.client_visible,
        client_doc_type: mapDocType(params.r2File.doc_type),
        r2_file_id: r2File.id,  // 새 컬럼
      });
  }

  return { r2FileId: r2File.id };
}
```

#### Phase 2: 기존 데이터 마이그레이션 (Week 5 Day 2-3)

```typescript
// scripts/migrate-classifications-to-r2.ts

const DOC_TYPE_MAPPING = {
  brief_client: 'brief',
  brief_defendant: 'brief',
  evidence: 'evidence',
  third_party: 'reference',
  judgment: 'court_doc',
} as const;

async function migrateClassifications() {
  // 1. 기존 레코드 조회
  const { data: classifications } = await supabase
    .from('drive_file_classifications')
    .select('*')
    .is('r2_file_id', null);  // 아직 마이그레이션 안 된 것만

  for (const classification of classifications) {
    // 2. Google Drive에서 파일 다운로드
    const fileContent = await downloadFromGoogleDrive(classification.drive_file_id);

    // 3. R2에 업로드
    const r2Key = buildR2Key(classification);
    await uploadToR2(r2Key, fileContent);

    // 4. r2_files 레코드 생성
    const { data: r2File } = await supabase
      .from('r2_files')
      .insert({
        tenant_id: classification.tenant_id,
        r2_key: r2Key,
        original_name: classification.file_name,
        display_name: classification.file_name,
        case_id: classification.case_id,
        doc_type: DOC_TYPE_MAPPING[classification.client_doc_type] || 'reference',
        client_visible: classification.client_visible,
        migrated_from: 'drive_file_classifications',
      })
      .select()
      .single();

    // 5. 참조 업데이트
    await supabase
      .from('drive_file_classifications')
      .update({ r2_file_id: r2File.id })
      .eq('id', classification.id);

    console.log(`Migrated: ${classification.file_name}`);
  }
}
```

#### Phase 3: Client Portal 전환 (Week 5 Day 4-5)

**수정 파일: `app/api/client/cases/[id]/files/route.ts`**

```typescript
// 기존: drive_file_classifications만 조회
// 신규: r2_files 우선, fallback으로 drive_file_classifications

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;

  // 1. r2_files에서 먼저 조회
  const { data: r2Files } = await supabase
    .from('r2_files')
    .select('*')
    .eq('case_id', caseId)
    .eq('client_visible', true);

  if (r2Files && r2Files.length > 0) {
    // R2 기반 응답
    return NextResponse.json({
      success: true,
      files: groupR2FilesByDocType(r2Files),
      source: 'r2',
    });
  }

  // 2. Fallback: drive_file_classifications
  const { data: legacyFiles } = await supabase
    .from('drive_file_classifications')
    .select('*')
    .eq('case_id', caseId)
    .eq('client_visible', true);

  return NextResponse.json({
    success: true,
    files: groupFilesByDocType(legacyFiles || []),
    source: 'legacy',
  });
}
```

### 14.4 롤백 계획

```sql
-- 롤백 시: r2_file_id로 역추적하여 r2_files 삭제
DELETE FROM r2_files
WHERE id IN (
  SELECT r2_file_id FROM drive_file_classifications
  WHERE r2_file_id IS NOT NULL
);

-- r2_file_id 컬럼 삭제
ALTER TABLE drive_file_classifications
DROP COLUMN r2_file_id;
```

### 14.5 Acceptance Criteria

- [ ] Phase 1: 새 업로드가 양쪽 테이블에 정상 기록됨
- [ ] Phase 2: 모든 기존 레코드에 r2_file_id 매핑 완료
- [ ] Phase 3: Client Portal이 r2_files 기반으로 정상 동작
- [ ] 롤백 테스트: 스크립트 실행 후 기존 상태 복원 확인

---

## 15. 테스트 전략 (Testing Strategy)

### 15.1 Permission Sync 테스트

**목적**: DB-level `has_accounting_permission()` SQL function과 API-level `canAccessAccounting()` TypeScript 함수가 동일하게 동작하는지 검증

**파일**: `__tests__/integration/permission-sync.test.ts`

```typescript
describe('Permission Sync: SQL vs TypeScript', () => {
  const testUsers = [
    { role: 'owner', expectedAccounting: true },
    { role: 'admin', expectedAccounting: true },
    { role: 'lawyer', expectedAccounting: false },
    { role: 'staff', expectedAccounting: false },
  ];

  for (const { role, expectedAccounting } of testUsers) {
    it(`${role} should have consistent accounting permission`, async () => {
      // 1. TypeScript check
      const tsResult = canAccessAccounting(role);
      expect(tsResult).toBe(expectedAccounting);

      // 2. SQL function check (via RPC)
      const { data: sqlResult } = await supabaseAsRole(role)
        .rpc('has_accounting_permission');
      expect(sqlResult).toBe(expectedAccounting);
    });
  }
});
```

### 15.2 Unit Tests

| 모듈 | 테스트 파일 | 테스트 케이스 |
|------|------------|--------------|
| R2 Client | `__tests__/unit/r2-client.test.ts` | presigned URL 생성, multipart 초기화 |
| Filename Parser | `__tests__/unit/filename-parser.test.ts` | 한글 파일명 파싱, 증거번호 추출 |
| Classification Rules | `__tests__/unit/classification-rules.test.ts` | 규칙 매칭, 우선순위 |
| Storage Quota | `__tests__/unit/storage-quota.test.ts` | 용량 계산, 초과 검증 |

### 15.3 Integration Tests

| 시나리오 | 테스트 파일 | 검증 항목 |
|---------|------------|----------|
| 파일 업로드 플로우 | `__tests__/integration/file-upload.test.ts` | presigned URL -> 업로드 -> 메타데이터 저장 |
| 폴더 CRUD | `__tests__/integration/folder-crud.test.ts` | 생성, 이동, 삭제, 계층 구조 |
| Inbox 자동분류 | `__tests__/integration/inbox-classify.test.ts` | 규칙 기반, AI fallback, 미분류 |
| RLS 정책 | `__tests__/integration/rls-policies.test.ts` | 테넌트 격리, 계약서 폴더 접근 |
| 마이그레이션 | `__tests__/integration/migration.test.ts` | 듀얼 라이트, 데이터 무결성 |

### 15.4 E2E Tests (UI)

**파일**: `e2e/drive.spec.ts` (Playwright)

| 시나리오 | 설명 | 검증 항목 |
|---------|------|----------|
| 파일 탐색 | 폴더 트리 네비게이션 | 클릭 응답, 목록 로드 |
| 드래그앤드롭 업로드 | 파일 드래그 후 업로드 | 진행 표시, 성공 토스트 |
| 컨텍스트 메뉴 | 우클릭 메뉴 | 메뉴 표시, 액션 실행 |
| 권한 제한 | lawyer로 contracts 접근 | 접근 거부 메시지 |
| 모바일 뷰 | 반응형 레이아웃 | 터치 인터랙션, 스크롤 |

### 15.5 사용자 테스트 (UX Validation)

**참가자**: 3명 (변호사 1, 사무장 1, 직원 1)

**시나리오**:

| # | 과제 | 성공 기준 |
|---|------|----------|
| 1 | 사건 폴더에서 특정 증거 찾기 | 30초 내 도달 |
| 2 | 새 파일 업로드 | 1분 내 완료 |
| 3 | Inbox에서 파일 분류하기 | 자동분류 확인 후 수정 |
| 4 | 파일 검색 | 키워드로 파일 찾기 |
| 5 | 스토리지 용량 확인 | 대시보드 접근 |

**측정 지표**:
- 작업 완료율 (목표: 100%)
- 작업 소요 시간
- 오류 발생 횟수
- 만족도 점수 (1-5, 목표: 4.0+)

### 15.6 Gemini API 테스트

| 테스트 | 검증 항목 |
|--------|----------|
| Rate Limit Handling | 429 응답 시 백오프 재시도 |
| Error Fallback | API 에러 시 규칙 기반 분류로 전환 |
| Timeout | 30초 타임아웃 후 fallback |
| Cost Tracking | 월별 사용량 로깅 확인 |

### 15.7 테스트 커버리지 목표

| 레이어 | 목표 커버리지 |
|--------|--------------|
| Unit Tests | 80%+ |
| Integration Tests | 70%+ |
| E2E Tests | Critical paths 100% |

---

## 16. Appendix: 파일 구조 요약

### 16.1 Cloudflare 설정 파일

```
# 프로젝트 루트
wrangler.toml                    # Cloudflare Workers/Pages 설정
open-next.config.ts              # OpenNext adapter 설정
.github/workflows/deploy.yml     # Cloudflare Pages 자동 배포

# 환경별 설정 (선택)
wrangler.dev.toml               # 개발 환경
wrangler.staging.toml           # 스테이징 환경
```

### 16.2 소스 코드 구조

```
lib/
├── r2/
│   ├── r2-client.ts           # S3 SDK wrapper
│   ├── presigned-url.ts       # URL 생성
│   ├── folder-manager.ts      # 가상 폴더
│   ├── storage-service.ts     # 고수준 API
│   ├── filename-parser.ts     # 파일명 파싱
│   ├── classification.ts      # 자동분류 로직
│   ├── gemini-classifier.ts   # AI 분류
│   ├── dual-write.ts          # 듀얼 라이트
│   └── party-name-resolver.ts # 마스킹 해제

lib/supabase/
├── server.ts                     # Hyperdrive 연결 지원 (수정)
└── client.ts

app/api/
├── cron/
│   └── _scheduled.ts             # Cloudflare Cron Triggers 핸들러 (신규)
├── drive/
│   ├── folders/route.ts
│   ├── files/[id]/route.ts
│   └── upload/
│       ├── route.ts
│       └── complete/route.ts
├── inbox/
│   ├── route.ts
│   ├── classify/route.ts
│   └── rules/route.ts
└── storage/
    ├── usage/route.ts
    └── purchase/route.ts

components/drive/
├── FileExplorer.tsx
├── FolderTree.tsx
├── FileGrid.tsx
├── FileList.tsx
├── FileUploader.tsx
├── InboxPanel.tsx
├── StorageDashboard.tsx
└── FilePreview.tsx

scripts/
├── migrate-supabase-to-r2.ts
├── migrate-classifications-to-r2.ts
├── migrate-gdrive-to-r2.ts
└── rollback-to-supabase.ts

__tests__/
├── unit/
│   ├── r2-client.test.ts
│   ├── filename-parser.test.ts
│   ├── classification-rules.test.ts
│   └── storage-quota.test.ts
├── integration/
│   ├── permission-sync.test.ts
│   ├── file-upload.test.ts
│   ├── folder-crud.test.ts
│   ├── inbox-classify.test.ts
│   ├── rls-policies.test.ts
│   └── migration.test.ts
└── e2e/
    └── drive.spec.ts
```
