-- ============================================================================
-- 법률 사무소 SaaS - 테넌트 시스템
-- 생성일: 2026-02-01
-- 설명: tenants, tenant_members, super_admins, subscription_plans, tenant_settings
-- ============================================================================

-- ============================================================================
-- 1. tenants 테이블 (법무법인/개인사무소)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name VARCHAR(200) NOT NULL,                    -- 사무소명
  slug VARCHAR(100) UNIQUE NOT NULL,             -- URL 슬러그 (theyool, kimlaw 등)
  type VARCHAR(50) DEFAULT 'individual',         -- individual: 개인, firm: 법무법인

  -- 연락처
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,

  -- 브랜딩
  logo_url TEXT,                                 -- 로고 URL
  primary_color VARCHAR(20),                     -- 주 색상

  -- 홈페이지 연결 설정
  has_homepage BOOLEAN DEFAULT false,            -- 홈페이지 서비스 연결 여부
  homepage_domain VARCHAR(200),                  -- 커스텀 도메인 (선택)
  homepage_subdomain VARCHAR(100),               -- 서브도메인 (lawyer.theyool.kr)

  -- 구독 정보
  plan VARCHAR(50) DEFAULT 'basic',              -- basic, professional, enterprise
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,

  -- 기능 설정
  features JSONB DEFAULT '{
    "maxCases": 100,
    "maxClients": 100,
    "maxMembers": 5,
    "scourtSync": true,
    "clientPortal": true
  }'::jsonb,

  -- 테넌트별 설정
  settings JSONB DEFAULT '{
    "timezone": "Asia/Seoul",
    "dateFormat": "YYYY-MM-DD",
    "workingHours": {"start": "09:00", "end": "18:00"}
  }'::jsonb,

  -- 상태
  status VARCHAR(20) DEFAULT 'active',           -- active, suspended, cancelled
  is_verified BOOLEAN DEFAULT false,             -- 사업자등록 확인 여부

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- 코멘트
COMMENT ON TABLE tenants IS '테넌트 (법무법인/개인사무소) 정보';
COMMENT ON COLUMN tenants.slug IS 'URL에 사용되는 고유 식별자';
COMMENT ON COLUMN tenants.type IS 'individual: 개인변호사, firm: 법무법인';
COMMENT ON COLUMN tenants.has_homepage IS '홈페이지 서비스 연결 여부';
COMMENT ON COLUMN tenants.features IS '테넌트에 활성화된 기능 목록';

-- ============================================================================
-- 2. tenant_members 테이블 (변호사, 직원)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관계
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 역할: owner > admin > lawyer > staff
  role VARCHAR(50) NOT NULL DEFAULT 'staff',

  -- 프로필
  display_name VARCHAR(100),                     -- 표시 이름
  title VARCHAR(100),                            -- 직함 (대표변호사, 수석변호사 등)
  bar_number VARCHAR(50),                        -- 변호사 등록번호
  phone VARCHAR(20),                             -- 직통 전화
  email VARCHAR(100),                            -- 업무 이메일
  avatar_url TEXT,                               -- 프로필 이미지

  -- 권한 (세부 권한 설정)
  permissions JSONB DEFAULT '[]'::jsonb,

  -- 상태
  status VARCHAR(20) DEFAULT 'active',           -- active, invited, suspended
  invited_at TIMESTAMPTZ,                        -- 초대일
  invited_by UUID REFERENCES auth.users(id),     -- 초대한 사용자
  joined_at TIMESTAMPTZ,                         -- 가입일

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약조건: 한 사용자는 한 테넌트에 한 번만 가입 가능
  UNIQUE(tenant_id, user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_role ON tenant_members(role);
CREATE INDEX IF NOT EXISTS idx_tenant_members_status ON tenant_members(status);

-- 코멘트
COMMENT ON TABLE tenant_members IS '테넌트 멤버십 (변호사, 직원)';
COMMENT ON COLUMN tenant_members.role IS 'owner: 소유자, admin: 관리자, lawyer: 변호사, staff: 직원';
COMMENT ON COLUMN tenant_members.bar_number IS '변호사 등록번호 (변호사인 경우)';
COMMENT ON COLUMN tenant_members.permissions IS '추가 세부 권한 설정';

-- ============================================================================
-- 3. super_admins 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 권한 (기본: 전체 권한)
  permissions JSONB DEFAULT '["*"]'::jsonb,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 코멘트
COMMENT ON TABLE super_admins IS '슈퍼 어드민 (모든 테넌트 관리 권한)';
COMMENT ON COLUMN super_admins.permissions IS '슈퍼 어드민 권한 목록 ("*" = 전체 권한)';

-- ============================================================================
-- 4. subscription_plans 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_ko VARCHAR(100),                          -- 한글 이름
  description TEXT,

  -- 기능 제한
  features JSONB DEFAULT '{
    "maxCases": 100,
    "maxClients": 100,
    "maxMembers": 5,
    "scourtSync": true,
    "clientPortal": true,
    "homepage": false
  }'::jsonb,

  -- 가격 (원)
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,

  -- 상태
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 코멘트
COMMENT ON TABLE subscription_plans IS '구독 플랜 정의';
COMMENT ON COLUMN subscription_plans.features IS '플랜에 포함된 기능 및 제한';

-- 기본 플랜 삽입
INSERT INTO subscription_plans (id, name, name_ko, description, features, price_monthly, price_yearly, display_order)
VALUES
  ('basic', 'Basic', '베이직', '기본 사건관리 기능',
   '{"maxCases": 50, "maxClients": 50, "maxMembers": 2, "scourtSync": false, "clientPortal": false, "homepage": false}'::jsonb,
   0, 0, 1),
  ('professional', 'Professional', '프로페셔널', '전문 변호사를 위한 플랜',
   '{"maxCases": 200, "maxClients": 200, "maxMembers": 5, "scourtSync": true, "clientPortal": true, "homepage": false}'::jsonb,
   50000, 500000, 2),
  ('enterprise', 'Enterprise', '엔터프라이즈', '법무법인을 위한 플랜',
   '{"maxCases": -1, "maxClients": -1, "maxMembers": -1, "scourtSync": true, "clientPortal": true, "homepage": true}'::jsonb,
   100000, 1000000, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. tenant_invitations 테이블 (팀원 초대용)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 초대 정보
  email VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'staff',

  -- 초대 토큰 (URL에 사용)
  token VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- 상태
  status VARCHAR(20) DEFAULT 'pending',          -- pending, accepted, expired
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

  -- 메타데이터
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant_id ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_status ON tenant_invitations(status);

-- 코멘트
COMMENT ON TABLE tenant_invitations IS '테넌트 팀원 초대';
COMMENT ON COLUMN tenant_invitations.token IS '초대 링크용 토큰';

-- ============================================================================
-- 6. tenant_settings 테이블 (동적 설정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- cases, payments, expenses, consultations, clients
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, category)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_category ON tenant_settings(category);

-- 코멘트
COMMENT ON TABLE tenant_settings IS '테넌트별 서비스 설정 (카테고리, 옵션 등)';
COMMENT ON COLUMN tenant_settings.category IS '설정 카테고리: cases, payments, expenses, consultations, clients';
COMMENT ON COLUMN tenant_settings.settings IS 'JSON 형식의 설정 데이터';

-- ============================================================================
-- 7. 트리거: updated_at 자동 업데이트
-- ============================================================================

-- tenants 테이블
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- tenant_members 테이블
DROP TRIGGER IF EXISTS update_tenant_members_updated_at ON tenant_members;
CREATE TRIGGER update_tenant_members_updated_at
  BEFORE UPDATE ON tenant_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- subscription_plans 테이블
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- tenant_settings 테이블
DROP TRIGGER IF EXISTS update_tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 테넌트 관련 함수 (테이블 생성 후 정의)
-- ============================================================================

-- 슈퍼 어드민 확인
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_super_admin() IS '현재 사용자가 슈퍼 어드민인지 확인';

-- 현재 테넌트 ID 조회
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_tenant_id() IS '현재 로그인한 사용자의 활성 테넌트 ID 반환';

-- 현재 멤버 ID 조회
CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS UUID AS $$
  SELECT id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_member_id() IS '현재 로그인한 사용자의 멤버 ID 반환';

-- 현재 사용자의 역할 조회
CREATE OR REPLACE FUNCTION get_current_member_role()
RETURNS VARCHAR AS $$
  SELECT role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_member_role() IS '현재 로그인한 사용자의 역할 반환';

-- 특정 테넌트의 멤버인지 확인
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_tenant_member(UUID) IS '현재 사용자가 특정 테넌트의 멤버인지 확인';

-- 특정 역할 이상인지 확인
CREATE OR REPLACE FUNCTION has_role_or_higher(required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  role_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- 슈퍼 어드민은 모든 역할 접근 가능
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 역할 계층: owner(4) > admin(3) > lawyer(2) > staff(1)
  SELECT CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO role_hierarchy;

  SELECT CASE required_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO required_hierarchy;

  RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION has_role_or_higher(VARCHAR) IS '현재 사용자가 특정 역할 이상인지 확인 (owner > admin > lawyer > staff)';

-- 특정 테넌트에서 특정 역할 이상인지 확인
CREATE OR REPLACE FUNCTION has_role_in_tenant(p_tenant_id UUID, required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  role_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- 슈퍼 어드민은 모든 역할 접근 가능
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
    AND status = 'active'
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 역할 계층: owner(4) > admin(3) > lawyer(2) > staff(1)
  SELECT CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO role_hierarchy;

  SELECT CASE required_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO required_hierarchy;

  RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION has_role_in_tenant(UUID, VARCHAR) IS '현재 사용자가 특정 테넌트에서 특정 역할 이상인지 확인';

-- 테넌트 ID 자동 설정 트리거 함수
CREATE OR REPLACE FUNCTION set_tenant_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- tenant_id가 이미 설정되어 있으면 그대로 사용
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 현재 사용자의 테넌트 ID 설정
  NEW.tenant_id := get_current_tenant_id();

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine tenant_id for user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_tenant_id_on_insert() IS '트리거용: INSERT 시 tenant_id 자동 설정';

-- ============================================================================
-- 9. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- subscription_plans: 모든 인증된 사용자가 조회 가능
CREATE POLICY "anyone_can_view_plans" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- tenants: 슈퍼 어드민은 모든 테넌트 접근
CREATE POLICY "super_admin_tenants" ON tenants
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tenants: 테넌트 멤버는 자신의 테넌트만 조회
CREATE POLICY "member_view_tenant" ON tenants
  FOR SELECT TO authenticated
  USING (is_tenant_member(id));

-- tenants: 테넌트 owner/admin은 자신의 테넌트 수정
CREATE POLICY "admin_update_tenant" ON tenants
  FOR UPDATE TO authenticated
  USING (is_tenant_member(id) AND has_role_or_higher('admin'))
  WITH CHECK (is_tenant_member(id) AND has_role_or_higher('admin'));

-- tenant_members: 슈퍼 어드민은 모든 멤버 접근
CREATE POLICY "super_admin_members" ON tenant_members
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tenant_members: 같은 테넌트 멤버는 조회 가능
CREATE POLICY "member_view_members" ON tenant_members
  FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant_id());

-- tenant_members: 테넌트 admin 이상은 멤버 관리
CREATE POLICY "admin_manage_members" ON tenant_members
  FOR ALL TO authenticated
  USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  WITH CHECK (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'));

-- super_admins: 슈퍼 어드민만 조회/관리
CREATE POLICY "super_admin_view_super_admins" ON super_admins
  FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY "super_admin_manage_super_admins" ON super_admins
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tenant_invitations: 테넌트 admin 이상은 초대 관리
CREATE POLICY "admin_manage_invitations" ON tenant_invitations
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- tenant_invitations: 초대 토큰으로 조회 (가입 시 사용)
CREATE POLICY "public_view_invitation_by_token" ON tenant_invitations
  FOR SELECT TO authenticated
  USING (status = 'pending' AND expires_at > NOW());

-- tenant_settings: 슈퍼 어드민 접근
CREATE POLICY "super_admin_tenant_settings" ON tenant_settings
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- tenant_settings: 테넌트 멤버는 자신의 테넌트 설정만 조회/수정 가능 (admin 이상)
CREATE POLICY "tenant_member_settings" ON tenant_settings
  FOR ALL TO authenticated
  USING (
    is_tenant_member(tenant_id) AND
    has_role_or_higher('admin')
  )
  WITH CHECK (
    is_tenant_member(tenant_id) AND
    has_role_or_higher('admin')
  );

-- ============================================================================
-- 완료
-- ============================================================================
