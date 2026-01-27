-- 대법원 사건 정보 필드 추가 (사건명, 종국결과)
-- 2026-01-01

-- 대법원에서 조회된 사건명 (우리가 등록한 case_name과 다를 수 있음)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS scourt_case_name TEXT;

-- 종국결과 (예: 조정성립, 판결선고, 취하 등)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_result TEXT;

-- 종국일자
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_result_date DATE;

COMMENT ON COLUMN legal_cases.scourt_case_name IS '대법원 등록 사건명';
COMMENT ON COLUMN legal_cases.case_result IS '종국결과 (조정성립, 판결선고, 취하 등)';
COMMENT ON COLUMN legal_cases.case_result_date IS '종국일자';
