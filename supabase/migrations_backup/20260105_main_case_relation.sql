-- 연관사건/심급사건 연결 시스템 마이그레이션
-- 1. main_case_id 추가 (주사건 연결 - 최상위 심급)
-- 2. is_new_case 필드 제거
-- 3. case_relations에 scourt_enc_cs_no 추가

-- ============================================================
-- 1. legal_cases 테이블: main_case_id 추가
-- ============================================================
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS main_case_id UUID REFERENCES legal_cases(id);

CREATE INDEX IF NOT EXISTS idx_legal_cases_main_case_id
ON legal_cases(main_case_id);

COMMENT ON COLUMN legal_cases.main_case_id IS '주사건 ID (현재 최상위 심급 - 항소하면 항소심, 상고하면 상고심)';

-- ============================================================
-- 2. legal_cases 테이블: is_new_case 제거
-- ============================================================
ALTER TABLE legal_cases
DROP COLUMN IF EXISTS is_new_case;

-- ============================================================
-- 3. case_relations 테이블: scourt_enc_cs_no 추가
-- ============================================================
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS scourt_enc_cs_no VARCHAR(100);

COMMENT ON COLUMN case_relations.scourt_enc_cs_no IS 'SCOURT에서 발견한 연관사건의 encCsNo (자동 연결 시 저장)';
