-- SCOURT sync scheduler and queue system
-- 2026-02-01

-- ============================================================
-- 1. legal_cases: per-case sync state
-- ============================================================
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS scourt_sync_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS scourt_last_progress_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_last_general_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_next_progress_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_next_general_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_progress_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS scourt_general_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS scourt_last_manual_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_sync_cooldown_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_sync_locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scourt_sync_lock_token TEXT;

CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_sync_enabled
  ON legal_cases(scourt_sync_enabled);
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_next_progress
  ON legal_cases(scourt_next_progress_sync_at);
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_next_general
  ON legal_cases(scourt_next_general_sync_at);
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_sync_cooldown
  ON legal_cases(scourt_sync_cooldown_until);
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_progress_hash
  ON legal_cases(scourt_progress_hash);

-- ============================================================
-- 2. scourt_sync_jobs: job queue
-- ============================================================
CREATE TABLE IF NOT EXISTS scourt_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  sync_type VARCHAR(20) NOT NULL, -- progress, general, full, wmonid_renewal
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'queued', -- queued, running, success, failed, skipped
  attempts INTEGER NOT NULL DEFAULT 0,
  backoff_until TIMESTAMPTZ,
  last_error TEXT,
  lock_token TEXT,
  dedup_key TEXT,
  requested_by UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_status
  ON scourt_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_scheduled_at
  ON scourt_sync_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_legal_case_id
  ON scourt_sync_jobs(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_sync_type
  ON scourt_sync_jobs(sync_type);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_priority
  ON scourt_sync_jobs(priority DESC);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_tenant_id
  ON scourt_sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_backoff
  ON scourt_sync_jobs(backoff_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scourt_sync_jobs_dedup_key
  ON scourt_sync_jobs(dedup_key)
  WHERE dedup_key IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_scourt_sync_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_sync_jobs_updated_at ON scourt_sync_jobs;
CREATE TRIGGER trigger_scourt_sync_jobs_updated_at
  BEFORE UPDATE ON scourt_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_sync_jobs_updated_at();

-- ============================================================
-- 3. dequeue function for workers
-- ============================================================
CREATE OR REPLACE FUNCTION dequeue_scourt_sync_jobs(
  p_limit INTEGER,
  p_worker_id TEXT
)
RETURNS SETOF scourt_sync_jobs AS $$
  UPDATE scourt_sync_jobs
  SET status = 'running',
      started_at = NOW(),
      lock_token = p_worker_id,
      attempts = attempts + 1,
      updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM scourt_sync_jobs
    WHERE status = 'queued'
      AND scheduled_at <= NOW()
      AND (backoff_until IS NULL OR backoff_until <= NOW())
    ORDER BY priority DESC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$ LANGUAGE sql;

-- ============================================================
-- 4. WMONID validity comment update (1-year baseline)
-- ============================================================
COMMENT ON COLUMN scourt_user_wmonid.wmonid IS '대법원 세션 식별자. 관측 기준 1년 유효.';
COMMENT ON COLUMN scourt_user_wmonid.expires_at IS '만료일. 만료 30~45일 전 갱신 필요.';
COMMENT ON COLUMN scourt_profile_cases.wmonid IS 'encCsNo가 바인딩된 WMONID 쿠키값. 관측 기준 1년 유효.';
