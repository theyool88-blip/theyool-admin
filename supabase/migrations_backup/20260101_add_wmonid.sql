-- WMONID 컬럼 추가 (enc_cs_no와 함께 저장)
-- encCsNo는 WMONID에 바인딩되므로 같이 저장해야 함
-- 2026-01-01

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS scourt_wmonid TEXT;

COMMENT ON COLUMN legal_cases.scourt_wmonid IS '대법원 세션 WMONID (encCsNo가 바인딩된 세션)';
