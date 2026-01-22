-- Batch Import Queue System
-- 2026-01-22
--
-- Queue-based architecture for handling large batch imports
-- without blocking connections or overwhelming the SCOURT API

-- ============================================================
-- 1. batch_import_jobs: Individual job queue
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,           -- Groups all rows from same batch
  row_index INTEGER NOT NULL,       -- Excel row number (0-based)
  status VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued, running, success, failed, skipped
  priority INTEGER NOT NULL DEFAULT 0,

  -- Input data (StandardCaseRow format)
  payload JSONB NOT NULL,

  -- Processing result
  result JSONB,                     -- Created caseId, clientId, warnings, etc.
  last_error TEXT,

  -- Worker management
  attempts INTEGER NOT NULL DEFAULT 0,
  backoff_until TIMESTAMPTZ,
  lock_token TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,

  -- Requester
  requested_by UUID REFERENCES auth.users(id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_batch_import_jobs_status
  ON batch_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_import_jobs_batch_id
  ON batch_import_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_import_jobs_tenant_id
  ON batch_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_import_jobs_priority_created
  ON batch_import_jobs(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_batch_import_jobs_backoff
  ON batch_import_jobs(backoff_until)
  WHERE backoff_until IS NOT NULL;

-- ============================================================
-- 2. batch_import_summaries: Batch-level tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_import_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID UNIQUE NOT NULL,

  -- Counts
  total_rows INTEGER NOT NULL,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed

  -- Options used for this import
  options JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Requester
  requested_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_batch_import_summaries_tenant_id
  ON batch_import_summaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batch_import_summaries_status
  ON batch_import_summaries(status);
CREATE INDEX IF NOT EXISTS idx_batch_import_summaries_created_at
  ON batch_import_summaries(created_at DESC);

-- ============================================================
-- 3. Dequeue function for workers (atomic, skip-locked)
-- ============================================================
CREATE OR REPLACE FUNCTION dequeue_batch_import_jobs(
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
    SELECT id
    FROM batch_import_jobs
    WHERE status = 'queued'
      AND (backoff_until IS NULL OR backoff_until <= NOW())
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$ LANGUAGE sql;

-- ============================================================
-- 4. Helper function to update batch summary counts (manual call)
-- ============================================================
CREATE OR REPLACE FUNCTION update_batch_import_summary_counts_manual(
  p_batch_id UUID
)
RETURNS void AS $$
BEGIN
  UPDATE batch_import_summaries
  SET
    processed_rows = (
      SELECT COUNT(*) FROM batch_import_jobs
      WHERE batch_id = p_batch_id AND status IN ('success', 'failed', 'skipped')
    ),
    success_count = (
      SELECT COUNT(*) FROM batch_import_jobs
      WHERE batch_id = p_batch_id AND status = 'success'
    ),
    failed_count = (
      SELECT COUNT(*) FROM batch_import_jobs
      WHERE batch_id = p_batch_id AND status = 'failed'
    ),
    skipped_count = (
      SELECT COUNT(*) FROM batch_import_jobs
      WHERE batch_id = p_batch_id AND status = 'skipped'
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FROM batch_import_jobs WHERE batch_id = p_batch_id AND status IN ('queued', 'running')) = 0
      THEN 'completed'
      ELSE 'processing'
    END,
    started_at = COALESCE(started_at, NOW()),
    completed_at = CASE
      WHEN (SELECT COUNT(*) FROM batch_import_jobs WHERE batch_id = p_batch_id AND status IN ('queued', 'running')) = 0
      THEN NOW()
      ELSE NULL
    END
  WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE batch_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_import_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS batch_import_jobs_tenant_isolation ON batch_import_jobs;
DROP POLICY IF EXISTS batch_import_summaries_tenant_isolation ON batch_import_summaries;

-- Create tenant isolation policies
CREATE POLICY batch_import_jobs_tenant_isolation ON batch_import_jobs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY batch_import_summaries_tenant_isolation ON batch_import_summaries
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Comments
-- ============================================================
COMMENT ON TABLE batch_import_jobs IS 'Queue for individual case import jobs. Processed by batch-import-worker cron.';
COMMENT ON TABLE batch_import_summaries IS 'Batch-level summaries for tracking overall import progress.';
COMMENT ON FUNCTION dequeue_batch_import_jobs IS 'Atomically dequeue jobs for worker processing with SKIP LOCKED to prevent contention.';
COMMENT ON FUNCTION update_batch_import_summary_counts_manual IS 'Update batch summary counts based on individual job statuses (called manually by worker).';
