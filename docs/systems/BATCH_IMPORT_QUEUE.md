# Queue 기반 대량 등록 시스템

## 개요

엑셀/CSV 파일에서 다수의 사건을 일괄 등록하는 시스템입니다. Queue 기반 아키텍처로 설계되어 다수 사용자가 동시에 대량 등록을 수행해도 안정적으로 처리됩니다.

## 아키텍처

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   사용자    │ ──▶ │ batch-create│ ──▶ │    Queue    │
│  (Frontend) │     │     API     │     │   (DB)      │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                                       │
       │ 폴링 (3초)                            │ Cron (1분)
       ▼                                       ▼
┌─────────────┐                        ┌─────────────┐
│batch-status │ ◀───────────────────── │   Worker    │
│     API     │                        │   (Cron)    │
└─────────────┘                        └─────────────┘
```

### 이전 방식 vs 현재 방식

| 구분 | 이전 (SSE) | 현재 (Queue) |
|------|-----------|-------------|
| 응답 | 실시간 스트리밍 | 즉시 응답 + 폴링 |
| 처리 | 동기 (요청당 처리) | 비동기 (Worker 처리) |
| 동시성 | 사용자당 연결 점유 | 공유 Worker |
| 확장성 | 제한적 | 수평 확장 가능 |

## 데이터베이스 구조

### batch_import_jobs

개별 등록 작업을 저장하는 Queue 테이블입니다.

```sql
CREATE TABLE batch_import_jobs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  batch_id UUID NOT NULL,           -- 동일 배치 그룹화
  row_index INTEGER NOT NULL,       -- 엑셀 행 번호
  status VARCHAR(20),               -- queued, running, success, failed, skipped
  priority INTEGER DEFAULT 0,
  payload JSONB NOT NULL,           -- StandardCaseRow 데이터
  result JSONB,                     -- 생성된 caseId, clientId 등
  last_error TEXT,
  attempts INTEGER DEFAULT 0,
  backoff_until TIMESTAMPTZ,
  lock_token TEXT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  requested_by UUID
);
```

### batch_import_summaries

배치 단위 진행률을 추적하는 테이블입니다.

```sql
CREATE TABLE batch_import_summaries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  batch_id UUID UNIQUE NOT NULL,
  total_rows INTEGER NOT NULL,
  processed_rows INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  status VARCHAR(20),               -- pending, processing, completed, failed
  options JSONB,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  requested_by UUID
);
```

### Dequeue 함수

원자적으로 작업을 가져오는 PostgreSQL 함수입니다.

```sql
CREATE FUNCTION dequeue_batch_import_jobs(
  p_limit INTEGER,
  p_worker_id TEXT
)
RETURNS SETOF batch_import_jobs AS $$
  UPDATE batch_import_jobs
  SET status = 'running',
      started_at = NOW(),
      lock_token = p_worker_id,
      attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM batch_import_jobs
    WHERE status = 'queued'
      AND (backoff_until IS NULL OR backoff_until <= NOW())
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$ LANGUAGE sql;
```

**핵심 기능:**
- `FOR UPDATE SKIP LOCKED`: 다른 Worker가 처리 중인 작업 건너뜀
- `backoff_until`: 실패 후 재시도 대기 시간 적용
- `priority DESC`: 우선순위 높은 작업 먼저 처리

## API 엔드포인트

### POST /api/admin/onboarding/batch-create

대량 등록 작업을 Queue에 추가합니다.

**Request:**
```typescript
{
  rows: StandardCaseRow[],
  columnMapping: ColumnMapping,
  options?: {
    skipDuplicates?: boolean,
    createClients?: boolean,
    linkToScourt?: boolean,
    assigneeIds?: string[]
  }
}
```

**Response:**
```typescript
{
  success: true,
  batchId: "uuid",
  totalJobs: 50,
  message: "대량 등록이 시작되었습니다"
}
```

### GET /api/admin/onboarding/batch-status/[batchId]

배치 진행률을 조회합니다.

**Response:**
```typescript
{
  batchId: "uuid",
  status: "processing",
  progress: {
    total: 50,
    processed: 25,
    success: 23,
    failed: 2,
    skipped: 0
  },
  jobs?: BatchImportJob[],   // includeJobs=true 시
  completedAt: null
}
```

### DELETE /api/admin/onboarding/batch-status/[batchId]

대기 중인 작업을 취소합니다.

**Response:**
```typescript
{
  success: true,
  cancelled: 25,
  message: "25건의 대기 중인 작업이 취소되었습니다"
}
```

## Worker 처리 로직

**파일:** `app/api/cron/batch-import-worker/route.ts`

### 처리 흐름

1. `CRON_SECRET` 검증
2. `dequeue_batch_import_jobs()` 호출 (10건)
3. 각 작업 병렬 처리 (동시 2건)
4. 대법원 API Rate limiting (분당 30건)
5. 성공/실패 상태 업데이트
6. Summary 카운트 갱신
7. 완료 시 알림 발송

### 설정 (`lib/batch-import/import-settings.ts`)

```typescript
export const batchImportSettings = {
  workerBatchSize: 10,        // 한 번에 가져올 Job 수
  workerConcurrency: 2,       // 동시 처리 수
  rateLimitPerMinute: 30,     // 대법원 API 분당 호출 수
  maxRetries: 3,              // 최대 재시도
  backoffBaseMs: 60000,       // 백오프 기준 (1분)
  backoffMaxMs: 1800000,      // 최대 백오프 (30분)
}
```

### Backoff 전략

실패 시 지수 백오프를 적용합니다:

| 시도 | 대기 시간 |
|------|----------|
| 1회 | 1분 |
| 2회 | 2분 |
| 3회 | 4분 |
| 4회+ | 실패 처리 |

## Vercel Cron 설정

**파일:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/batch-import-worker",
      "schedule": "* * * * *"
    }
  ]
}
```

- **실행 주기:** 매 1분
- **인증:** `CRON_SECRET` 환경변수
- **요구사항:** Vercel Pro 플랜 (1분 간격)

## 프론트엔드 통합

### 진행률 표시

```typescript
// 3초마다 폴링
useEffect(() => {
  if (!batchId || isComplete) return;

  const interval = setInterval(async () => {
    const res = await fetch(`/api/admin/onboarding/batch-status/${batchId}`);
    const data = await res.json();
    setProgress(data.progress);

    if (data.status === 'completed') {
      clearInterval(interval);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [batchId]);
```

### 취소 기능

```typescript
const handleCancel = async () => {
  await fetch(`/api/admin/onboarding/batch-status/${batchId}`, {
    method: 'DELETE'
  });
};
```

## 테스트

### E2E 테스트 실행

```bash
npx tsx scripts/test-batch-import-e2e.ts
```

### 테스트 항목

1. Summary 생성
2. Jobs 삽입
3. Dequeue 원자성 (SKIP LOCKED)
4. 상태 업데이트 (success/failed)
5. Summary 카운트 동기화
6. 완료 상태 전환

## 마이그레이션

### 수동 적용 (SQL Editor)

Supabase Dashboard → SQL Editor에서 실행:

```bash
# 마이그레이션 파일 위치
supabase/migrations/20260122_batch_import_queue.sql
```

### 스크립트 실행

```bash
npx tsx scripts/apply-batch-import-migration.ts
```

## 모니터링

### 진행 중인 배치 확인

```sql
SELECT
  batch_id,
  status,
  total_rows,
  processed_rows,
  success_count,
  failed_count
FROM batch_import_summaries
WHERE status = 'processing'
ORDER BY created_at DESC;
```

### 실패한 작업 확인

```sql
SELECT
  id,
  row_index,
  last_error,
  attempts,
  payload->>'court_case_number' as case_number
FROM batch_import_jobs
WHERE batch_id = 'your-batch-id'
  AND status = 'failed'
ORDER BY row_index;
```

### 재시도 대기 중인 작업

```sql
SELECT
  id,
  attempts,
  backoff_until,
  last_error
FROM batch_import_jobs
WHERE status = 'queued'
  AND backoff_until > NOW();
```

## 관련 파일

| 파일 | 설명 |
|------|------|
| `lib/batch-import/import-queue.ts` | Queue 유틸리티 함수 |
| `lib/batch-import/import-settings.ts` | Worker 설정 |
| `app/api/admin/onboarding/batch-create/route.ts` | 등록 API |
| `app/api/admin/onboarding/batch-status/[batchId]/route.ts` | 상태 API |
| `app/api/cron/batch-import-worker/route.ts` | Worker |
| `app/admin/scourt/import/page.tsx` | 프론트엔드 |
| `supabase/migrations/20260122_batch_import_queue.sql` | DB 마이그레이션 |
