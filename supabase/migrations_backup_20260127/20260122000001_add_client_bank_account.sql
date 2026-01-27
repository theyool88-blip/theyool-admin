-- clients 테이블에 bank_account 컬럼 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS bank_account TEXT;

COMMENT ON COLUMN clients.bank_account IS '의뢰인 계좌번호 (은행명 포함)';
