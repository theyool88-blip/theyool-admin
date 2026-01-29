-- Recursive Folder Path Update Function
-- Updates all descendant folder paths when a folder is moved or renamed
-- Fixes TODO comments in storage-service.ts at lines 509 and 555

CREATE OR REPLACE FUNCTION update_folder_paths_recursive(
  p_folder_id UUID,
  p_old_path TEXT,
  p_new_path TEXT
) RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update all folders whose path starts with the old path
  UPDATE r2_folders
  SET
    path = p_new_path || SUBSTRING(path FROM LENGTH(p_old_path) + 1),
    updated_at = NOW()
  WHERE path LIKE p_old_path || '/%';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_folder_paths_recursive TO authenticated;
GRANT EXECUTE ON FUNCTION update_folder_paths_recursive TO service_role;
