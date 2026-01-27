-- SCOURT 기일 연동: 출석변호사 필드 추가
-- 2026-01-06

-- 1. 출석변호사 필드 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS attending_lawyer_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_court_hearings_attending_lawyer
ON court_hearings(attending_lawyer_id);

-- 3. 코멘트
COMMENT ON COLUMN court_hearings.attending_lawyer_id IS '출석 변호사 (기본값: 사건 담당변호사)';
