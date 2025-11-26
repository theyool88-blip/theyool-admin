-- cases 테이블에 case_number 컬럼 추가
-- 작성일: 2025-11-23
-- 목적: 법원 기일 및 데드라인과 연동하기 위한 사건번호 컬럼 추가

-- 1. case_number 컬럼 추가 (NULL 허용)
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS case_number VARCHAR(100) UNIQUE;

-- 2. 인덱스 생성 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);

-- 3. 코멘트 추가
COMMENT ON COLUMN cases.case_number IS '사건번호 (예: 2024드단12345) - court_hearings, case_deadlines와 연동';
