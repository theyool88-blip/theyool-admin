-- legal_cases 테이블에 client_role 컬럼 추가
-- 의뢰인이 원고인지 피고인지 구분

-- 1. client_role 컬럼 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS client_role VARCHAR(20)
CHECK (client_role IN ('plaintiff', 'defendant'));

-- 2. 코멘트
COMMENT ON COLUMN legal_cases.client_role IS '의뢰인 역할: plaintiff(원고/신청인), defendant(피고/상대방)';

-- 3. 인덱스 (선택적)
CREATE INDEX IF NOT EXISTS idx_legal_cases_client_role ON legal_cases(client_role);
