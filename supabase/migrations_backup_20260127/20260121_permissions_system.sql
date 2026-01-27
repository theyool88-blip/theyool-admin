-- 권한 시스템 마이그레이션
-- 역할별 기본 권한 및 개별 멤버 권한 오버라이드

-- 역할별 기본 권한 테이블
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'lawyer', 'staff')),
  module TEXT NOT NULL CHECK (module IN (
    'dashboard', 'calendar', 'cases', 'clients', 'consultations',
    'expenses', 'payments', 'receivables', 'homepage', 'settings', 'team'
  )),
  can_read BOOLEAN DEFAULT false,
  can_write BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  data_scope TEXT DEFAULT 'all' CHECK (data_scope IN ('all', 'assigned', 'own')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, role, module)
);

-- 개별 멤버 권한 오버라이드 테이블
CREATE TABLE IF NOT EXISTS member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN (
    'dashboard', 'calendar', 'cases', 'clients', 'consultations',
    'expenses', 'payments', 'receivables', 'homepage', 'settings', 'team'
  )),
  can_read BOOLEAN,      -- null이면 역할 기본값 사용
  can_write BOOLEAN,
  can_delete BOOLEAN,
  data_scope TEXT CHECK (data_scope IS NULL OR data_scope IN ('all', 'assigned', 'own')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, member_id, module)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON role_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup ON role_permissions(tenant_id, role, module);
CREATE INDEX IF NOT EXISTS idx_member_permissions_tenant ON member_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_member ON member_permissions(member_id);
CREATE INDEX IF NOT EXISTS idx_member_permissions_lookup ON member_permissions(tenant_id, member_id, module);

-- RLS 정책
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

-- role_permissions RLS
CREATE POLICY "role_permissions_select" ON role_permissions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "role_permissions_insert" ON role_permissions
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "role_permissions_update" ON role_permissions
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "role_permissions_delete" ON role_permissions
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

-- member_permissions RLS
CREATE POLICY "member_permissions_select" ON member_permissions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "member_permissions_insert" ON member_permissions
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "member_permissions_update" ON member_permissions
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "member_permissions_delete" ON member_permissions
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_permissions_updated_at();

CREATE TRIGGER member_permissions_updated_at
  BEFORE UPDATE ON member_permissions
  FOR EACH ROW EXECUTE FUNCTION update_permissions_updated_at();

-- 기본 권한 설정 함수 (테넌트 생성 시 호출)
CREATE OR REPLACE FUNCTION initialize_default_permissions(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
  modules TEXT[] := ARRAY['dashboard', 'calendar', 'cases', 'clients', 'consultations', 'expenses', 'payments', 'receivables', 'homepage', 'settings', 'team'];
  m TEXT;
BEGIN
  -- Owner: 모든 권한
  FOREACH m IN ARRAY modules LOOP
    INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
    VALUES (p_tenant_id, 'owner', m, true, true, true, 'all')
    ON CONFLICT (tenant_id, role, module) DO NOTHING;
  END LOOP;

  -- Admin: 모든 권한
  FOREACH m IN ARRAY modules LOOP
    INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
    VALUES (p_tenant_id, 'admin', m, true, true, true, 'all')
    ON CONFLICT (tenant_id, role, module) DO NOTHING;
  END LOOP;

  -- Lawyer: 대시보드, 캘린더, 사건, 의뢰인, 상담은 own 범위로, 회계는 읽기만, 홈페이지/설정/팀 접근 불가
  FOREACH m IN ARRAY modules LOOP
    CASE m
      WHEN 'dashboard' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'lawyer', m, true, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'calendar', 'cases', 'clients' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'lawyer', m, true, true, false, 'own')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'consultations' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'lawyer', m, true, true, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'expenses', 'payments', 'receivables' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'lawyer', m, true, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'homepage', 'settings', 'team' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'lawyer', m, false, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
    END CASE;
  END LOOP;

  -- Staff: 대시보드, 캘린더, 사건, 의뢰인은 assigned 범위로 읽기만, 상담은 읽기만, 나머지 접근 불가
  FOREACH m IN ARRAY modules LOOP
    CASE m
      WHEN 'dashboard' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'staff', m, true, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'calendar', 'cases', 'clients' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'staff', m, true, false, false, 'assigned')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      WHEN 'consultations' THEN
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'staff', m, true, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
      ELSE
        INSERT INTO role_permissions (tenant_id, role, module, can_read, can_write, can_delete, data_scope)
        VALUES (p_tenant_id, 'staff', m, false, false, false, 'all')
        ON CONFLICT (tenant_id, role, module) DO NOTHING;
    END CASE;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 기존 테넌트에 기본 권한 설정
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    PERFORM initialize_default_permissions(t_id);
  END LOOP;
END $$;

COMMENT ON TABLE role_permissions IS '역할별 기본 권한 설정';
COMMENT ON TABLE member_permissions IS '개별 멤버 권한 오버라이드';
COMMENT ON COLUMN role_permissions.data_scope IS 'all: 전체 데이터, assigned: 담당 데이터만, own: 본인 데이터만';
