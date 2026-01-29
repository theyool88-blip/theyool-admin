-- Atomic Storage Usage Update Function
-- Fixes race condition in storage-service.ts updateUsage() method (lines 637-677)
-- Uses INSERT ... ON CONFLICT with atomic increment instead of read-modify-write

CREATE OR REPLACE FUNCTION update_tenant_storage_atomic(
  p_tenant_id UUID,
  p_delta_bytes BIGINT,
  p_delta_files INTEGER
) RETURNS TABLE(new_used_bytes BIGINT, new_file_count INTEGER, quota_bytes BIGINT) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO tenant_storage (tenant_id, quota_bytes, used_bytes, file_count)
  VALUES (p_tenant_id, 53687091200, GREATEST(0, p_delta_bytes), GREATEST(0, p_delta_files))
  ON CONFLICT (tenant_id) DO UPDATE SET
    used_bytes = GREATEST(0, tenant_storage.used_bytes + p_delta_bytes),
    file_count = GREATEST(0, tenant_storage.file_count + p_delta_files),
    updated_at = NOW()
  RETURNING tenant_storage.used_bytes, tenant_storage.file_count, tenant_storage.quota_bytes;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_tenant_storage_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_storage_atomic TO service_role;
