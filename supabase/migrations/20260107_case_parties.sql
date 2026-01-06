-- 다수 당사자 및 대리인 관리 시스템
-- case_parties: 사건별 당사자 (원고/피고 등)
-- case_representatives: 사건별 대리인 (소송대리인 등)

-- 1. case_parties 테이블 생성
CREATE TABLE IF NOT EXISTS case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 당사자 정보
  party_name TEXT NOT NULL,
  party_type VARCHAR(30) NOT NULL,       -- 'plaintiff', 'defendant', 'creditor', 'debtor', 'applicant', 'respondent'
  party_type_label VARCHAR(30),          -- '원고', '피고', '채권자', '채무자', '신청인', '피신청인'
  party_order INTEGER DEFAULT 1,

  -- 의뢰인 연결
  client_id UUID REFERENCES clients(id),
  is_our_client BOOLEAN DEFAULT FALSE,

  -- 수임료 배분 (금액 기준)
  fee_allocation_amount BIGINT,          -- 배분 금액 (원)

  -- SCOURT 연동
  scourt_synced BOOLEAN DEFAULT FALSE,
  scourt_party_index INTEGER,
  adjdoc_rch_ymd VARCHAR(8),             -- 판결도달일
  indvd_cfmtn_ymd VARCHAR(8),            -- 확정일

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, party_type, party_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_parties_case ON case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_client ON case_parties(client_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_tenant ON case_parties(tenant_id);

-- 2. case_representatives 테이블 생성
CREATE TABLE IF NOT EXISTS case_representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  case_party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,

  representative_name TEXT NOT NULL,
  representative_type_label VARCHAR(50),  -- '원고 소송대리인', '피고 소송대리인' 등
  law_firm_name TEXT,
  is_our_firm BOOLEAN DEFAULT FALSE,

  scourt_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, representative_type_label, representative_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_representatives_case ON case_representatives(case_id);
CREATE INDEX IF NOT EXISTS idx_case_representatives_party ON case_representatives(case_party_id);
CREATE INDEX IF NOT EXISTS idx_case_representatives_tenant ON case_representatives(tenant_id);

-- 3. 기존 데이터 마이그레이션
-- 의뢰인 이관 (기존 legal_cases.client_id → case_parties)
INSERT INTO case_parties (tenant_id, case_id, party_name, party_type, party_type_label, client_id, is_our_client, fee_allocation_amount)
SELECT
  lc.tenant_id,
  lc.id,
  c.name,
  COALESCE(lc.client_role, 'plaintiff'),
  CASE COALESCE(lc.client_role, 'plaintiff')
    WHEN 'plaintiff' THEN '원고'
    WHEN 'defendant' THEN '피고'
    WHEN 'creditor' THEN '채권자'
    WHEN 'debtor' THEN '채무자'
    WHEN 'applicant' THEN '신청인'
    WHEN 'respondent' THEN '피신청인'
    ELSE '원고'
  END,
  lc.client_id,
  TRUE,
  lc.retainer_fee
FROM legal_cases lc
JOIN clients c ON c.id = lc.client_id
WHERE lc.client_id IS NOT NULL
ON CONFLICT (case_id, party_type, party_name) DO NOTHING;

-- 상대방 이관 (기존 legal_cases.opponent_name → case_parties)
INSERT INTO case_parties (tenant_id, case_id, party_name, party_type, party_type_label, is_our_client)
SELECT
  lc.tenant_id,
  lc.id,
  lc.opponent_name,
  CASE COALESCE(lc.client_role, 'plaintiff')
    WHEN 'plaintiff' THEN 'defendant'
    WHEN 'defendant' THEN 'plaintiff'
    WHEN 'creditor' THEN 'debtor'
    WHEN 'debtor' THEN 'creditor'
    WHEN 'applicant' THEN 'respondent'
    WHEN 'respondent' THEN 'applicant'
    ELSE 'defendant'
  END,
  CASE COALESCE(lc.client_role, 'plaintiff')
    WHEN 'plaintiff' THEN '피고'
    WHEN 'defendant' THEN '원고'
    WHEN 'creditor' THEN '채무자'
    WHEN 'debtor' THEN '채권자'
    WHEN 'applicant' THEN '피신청인'
    WHEN 'respondent' THEN '신청인'
    ELSE '피고'
  END,
  FALSE
FROM legal_cases lc
WHERE lc.opponent_name IS NOT NULL AND lc.opponent_name != ''
ON CONFLICT (case_id, party_type, party_name) DO NOTHING;

-- 4. payments 테이블에 case_party_id 추가 (입금자 추적용)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS case_party_id UUID REFERENCES case_parties(id);

-- 5. RLS 정책
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_representatives ENABLE ROW LEVEL SECURITY;

-- case_parties RLS
DROP POLICY IF EXISTS "tenant_isolation_case_parties" ON case_parties;
CREATE POLICY "tenant_isolation_case_parties" ON case_parties
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- case_representatives RLS
DROP POLICY IF EXISTS "tenant_isolation_case_representatives" ON case_representatives;
CREATE POLICY "tenant_isolation_case_representatives" ON case_representatives
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 6. updated_at 트리거
CREATE OR REPLACE FUNCTION update_case_parties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_case_parties_updated_at ON case_parties;
CREATE TRIGGER trigger_case_parties_updated_at
  BEFORE UPDATE ON case_parties
  FOR EACH ROW
  EXECUTE FUNCTION update_case_parties_updated_at();
