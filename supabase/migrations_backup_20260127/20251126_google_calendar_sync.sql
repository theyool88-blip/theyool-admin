-- Google Calendar 연동을 위한 컬럼 추가

-- court_hearings 테이블에 google_event_id 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS google_event_id TEXT UNIQUE;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_court_hearings_google_event_id
ON court_hearings(google_event_id);

-- case_number 컬럼이 legal_cases에 없으면 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_number TEXT;

-- case_number 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_number
ON legal_cases(case_number);
