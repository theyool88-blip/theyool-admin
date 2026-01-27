-- 대법원 스냅샷 테이블에 연계사건 컬럼 추가
-- 2026-01-01

-- scourt_case_snapshots 테이블에 related_cases 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scourt_case_snapshots' AND column_name = 'related_cases'
  ) THEN
    ALTER TABLE scourt_case_snapshots ADD COLUMN related_cases JSONB NOT NULL DEFAULT '[]';
    COMMENT ON COLUMN scourt_case_snapshots.related_cases IS '연계사건 정보 [{caseNo, caseName, relation}]';
  END IF;
END $$;
