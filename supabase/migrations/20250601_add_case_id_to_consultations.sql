-- 상담 ↔ 사건 연계를 위한 FK 추가
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_case_id ON consultations(case_id);

COMMENT ON COLUMN consultations.case_id IS '연계된 사건 ID (legal_cases FK, 없으면 NULL)';
