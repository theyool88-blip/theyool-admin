-- ============================================================================
-- 법률 사무소 SaaS - 의뢰인 도메인
-- 생성일: 2026-02-01
-- 설명: clients, client_memos 테이블
-- ============================================================================

-- ============================================================================
-- 1. clients 테이블 (의뢰인)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),

  -- 연락처 정보
  address TEXT,
  birth_date DATE,
  resident_number VARCHAR(20),            -- 주민등록번호 (암호화 저장 권장)

  -- 분류
  client_type VARCHAR(50) DEFAULT 'individual',  -- individual, corporate
  company_name VARCHAR(200),              -- 법인인 경우 법인명
  registration_number VARCHAR(50),        -- 사업자등록번호

  -- 포털 접근
  portal_enabled BOOLEAN DEFAULT false,   -- 의뢰인 포털 접근 가능 여부
  portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 상태
  status VARCHAR(20) DEFAULT 'active',    -- active, inactive

  -- 메모
  notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_portal_user ON clients(portal_user_id);

-- 코멘트
COMMENT ON TABLE clients IS '의뢰인 정보';
COMMENT ON COLUMN clients.tenant_id IS '소속 테넌트 ID';
COMMENT ON COLUMN clients.client_type IS 'individual: 개인, corporation: 법인';
COMMENT ON COLUMN clients.portal_enabled IS '의뢰인 포털 접근 가능 여부';

-- ============================================================================
-- 2. client_memos 테이블 (의뢰인 메모/체크리스트)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- 메모 내용
  content TEXT NOT NULL,
  memo_type VARCHAR(50) DEFAULT 'note',   -- note, checklist, reminder

  -- 체크리스트 관련
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES tenant_members(id),

  -- 리마인더 관련
  reminder_date DATE,
  reminder_time TIME,

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_client_memos_tenant_id ON client_memos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_memos_client_id ON client_memos(client_id);
CREATE INDEX IF NOT EXISTS idx_client_memos_memo_type ON client_memos(memo_type);
CREATE INDEX IF NOT EXISTS idx_client_memos_is_completed ON client_memos(is_completed);
CREATE INDEX IF NOT EXISTS idx_client_memos_reminder_date ON client_memos(reminder_date);

-- 코멘트
COMMENT ON TABLE client_memos IS '의뢰인별 메모/체크리스트';
COMMENT ON COLUMN client_memos.memo_type IS 'note: 일반 메모, checklist: 체크리스트, reminder: 리마인더';

-- ============================================================================
-- 3. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_memos_updated_at ON client_memos;
CREATE TRIGGER update_client_memos_updated_at
  BEFORE UPDATE ON client_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_clients_tenant_id ON clients;
CREATE TRIGGER set_clients_tenant_id
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_client_memos_tenant_id ON client_memos;
CREATE TRIGGER set_client_memos_tenant_id
  BEFORE INSERT ON client_memos
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 5. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memos ENABLE ROW LEVEL SECURITY;

-- clients: 테넌트 격리
CREATE POLICY "tenant_isolation_clients" ON clients
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- client_memos: 테넌트 격리
CREATE POLICY "tenant_isolation_client_memos" ON client_memos
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
