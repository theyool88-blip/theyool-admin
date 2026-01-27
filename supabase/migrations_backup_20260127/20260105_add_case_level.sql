-- 심급사건 연결을 위한 추가 컬럼

-- 1. legal_cases에 case_level 추가 (심급: 1심, 항소심, 상고심)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_level VARCHAR(20);

COMMENT ON COLUMN legal_cases.case_level IS '심급 (1심, 항소심, 상고심)';

-- 2. case_relations 테이블 컬럼 확인 및 추가
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS relation_type_code VARCHAR(50);

ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS direction VARCHAR(20);

ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT false;

ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;

ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false;

ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN case_relations.relation_type_code IS '관계 유형 코드 (appeal, provisional, related, cross)';
COMMENT ON COLUMN case_relations.direction IS '관계 방향 (parent, child)';
COMMENT ON COLUMN case_relations.auto_detected IS 'SCOURT에서 자동 감지됨';
COMMENT ON COLUMN case_relations.scourt_enc_cs_no IS 'SCOURT 연관사건 encCsNo';
