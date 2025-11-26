-- cases 테이블에 case_number 컬럼 수동 추가
-- Supabase SQL Editor에서 실행하세요
-- 작성일: 2025-11-23

-- 1. case_number 컬럼 추가
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS case_number VARCHAR(100);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);

-- 3. 코멘트 추가
COMMENT ON COLUMN cases.case_number IS '사건번호 (예: 2024드단12345) - court_hearings, case_deadlines와 연동';

-- 4. 검증 쿼리
SELECT id, title, case_number FROM cases LIMIT 5;
