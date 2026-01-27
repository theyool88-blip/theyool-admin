-- 나의사건검색 연동키 (enc_cs_no) 추가
-- 2026-01-01

-- enc_cs_no: 대법원 나의사건검색 시스템의 암호화된 사건 식별자
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS enc_cs_no TEXT;

COMMENT ON COLUMN legal_cases.enc_cs_no IS '대법원 나의사건검색 연동키 (암호화된 사건번호)';

-- 인덱스 추가 (연동 여부 확인용)
CREATE INDEX IF NOT EXISTS idx_legal_cases_enc_cs_no ON legal_cases(enc_cs_no)
WHERE enc_cs_no IS NOT NULL;
