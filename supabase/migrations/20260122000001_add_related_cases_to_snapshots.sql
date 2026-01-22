-- ============================================================================
-- scourt_case_snapshots 테이블에 related_cases 컬럼 추가
-- 생성일: 2026-01-22
-- 설명: 연관사건 정보를 저장할 컬럼이 누락되어 스냅샷 저장이 실패하고 있음
-- ============================================================================

-- related_cases 컬럼 추가 (연관사건 정보)
ALTER TABLE scourt_case_snapshots
ADD COLUMN IF NOT EXISTS related_cases JSONB DEFAULT '[]'::jsonb;

-- 코멘트
COMMENT ON COLUMN scourt_case_snapshots.related_cases IS '연관사건 정보 (JSON 배열)';

-- 인덱스 (필요시)
-- CREATE INDEX IF NOT EXISTS idx_scourt_case_snapshots_related_cases ON scourt_case_snapshots USING gin(related_cases);
