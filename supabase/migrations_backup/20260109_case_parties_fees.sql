-- case_parties에 수임료 관련 컬럼 추가/수정
-- fee_allocation_amount: 착수금 (금액)
-- success_fee_terms: 성공보수 약정내용 (텍스트)

-- 성공보수 약정내용 컬럼 추가 (TEXT)
ALTER TABLE case_parties ADD COLUMN IF NOT EXISTS success_fee_terms TEXT;

-- 기존 success_fee_amount가 있으면 삭제 (BIGINT -> TEXT 변경)
ALTER TABLE case_parties DROP COLUMN IF EXISTS success_fee_amount;

-- 컬럼명 명확화를 위한 코멘트
COMMENT ON COLUMN case_parties.fee_allocation_amount IS '착수금 (원)';
COMMENT ON COLUMN case_parties.success_fee_terms IS '성공보수 약정내용';
