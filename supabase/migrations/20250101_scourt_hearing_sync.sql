-- SCOURT 기일 동기화를 위한 테이블 확장
-- 2025-01-01

-- 1. court_hearings에 scourt 연결 컬럼 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS scourt_hearing_hash VARCHAR(64);

ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
-- 가능한 값: 'manual', 'scourt', 'google_calendar'

-- 2. 중복 방지용 unique index (scourt 소스인 경우만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_court_hearings_scourt_hash
ON court_hearings(case_id, scourt_hearing_hash)
WHERE scourt_hearing_hash IS NOT NULL;

-- 3. case_id 필수 체크 (scourt 소스인 경우)
-- case_id가 있어야 legal_cases와 연결됨

-- 4. case_deadlines에 소스 및 관련 기일 컬럼 추가
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS source_hearing_id UUID REFERENCES court_hearings(id) ON DELETE SET NULL;

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_court_hearings_source ON court_hearings(source);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_source ON case_deadlines(source);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_source_hearing ON case_deadlines(source_hearing_id);

-- 6. HEARING_RESULT에 JUDGMENT 추가를 위한 체크 (enum이 아닌 경우 불필요)
-- PostgreSQL에서는 VARCHAR로 저장되므로 별도 작업 불필요

-- 7. 코멘트
COMMENT ON COLUMN court_hearings.scourt_hearing_hash IS '대법원 기일 해시 (date+time+type). 중복 방지용.';
COMMENT ON COLUMN court_hearings.source IS '기일 생성 소스: manual(수동), scourt(대법원 동기화), google_calendar(구글 캘린더)';
COMMENT ON COLUMN case_deadlines.source IS '데드라인 생성 소스: manual(수동), auto(기일 결과에서 자동 생성)';
COMMENT ON COLUMN case_deadlines.source_hearing_id IS '자동 생성된 경우, 원인이 된 기일 ID';
