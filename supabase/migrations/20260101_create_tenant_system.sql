-- =====================================================
-- 멀티테넌트 SaaS 시스템 - 핵심 테이블 생성
-- 생성일: 2025-12-31
-- 설명: tenants, tenant_members, super_admins, subscription_plans 테이블 생성
-- =====================================================

-- =====================================================
-- 1. 테넌트 테이블 (법무법인/개인사무소)
-- =====================================================
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

  -- 홈페이지 연결 설정
  has_homepage BOOLEAN DEFAULT false,            -- 홈페이지 서비스 연결 여부
  homepage_domain VARCHAR(200),                  -- 커스텀 도메인 (선택)
  homepage_subdomain VARCHAR(100),               -- 서브도메인 (lawyer.theyool.kr)

  -- 구독 정보 (테이블 구조만, 나중에 결제 연동)
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

-- =====================================================
-- 2. 테넌트 멤버십 테이블 (변호사, 직원)
-- =====================================================
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

-- =====================================================
-- 3. 슈퍼 어드민 테이블
-- =====================================================
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

-- =====================================================
-- 4. 구독 플랜 정의 테이블 (나중에 사용)
-- =====================================================
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

-- =====================================================
-- 5. 테넌트 초대 테이블 (팀원 초대용)
-- =====================================================
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

-- =====================================================
-- 6. updated_at 자동 업데이트 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- =====================================================
-- 7. RLS (Row Level Security) 활성화
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. 기본 RLS 정책 (상세 정책은 별도 마이그레이션에서)
-- =====================================================

-- subscription_plans: 모든 인증된 사용자가 조회 가능
CREATE POLICY "anyone_can_view_plans" ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- service_role은 모든 테이블 접근 가능
CREATE POLICY "service_role_full_access_tenants" ON tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_members" ON tenant_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_super_admins" ON super_admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_invitations" ON tenant_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 완료
-- =====================================================
