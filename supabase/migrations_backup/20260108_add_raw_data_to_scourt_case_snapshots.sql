-- scourt_case_snapshots.raw_data 컬럼 추가 (XML 렌더링용)
-- 2026-01-08

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scourt_case_snapshots'
      AND column_name = 'raw_data'
  ) THEN
    ALTER TABLE scourt_case_snapshots ADD COLUMN raw_data JSONB;
    COMMENT ON COLUMN scourt_case_snapshots.raw_data IS 'XML 렌더링용 원본 API 데이터';
  END IF;
END $$;
