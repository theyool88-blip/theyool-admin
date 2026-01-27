-- court_hearings 테이블에 Google Calendar 이벤트 ID 컬럼 추가
-- 기일 → Google Calendar 동기화용

ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- 인덱스 생성 (빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_court_hearings_google_event_id
ON court_hearings (google_event_id)
WHERE google_event_id IS NOT NULL;

-- 주석
COMMENT ON COLUMN court_hearings.google_event_id IS 'Google Calendar 이벤트 ID (동기화용)';
