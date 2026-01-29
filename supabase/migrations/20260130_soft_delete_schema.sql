-- Soft Delete Migration (DROP-then-CREATE in Transaction)
-- IMPORTANT: Run during maintenance window
-- Adds deleted_at columns and updates RLS policies

BEGIN;

-- 1. Add deleted_at columns
ALTER TABLE r2_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE r2_folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Index for soft-deleted items (for purge query performance)
CREATE INDEX IF NOT EXISTS idx_r2_files_deleted_at ON r2_files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_r2_folders_deleted_at ON r2_folders(deleted_at) WHERE deleted_at IS NOT NULL;

-- 3. Replace RLS policies using DROP-then-CREATE
-- Note: Brief gap is acceptable within transaction during maintenance

-- 3a. r2_files SELECT policy (drop old, create new with deleted_at filter)
DROP POLICY IF EXISTS "Users can view files in their tenant" ON r2_files;

CREATE POLICY "Users can view files in their tenant"
  ON r2_files FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- 3b. r2_folders SELECT policy
DROP POLICY IF EXISTS "Users can view folders in their tenant" ON r2_folders;

CREATE POLICY "Users can view folders in their tenant"
  ON r2_folders FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  );

-- 4. Create ADDITIONAL policies for trash listing (no conflict - different name)
DROP POLICY IF EXISTS "Users can view their tenant trash" ON r2_files;
CREATE POLICY "Users can view their tenant trash"
  ON r2_files FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can view their tenant folder trash" ON r2_folders;
CREATE POLICY "Users can view their tenant folder trash"
  ON r2_folders FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL
  );

COMMIT;
