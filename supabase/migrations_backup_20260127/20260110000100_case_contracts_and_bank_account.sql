-- 사건 추가 페이지 재설계: 계약서 테이블 + 의뢰인 계좌번호
-- Created: 2026-01-10

-- 1. 계약서 테이블 생성
CREATE TABLE IF NOT EXISTS case_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,  -- Supabase Storage 경로
  file_size INTEGER,
  file_type VARCHAR(100),  -- application/pdf 등
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_case_contracts_legal_case_id ON case_contracts(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_case_contracts_tenant_id ON case_contracts(tenant_id);

-- RLS 정책
ALTER TABLE case_contracts ENABLE ROW LEVEL SECURITY;

-- 테넌트별 접근 정책
CREATE POLICY "case_contracts_tenant_isolation" ON case_contracts
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 코멘트
COMMENT ON TABLE case_contracts IS '계약서 파일 저장 테이블';
COMMENT ON COLUMN case_contracts.file_path IS 'Supabase Storage 경로: {tenant_id}/{case_id}/{filename}';

-- 2. 의뢰인 계좌번호 필드 추가
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);

COMMENT ON COLUMN clients.bank_account IS '의뢰인 계좌번호 (은행명 포함, 예: 국민 123-456-789012)';

-- updated_at 트리거 (case_contracts)
CREATE OR REPLACE FUNCTION update_case_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_case_contracts_updated_at ON case_contracts;
CREATE TRIGGER trigger_case_contracts_updated_at
  BEFORE UPDATE ON case_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_case_contracts_updated_at();
