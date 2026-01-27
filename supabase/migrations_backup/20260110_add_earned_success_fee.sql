-- Add earned_success_fee column to legal_cases
-- 발생성공보수: 실제 발생/확정된 성공보수 금액

ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS earned_success_fee BIGINT DEFAULT 0;

COMMENT ON COLUMN legal_cases.earned_success_fee IS '발생성공보수 (실제 확정된 성공보수 금액)';
