-- 법률 사건 테이블에 담당 판사 컬럼 추가
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS judge_name TEXT;

-- 법원 기일 테이블에 재판기일 보고서 컬럼 추가
ALTER TABLE court_hearings ADD COLUMN IF NOT EXISTS report TEXT;

COMMENT ON COLUMN legal_cases.judge_name IS '담당 판사명';
COMMENT ON COLUMN court_hearings.report IS '재판기일 보고서 (텍스트)';
