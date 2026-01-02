-- court_hearings 테이블에 SCOURT 기일 해시 컬럼 추가
-- 중복 방지용: date + time + type의 SHA256 해시

ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS scourt_hearing_hash TEXT;

-- 유니크 인덱스 생성 (case_id + hash 조합)
CREATE UNIQUE INDEX IF NOT EXISTS idx_court_hearings_case_hash
ON court_hearings (case_id, scourt_hearing_hash)
WHERE scourt_hearing_hash IS NOT NULL;

-- 주석
COMMENT ON COLUMN court_hearings.scourt_hearing_hash IS 'SCOURT 기일 중복 방지용 해시 (date|time|type SHA256)';
