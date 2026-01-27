-- 사용자 수동 수정 보존 플래그 추가

ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

ALTER TABLE case_representatives
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN case_parties.manual_override IS '사용자 수동 수정 보존';
COMMENT ON COLUMN case_representatives.manual_override IS '사용자 수동 수정 보존';
