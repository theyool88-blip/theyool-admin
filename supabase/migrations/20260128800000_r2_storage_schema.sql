-- R2 Storage Schema Migration
-- This migration creates the complete R2-based storage infrastructure

-- ============================================================================
-- 1. R2 Folders Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS r2_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  parent_id UUID REFERENCES r2_folders(id) ON DELETE CASCADE,
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  is_contract_folder BOOLEAN DEFAULT FALSE,
  depth INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for r2_folders
CREATE INDEX IF NOT EXISTS idx_r2_folders_tenant_id ON r2_folders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_r2_folders_parent_id ON r2_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_r2_folders_case_id ON r2_folders(case_id);
CREATE INDEX IF NOT EXISTS idx_r2_folders_path ON r2_folders(path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_r2_folders_tenant_path ON r2_folders(tenant_id, path);

-- ============================================================================
-- 2. R2 Files Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS r2_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  r2_etag TEXT,
  original_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  folder_id UUID REFERENCES r2_folders(id) ON DELETE SET NULL,
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  doc_type VARCHAR(50),
  doc_subtype VARCHAR(50),
  parsed_date DATE,
  exhibit_number VARCHAR(20),
  is_contract BOOLEAN DEFAULT FALSE,
  client_visible BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for r2_files
CREATE INDEX IF NOT EXISTS idx_r2_files_tenant_id ON r2_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_r2_files_folder_id ON r2_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_r2_files_case_id ON r2_files(case_id);
CREATE INDEX IF NOT EXISTS idx_r2_files_r2_key ON r2_files(r2_key);
CREATE INDEX IF NOT EXISTS idx_r2_files_doc_type ON r2_files(doc_type);
CREATE INDEX IF NOT EXISTS idx_r2_files_is_contract ON r2_files(is_contract);
CREATE UNIQUE INDEX IF NOT EXISTS idx_r2_files_tenant_r2_key ON r2_files(tenant_id, r2_key);

-- ============================================================================
-- 3. Tenant Storage Quota Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quota_bytes BIGINT NOT NULL DEFAULT 53687091200, -- 50GB default
  extra_quota_bytes BIGINT DEFAULT 0,
  used_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  extra_quota_started_at TIMESTAMPTZ,
  extra_quota_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_tenant_storage_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_storage_tenant_id ON tenant_storage(tenant_id);

-- ============================================================================
-- 4. Inbox Rules Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS inbox_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_rules_tenant_id ON inbox_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbox_rules_priority ON inbox_rules(priority DESC);

-- ============================================================================
-- 5. Helper Function: Check Accounting Permission
-- ============================================================================
CREATE OR REPLACE FUNCTION has_accounting_permission()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1)
  LIMIT 1;

  RETURN user_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Row Level Security Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE r2_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE r2_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for r2_folders
CREATE POLICY "Users can view folders in their tenant"
  ON r2_folders FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert folders in their tenant"
  ON r2_folders FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update folders in their tenant"
  ON r2_folders FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folders in their tenant"
  ON r2_folders FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for r2_files
CREATE POLICY "Users can view files in their tenant"
  ON r2_files FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
    AND (
      -- Non-contract files visible to all
      is_contract = FALSE
      OR
      -- Contract files require accounting permission
      (is_contract = TRUE AND has_accounting_permission())
    )
  );

CREATE POLICY "Users can insert files in their tenant"
  ON r2_files FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
    AND (
      -- Non-contract files can be uploaded by all
      is_contract = FALSE
      OR
      -- Contract files require accounting permission
      (is_contract = TRUE AND has_accounting_permission())
    )
  );

CREATE POLICY "Users can update files in their tenant"
  ON r2_files FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
    AND (
      is_contract = FALSE
      OR
      (is_contract = TRUE AND has_accounting_permission())
    )
  );

CREATE POLICY "Users can delete files in their tenant"
  ON r2_files FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
    AND (
      is_contract = FALSE
      OR
      (is_contract = TRUE AND has_accounting_permission())
    )
  );

-- RLS Policies for tenant_storage
CREATE POLICY "Users can view storage in their tenant"
  ON tenant_storage FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can modify storage quota"
  ON tenant_storage FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for inbox_rules
CREATE POLICY "Users can view inbox rules in their tenant"
  ON inbox_rules FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can manage inbox rules"
  ON inbox_rules FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 7. Extend Existing Tables
-- ============================================================================

-- Add r2_folder_id to legal_cases
ALTER TABLE legal_cases
  ADD COLUMN IF NOT EXISTS r2_folder_id UUID REFERENCES r2_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_cases_r2_folder_id ON legal_cases(r2_folder_id);

-- Add r2_file_id to drive_file_classifications (for migration tracking, if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drive_file_classifications') THEN
    ALTER TABLE drive_file_classifications
      ADD COLUMN IF NOT EXISTS r2_file_id UUID REFERENCES r2_files(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_drive_file_classifications_r2_file_id
      ON drive_file_classifications(r2_file_id);
  END IF;
END $$;

-- ============================================================================
-- 8. Triggers for updated_at
-- ============================================================================

-- Generic update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_r2_folders_updated_at
  BEFORE UPDATE ON r2_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_r2_files_updated_at
  BEFORE UPDATE ON r2_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_storage_updated_at
  BEFORE UPDATE ON tenant_storage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_rules_updated_at
  BEFORE UPDATE ON inbox_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
