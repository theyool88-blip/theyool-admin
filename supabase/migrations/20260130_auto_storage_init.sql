-- Auto Storage Initialization
-- Creates tenant_storage record automatically when tenant is created
-- Also backfills existing tenants

-- 1. Create trigger function for automatic storage initialization
CREATE OR REPLACE FUNCTION init_tenant_storage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_storage (tenant_id, quota_bytes, used_bytes, file_count)
  VALUES (NEW.id, 53687091200, 0, 0)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create trigger on tenants table
DROP TRIGGER IF EXISTS on_tenant_created_init_storage ON tenants;
CREATE TRIGGER on_tenant_created_init_storage
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION init_tenant_storage();

-- 3. Backfill existing tenants (safe - uses ON CONFLICT DO NOTHING)
INSERT INTO tenant_storage (tenant_id, quota_bytes, used_bytes, file_count)
SELECT id, 53687091200, 0, 0 FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
