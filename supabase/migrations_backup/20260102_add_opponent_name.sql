-- Add opponent_name column to legal_cases table
-- Used to display real names instead of masked names (김OO -> 김진희)

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS opponent_name TEXT;

COMMENT ON COLUMN legal_cases.opponent_name IS '상대방 이름 (마스킹 대신 실명 표시용)';
