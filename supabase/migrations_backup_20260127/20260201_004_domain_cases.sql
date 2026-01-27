-- ============================================================================
-- 법률 사무소 SaaS - 사건 도메인
-- 생성일: 2026-02-01
-- 설명: legal_cases, case_parties, case_representatives, case_relations, case_contracts
-- NOTE: retainer_fee, opponent_name, client_role 등 레거시 컬럼 제거됨 (case_parties로 이관)
-- ============================================================================

-- ============================================================================
-- 1. legal_cases 테이블 (소송 사건)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 사건 기본 정보
  case_name VARCHAR(200) NOT NULL,                -- 사건명
  court_case_number VARCHAR(100),                 -- 법원 사건번호 (예: 2025가합12345)
  court_name VARCHAR(200),                        -- 법원명
  case_type VARCHAR(50),                          -- 사건 유형 (테넌트 설정에서 정의)

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 사건 상태
  status VARCHAR(20) DEFAULT 'active',            -- active, closed, suspended, dismissed
  case_level VARCHAR(10) DEFAULT '1심',           -- 1심, 2심(항소심), 3심(상고심)

  -- 심급 연결
  main_case_id UUID REFERENCES legal_cases(id),   -- 주사건 ID (최상위 심급)

  -- 계약 관련
  contract_number VARCHAR(50),                    -- 수임 계약번호
  contract_date DATE,                             -- 수임 계약일

  -- 재판부 정보
  judge_name VARCHAR(100),                        -- 담당 판사
  judge_report TEXT,                              -- 재판부 정보/특이사항

  -- 미수금 관리
  receivable_grade receivable_grade DEFAULT 'normal',

  -- OneDrive 연동
  onedrive_folder_url TEXT,

  -- 대법원 연동 (SCOURT)
  scourt_last_sync TIMESTAMPTZ,
  scourt_sync_status VARCHAR(20),
  scourt_unread_updates INTEGER DEFAULT 0,
  scourt_next_hearing JSONB,
  scourt_last_snapshot_id UUID,                   -- 마지막 스냅샷 ID

  -- 대법원 연동 ID들
  scourt_enc_cs_no VARCHAR(100),                  -- 암호화된 사건번호
  scourt_wmonid VARCHAR(100),                     -- WMONID
  scourt_application_type VARCHAR(20),            -- 신청 유형

  -- 메모
  notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_tenant_id ON legal_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_name ON legal_cases(case_name);
CREATE INDEX IF NOT EXISTS idx_legal_cases_court_case_number ON legal_cases(court_case_number);
CREATE INDEX IF NOT EXISTS idx_legal_cases_assigned_to ON legal_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status ON legal_cases(status);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_level ON legal_cases(case_level);
CREATE INDEX IF NOT EXISTS idx_legal_cases_main_case_id ON legal_cases(main_case_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_receivable_grade ON legal_cases(receivable_grade);
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_enc_cs_no ON legal_cases(scourt_enc_cs_no);
CREATE INDEX IF NOT EXISTS idx_legal_cases_created_at ON legal_cases(created_at DESC);

-- 코멘트
COMMENT ON TABLE legal_cases IS '소송 사건 관리';
COMMENT ON COLUMN legal_cases.case_type IS '사건 유형 (테넌트 설정에서 정의)';
COMMENT ON COLUMN legal_cases.main_case_id IS '주사건 ID (현재 최상위 심급)';
COMMENT ON COLUMN legal_cases.receivable_grade IS '미수금 관리 등급: normal, watch, collection';

-- ============================================================================
-- 2. case_parties 테이블 (사건 당사자)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 당사자 정보
  party_name TEXT NOT NULL,
  party_type VARCHAR(30) NOT NULL,                -- plaintiff, defendant, creditor, debtor, applicant, respondent
  party_type_label VARCHAR(30),                   -- 원고, 피고, 채권자, 채무자, 신청인, 피신청인
  party_order INTEGER DEFAULT 1,                  -- 표시 순서

  -- 의뢰인 연결
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  is_our_client BOOLEAN DEFAULT false,

  -- 수임료 배분 (금액 기준)
  fee_allocation_amount BIGINT,                   -- 배분 금액 (원)
  fee_allocation_manual BOOLEAN DEFAULT false,    -- 수동 배분 여부

  -- 판결 정보 (SCOURT 연동)
  adjdoc_rch_ymd VARCHAR(8),                      -- 판결도달일
  indvd_cfmtn_ymd VARCHAR(8),                     -- 확정일

  -- SCOURT 연동
  scourt_synced BOOLEAN DEFAULT false,
  scourt_party_index INTEGER,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, party_type, party_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_parties_tenant_id ON case_parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_case_id ON case_parties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_client_id ON case_parties(client_id);
CREATE INDEX IF NOT EXISTS idx_case_parties_party_type ON case_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_case_parties_is_our_client ON case_parties(is_our_client);

-- 코멘트
COMMENT ON TABLE case_parties IS '사건별 당사자 정보 (원고/피고 등)';
COMMENT ON COLUMN case_parties.party_type IS '당사자 유형: plaintiff, defendant, creditor, debtor, applicant, respondent';
COMMENT ON COLUMN case_parties.fee_allocation_amount IS '당사자별 수임료 배분 금액';

-- ============================================================================
-- 3. case_representatives 테이블 (사건 대리인)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  case_party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,

  -- 대리인 정보
  representative_name TEXT NOT NULL,
  representative_type_label VARCHAR(50),          -- 원고 소송대리인, 피고 소송대리인 등
  law_firm_name TEXT,
  is_our_firm BOOLEAN DEFAULT false,

  -- SCOURT 연동
  scourt_synced BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, representative_type_label, representative_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_representatives_tenant_id ON case_representatives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_representatives_case_id ON case_representatives(case_id);
CREATE INDEX IF NOT EXISTS idx_case_representatives_case_party_id ON case_representatives(case_party_id);
CREATE INDEX IF NOT EXISTS idx_case_representatives_is_our_firm ON case_representatives(is_our_firm);

-- 코멘트
COMMENT ON TABLE case_representatives IS '사건별 대리인 정보 (소송대리인 등)';

-- ============================================================================
-- 4. case_relations 테이블 (연관 사건)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  related_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 연관 정보
  relation_type TEXT,                             -- 항소, 상고, 반소, 관련사건 등
  notes TEXT,

  -- SCOURT 연동
  scourt_enc_cs_no VARCHAR(100),                  -- SCOURT에서 발견한 연관사건의 encCsNo

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, related_case_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_relations_tenant_id ON case_relations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_case_id ON case_relations(case_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_related_case_id ON case_relations(related_case_id);

-- 코멘트
COMMENT ON TABLE case_relations IS '연관 사건 연결 (심급, 반소 등)';
COMMENT ON COLUMN case_relations.relation_type IS '연관 유형: 항소, 상고, 반소, 관련사건 등';

-- ============================================================================
-- 5. case_contracts 테이블 (계약서 파일)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 파일 정보
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,                -- Supabase Storage 경로
  file_size INTEGER,
  file_type VARCHAR(100),                         -- application/pdf 등

  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_contracts_tenant_id ON case_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_contracts_legal_case_id ON case_contracts(legal_case_id);

-- 코멘트
COMMENT ON TABLE case_contracts IS '계약서 파일 저장';
COMMENT ON COLUMN case_contracts.file_path IS 'Supabase Storage 경로: {tenant_id}/{case_id}/{filename}';

-- ============================================================================
-- 6. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_legal_cases_updated_at ON legal_cases;
CREATE TRIGGER update_legal_cases_updated_at
  BEFORE UPDATE ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_parties_updated_at ON case_parties;
CREATE TRIGGER update_case_parties_updated_at
  BEFORE UPDATE ON case_parties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_contracts_updated_at ON case_contracts;
CREATE TRIGGER update_case_contracts_updated_at
  BEFORE UPDATE ON case_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_legal_cases_tenant_id ON legal_cases;
CREATE TRIGGER set_legal_cases_tenant_id
  BEFORE INSERT ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_case_parties_tenant_id ON case_parties;
CREATE TRIGGER set_case_parties_tenant_id
  BEFORE INSERT ON case_parties
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_case_representatives_tenant_id ON case_representatives;
CREATE TRIGGER set_case_representatives_tenant_id
  BEFORE INSERT ON case_representatives
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_case_relations_tenant_id ON case_relations;
CREATE TRIGGER set_case_relations_tenant_id
  BEFORE INSERT ON case_relations
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_case_contracts_tenant_id ON case_contracts;
CREATE TRIGGER set_case_contracts_tenant_id
  BEFORE INSERT ON case_contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 8. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_contracts ENABLE ROW LEVEL SECURITY;

-- legal_cases: 테넌트 격리
CREATE POLICY "tenant_isolation_legal_cases" ON legal_cases
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- case_parties: 테넌트 격리
CREATE POLICY "tenant_isolation_case_parties" ON case_parties
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- case_representatives: 테넌트 격리
CREATE POLICY "tenant_isolation_case_representatives" ON case_representatives
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- case_relations: 테넌트 격리
CREATE POLICY "tenant_isolation_case_relations" ON case_relations
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- case_contracts: 테넌트 격리
CREATE POLICY "tenant_isolation_case_contracts" ON case_contracts
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
