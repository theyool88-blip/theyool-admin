-- ============================================================================
-- 법률 사무소 SaaS - 기본 유틸리티 함수
-- 생성일: 2026-02-01
-- 설명: 테이블 의존성이 없는 기본 함수들만 포함
-- NOTE: 테넌트 관련 함수는 002_core_tenant.sql에서 테이블 생성 후 정의
-- ============================================================================

-- ============================================================================
-- 1. updated_at 자동 업데이트 트리거 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS '트리거용: updated_at 컬럼 자동 업데이트';

-- ============================================================================
-- 완료 (테넌트 관련 함수는 002_core_tenant.sql 참조)
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - ENUM 타입 정의
-- 생성일: 2026-02-01
-- 설명: 모든 ENUM 타입 통합 정의
-- ============================================================================

-- ============================================================================
-- 기존 ENUM 타입 삭제 (새로 생성하기 위해)
-- ============================================================================
DROP TYPE IF EXISTS hearing_type CASCADE;
DROP TYPE IF EXISTS hearing_status CASCADE;
DROP TYPE IF EXISTS hearing_result CASCADE;
DROP TYPE IF EXISTS deadline_type CASCADE;
DROP TYPE IF EXISTS deadline_status CASCADE;
DROP TYPE IF EXISTS party_type CASCADE;
DROP TYPE IF EXISTS receivable_grade CASCADE;
DROP TYPE IF EXISTS member_role CASCADE;
DROP TYPE IF EXISTS member_status CASCADE;
DROP TYPE IF EXISTS case_status CASCADE;
DROP TYPE IF EXISTS consultation_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS notification_channel CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;

-- ============================================================================
-- 1. 멤버 관련 ENUM
-- ============================================================================

-- 멤버 역할
CREATE TYPE member_role AS ENUM (
  'owner',      -- 소유자 (최고 권한)
  'admin',      -- 관리자
  'lawyer',     -- 변호사
  'staff'       -- 직원
);
COMMENT ON TYPE member_role IS '테넌트 멤버 역할: owner > admin > lawyer > staff';

-- 멤버 상태
CREATE TYPE member_status AS ENUM (
  'active',     -- 활성
  'invited',    -- 초대됨 (수락 대기)
  'suspended'   -- 정지됨
);
COMMENT ON TYPE member_status IS '테넌트 멤버 상태';

-- ============================================================================
-- 2. 사건 관련 ENUM
-- ============================================================================

-- 사건 상태
CREATE TYPE case_status AS ENUM (
  'active',     -- 진행 중
  'closed',     -- 종결
  'suspended',  -- 보류
  'dismissed'   -- 각하/기각
);
COMMENT ON TYPE case_status IS '사건 상태';

-- 당사자 유형
CREATE TYPE party_type AS ENUM (
  'plaintiff',  -- 원고
  'defendant',  -- 피고
  'creditor',   -- 채권자
  'debtor',     -- 채무자
  'applicant',  -- 신청인
  'respondent', -- 피신청인
  'appellant',  -- 항소인
  'appellee'    -- 피항소인
);
COMMENT ON TYPE party_type IS '사건 당사자 유형';

-- ============================================================================
-- 3. 기일 관련 ENUM
-- ============================================================================

-- 기일 유형
CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',           -- 변론기일
  'HEARING_INTERIM',        -- 사전·보전처분 심문기일
  'HEARING_MEDIATION',      -- 조정기일
  'HEARING_INVESTIGATION',  -- 조사기일
  'HEARING_PARENTING',      -- 상담·교육·프로그램 기일
  'HEARING_JUDGMENT',       -- 선고기일
  'HEARING_LAWYER_MEETING', -- 변호사 미팅
  'HEARING_SENTENCE',       -- 형사 선고기일
  'HEARING_TRIAL',          -- 공판기일
  'HEARING_EXAMINATION'     -- 증인신문기일
);
COMMENT ON TYPE hearing_type IS '법원 기일 유형';

-- 기일 상태
CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',  -- 예정
  'COMPLETED',  -- 완료
  'POSTPONED',  -- 연기
  'CANCELLED'   -- 취소
);
COMMENT ON TYPE hearing_status IS '법원 기일 상태';

-- 기일 결과
CREATE TYPE hearing_result AS ENUM (
  'continued',   -- 속행
  'settled',     -- 화해/조정 성립
  'judgment',    -- 판결 선고
  'dismissed',   -- 각하/기각
  'withdrawn',   -- 취하
  'adjourned',   -- 휴정
  'other'        -- 기타
);
COMMENT ON TYPE hearing_result IS '법원 기일 결과';

-- ============================================================================
-- 4. 데드라인 관련 ENUM
-- ============================================================================

-- 데드라인 유형
CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',              -- 상소기간 (14일)
  'DL_MEDIATION_OBJ',       -- 조정·화해 이의기간 (14일)
  'DL_IMM_APPEAL',          -- 즉시항고기간 (7일)
  'DL_APPEAL_BRIEF',        -- 항소이유서 제출 (40일)
  'DL_APPEAL_BRIEF_HIGH',   -- 상고이유서 제출 (20일)
  'DL_RETRIAL',             -- 재심의 소 제기 (30일)
  'DL_CRIMINAL_APPEAL',     -- 형사상소기간 (7일)
  'DL_FAMILY_NONLIT',       -- 가사비송즉시항고 (7일)
  'DL_PAYMENT_ORDER',       -- 지급명령이의 (14일)
  'DL_ELEC_SERVICE',        -- 전자송달기간
  'DL_CUSTOM'               -- 사용자 정의 기한
);
COMMENT ON TYPE deadline_type IS '데드라인 유형';

-- 데드라인 상태
CREATE TYPE deadline_status AS ENUM (
  'PENDING',    -- 대기 중
  'COMPLETED',  -- 완료
  'OVERDUE'     -- 기한 초과
);
COMMENT ON TYPE deadline_status IS '데드라인 상태';

-- ============================================================================
-- 5. 상담/예약 관련 ENUM
-- ============================================================================

-- 상담 상태
CREATE TYPE consultation_status AS ENUM (
  'pending',      -- 대기
  'in_progress',  -- 진행 중
  'completed',    -- 완료
  'cancelled'     -- 취소
);
COMMENT ON TYPE consultation_status IS '상담 신청 상태';

-- 예약 상태
CREATE TYPE booking_status AS ENUM (
  'pending',    -- 대기
  'confirmed',  -- 확정
  'cancelled',  -- 취소
  'completed',  -- 완료
  'no_show'     -- 노쇼
);
COMMENT ON TYPE booking_status IS '상담 예약 상태';

-- ============================================================================
-- 6. 재무 관련 ENUM
-- ============================================================================

-- 미수금 등급
CREATE TYPE receivable_grade AS ENUM (
  'normal',     -- 정상
  'watch',      -- 주의
  'collection'  -- 추심
);
COMMENT ON TYPE receivable_grade IS '미수금 관리 등급';

-- ============================================================================
-- 7. 알림 관련 ENUM
-- ============================================================================

-- 알림 채널
CREATE TYPE notification_channel AS ENUM (
  'sms',          -- SMS
  'kakao_alimtalk', -- 카카오 알림톡
  'email',        -- 이메일
  'push'          -- 푸시 알림
);
COMMENT ON TYPE notification_channel IS '알림 발송 채널';

-- 알림 상태
CREATE TYPE notification_status AS ENUM (
  'pending',    -- 대기
  'sent',       -- 발송됨
  'delivered',  -- 전달됨
  'failed',     -- 실패
  'cancelled'   -- 취소됨
);
COMMENT ON TYPE notification_status IS '알림 발송 상태';

-- ============================================================================
-- 완료
-- ============================================================================
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
COMMENT ON COLUMN clients.client_type IS 'individual: 개인, corporate: 법인';
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

  -- 주 의뢰인 정보 (denormalized for performance)
  primary_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  primary_client_name TEXT,

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
-- 2. case_clients 테이블 (사건-의뢰인 M:N 관계)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- 당사자 연결 (명시적)
  linked_party_id UUID,  -- FK는 case_parties 테이블 생성 후 추가됨

  -- 의뢰인 정보
  is_primary_client BOOLEAN DEFAULT FALSE,
  retainer_fee BIGINT,
  success_fee_terms TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, client_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_clients_case ON case_clients(case_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_client ON case_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_tenant ON case_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_linked_party ON case_clients(linked_party_id);

-- 코멘트
COMMENT ON TABLE case_clients IS '사건-의뢰인 M:N 관계 테이블 (당사자와 분리)';
COMMENT ON COLUMN case_clients.linked_party_id IS 'case_parties 테이블의 당사자와 연결 (옵션)';
COMMENT ON COLUMN case_clients.is_primary_client IS '주 의뢰인 여부';
COMMENT ON COLUMN case_clients.retainer_fee IS '수임료 (원)';
COMMENT ON COLUMN case_clients.success_fee_terms IS '성공보수 조건';

-- ============================================================================
-- 3. case_parties 테이블 (사건 당사자)
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
  is_our_client BOOLEAN DEFAULT false,

  -- 수동 수정 플래그 및 SCOURT 원본 데이터
  manual_override BOOLEAN DEFAULT FALSE,
  scourt_label_raw TEXT,
  scourt_name_raw TEXT,
  is_primary BOOLEAN DEFAULT FALSE,

  -- 대리인 정보 (JSONB)
  representatives JSONB DEFAULT '[]'::JSONB,

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
CREATE INDEX IF NOT EXISTS idx_case_parties_party_type ON case_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_case_parties_is_our_client ON case_parties(is_our_client);

-- scourt 연동용 유니크 인덱스 (NULL 제외)
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_parties_case_scourt_index
  ON case_parties (case_id, scourt_party_index)
  WHERE scourt_party_index IS NOT NULL;

-- 코멘트
COMMENT ON TABLE case_parties IS '사건별 당사자 정보 (원고/피고 등)';
COMMENT ON COLUMN case_parties.party_type IS '당사자 유형: plaintiff, defendant, creditor, debtor, applicant, respondent';
COMMENT ON COLUMN case_parties.manual_override IS '사용자가 수동으로 수정한 경우 TRUE (SCOURT 데이터로 덮어쓰지 않음)';
COMMENT ON COLUMN case_parties.representatives IS '대리인 목록 (JSONB 배열): [{"name": "변호사명", "type": "attorney", "office": "법무법인명"}]';

-- FK 추가 (case_clients.linked_party_id → case_parties)
ALTER TABLE case_clients
  DROP CONSTRAINT IF EXISTS fk_case_clients_linked_party;
ALTER TABLE case_clients
  ADD CONSTRAINT fk_case_clients_linked_party
  FOREIGN KEY (linked_party_id) REFERENCES case_parties(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. case_representatives 테이블 (사건 대리인)
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
-- 5. case_relations 테이블 (연관 사건)
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
-- 6. case_contracts 테이블 (계약서 파일)
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
-- 7. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_legal_cases_updated_at ON legal_cases;
CREATE TRIGGER update_legal_cases_updated_at
  BEFORE UPDATE ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_clients_updated_at ON case_clients;
CREATE TRIGGER update_case_clients_updated_at
  BEFORE UPDATE ON case_clients
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
-- 8. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_legal_cases_tenant_id ON legal_cases;
CREATE TRIGGER set_legal_cases_tenant_id
  BEFORE INSERT ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_case_clients_tenant_id ON case_clients;
CREATE TRIGGER set_case_clients_tenant_id
  BEFORE INSERT ON case_clients
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
-- 9. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_contracts ENABLE ROW LEVEL SECURITY;

-- legal_cases: 테넌트 격리
CREATE POLICY "tenant_isolation_legal_cases" ON legal_cases
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- case_clients: 테넌트 격리
CREATE POLICY "tenant_isolation_case_clients" ON case_clients
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
-- ============================================================================
-- 법률 사무소 SaaS - 기일 & 일정 도메인
-- 생성일: 2026-02-01
-- 설명: court_hearings, case_deadlines, deadline_types, general_schedules, holidays
-- ============================================================================

-- ============================================================================
-- 1. deadline_types 테이블 (데드라인 유형 마스터)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deadline_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type deadline_type UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ko VARCHAR(100),
  description TEXT,
  days_count INTEGER NOT NULL,
  trigger_event VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 데드라인 유형 삽입
INSERT INTO deadline_types (type, name, name_ko, description, days_count, trigger_event) VALUES
  ('DL_APPEAL', '상소기간', '상소기간', '항소 또는 상고 제기 가능 기간', 14, '판결 정본 송달일'),
  ('DL_MEDIATION_OBJ', '조정·화해 이의기간', '조정이의기간', '조정·화해에 대한 이의 제기 기간', 14, '조정조서 정본 송달일'),
  ('DL_IMM_APPEAL', '즉시항고기간', '즉시항고', '즉시항고 제기 가능 기간', 7, '결정문 정본 송달일'),
  ('DL_APPEAL_BRIEF', '항소이유서 제출기한', '항소이유서', '항소이유서 제출 마감일', 40, '제1심 판결문 송달일'),
  ('DL_APPEAL_BRIEF_HIGH', '상고이유서 제출기한', '상고이유서', '상고이유서 제출 마감일', 20, '항소심 판결문 송달일'),
  ('DL_RETRIAL', '재심의 소 제기기한', '재심기한', '재심 청구 가능 기간', 30, '판결 확정일'),
  ('DL_CRIMINAL_APPEAL', '형사상소기간', '형사상소', '형사사건 상소 기간', 7, '판결 선고일'),
  ('DL_FAMILY_NONLIT', '가사비송즉시항고', '비송즉시항고', '가사비송 즉시항고 기간', 7, '결정문 송달일'),
  ('DL_PAYMENT_ORDER', '지급명령이의기간', '지급명령이의', '지급명령 이의 기간', 14, '지급명령 송달일'),
  ('DL_ELEC_SERVICE', '전자송달기간', '전자송달', '전자송달 열람 간주 기간', 7, '전자송달 발송일'),
  ('DL_CUSTOM', '사용자정의기한', '사용자정의', '사용자가 직접 지정한 기한', 0, '사용자 지정')
ON CONFLICT (type) DO NOTHING;

-- 코멘트
COMMENT ON TABLE deadline_types IS '데드라인 유형 마스터 테이블 (불변기간 정의)';
COMMENT ON COLUMN deadline_types.days_count IS '불변기간 일수';
COMMENT ON COLUMN deadline_types.trigger_event IS '기산일 이벤트 설명';

-- ============================================================================
-- 2. court_hearings 테이블 (법원 기일)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 기일 유형
  hearing_type hearing_type NOT NULL,
  hearing_detail VARCHAR(200),                    -- 상세 유형 (선택)

  -- 일시/장소
  hearing_date TIMESTAMPTZ NOT NULL,              -- 기일 날짜+시간
  court_name VARCHAR(200),                        -- 법원명
  location VARCHAR(200),                          -- 법정 위치 (본관 402호 등)

  -- 사건번호 (레거시 호환)
  case_number VARCHAR(100),                       -- 기일에 직접 연결된 사건번호

  -- 출석 정보
  lawyer_attendance_required BOOLEAN DEFAULT true,
  client_attendance_required BOOLEAN DEFAULT false,
  attending_lawyer_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,  -- 출석 변호사

  -- 화상기일 정보
  video_participant_side TEXT,                    -- plaintiff_side, defendant_side, both, NULL

  -- 상태 및 결과
  status hearing_status DEFAULT 'SCHEDULED',
  result hearing_result,
  result_notes TEXT,

  -- SCOURT 연동
  scourt_synced BOOLEAN DEFAULT false,
  scourt_hearing_hash VARCHAR(64),                -- 중복 확인용 해시
  scourt_type_raw TEXT,                           -- 원본 기일 유형
  scourt_raw_data JSONB,                          -- 원본 데이터

  -- 알림
  notice_received_date DATE,
  notice_document_url TEXT,

  -- 메모
  notes TEXT,

  -- Google Calendar 연동
  google_event_id VARCHAR(200),

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_hearing_date ON court_hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_court_hearings_hearing_type ON court_hearings(hearing_type);
CREATE INDEX IF NOT EXISTS idx_court_hearings_status ON court_hearings(status);
CREATE INDEX IF NOT EXISTS idx_court_hearings_attending_lawyer ON court_hearings(attending_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_google_event_id ON court_hearings(google_event_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_video_participant ON court_hearings(video_participant_side) WHERE video_participant_side IS NOT NULL;

-- 코멘트
COMMENT ON TABLE court_hearings IS '법원 기일 정보';
COMMENT ON COLUMN court_hearings.hearing_type IS '기일 유형: HEARING_MAIN, HEARING_MEDIATION 등';
COMMENT ON COLUMN court_hearings.video_participant_side IS '화상 참여자 측: plaintiff_side, defendant_side, both, NULL';
COMMENT ON COLUMN court_hearings.attending_lawyer_id IS '출석 변호사 (담당 변호사와 다를 수 있음)';

-- ============================================================================
-- 3. case_deadlines 테이블 (사건 데드라인)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 데드라인 유형
  deadline_type deadline_type NOT NULL,
  custom_deadline_name VARCHAR(100),              -- DL_CUSTOM인 경우 이름

  -- 관련 기일 (선택)
  related_hearing_id UUID REFERENCES court_hearings(id) ON DELETE SET NULL,

  -- 당사자 연결 (선택 - 당사자별 데드라인)
  case_party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,

  -- 날짜 정보
  trigger_date DATE NOT NULL,                     -- 기산일
  deadline_date DATE NOT NULL,                    -- 만료일
  days_count INTEGER NOT NULL,                    -- 기간 일수

  -- 사건번호 (레거시 호환)
  case_number VARCHAR(100),

  -- 상태
  status deadline_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,

  -- 알림
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,

  -- 메모
  notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_deadline CHECK (deadline_date >= trigger_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_id ON case_deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_deadline_date ON case_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_deadline_type ON case_deadlines(deadline_type);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_status ON case_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_party ON case_deadlines(case_party_id);

-- 코멘트
COMMENT ON TABLE case_deadlines IS '사건 데드라인 (불변기간)';
COMMENT ON COLUMN case_deadlines.trigger_date IS '기산일 (송달일 등)';
COMMENT ON COLUMN case_deadlines.deadline_date IS '만료일 (공휴일 조정 포함)';

-- ============================================================================
-- 4. general_schedules 테이블 (일반 일정 - 사건 무관)
-- ============================================================================
CREATE TABLE IF NOT EXISTS general_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 일정 정보
  title TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('meeting', 'appointment', 'task', 'other')),
  schedule_date DATE NOT NULL,
  schedule_time TIME,
  location TEXT,
  description TEXT,

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_general_schedules_tenant_id ON general_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_general_schedules_schedule_date ON general_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_general_schedules_schedule_type ON general_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_general_schedules_status ON general_schedules(status);
CREATE INDEX IF NOT EXISTS idx_general_schedules_assigned_to ON general_schedules(assigned_to);

-- 코멘트
COMMENT ON TABLE general_schedules IS '사건번호 없는 일반 일정';
COMMENT ON COLUMN general_schedules.schedule_type IS '일정 유형: meeting, appointment, task, other';

-- ============================================================================
-- 5. holidays 테이블 (한국 공휴일)
-- ============================================================================
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  year INTEGER,  -- 트리거로 자동 설정
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- 코멘트
COMMENT ON TABLE holidays IS '대한민국 법정 공휴일 (관공서의 공휴일에 관한 규정)';

-- holidays.year 자동 설정 트리거
CREATE OR REPLACE FUNCTION set_holiday_year()
RETURNS TRIGGER AS $$
BEGIN
  NEW.year := EXTRACT(YEAR FROM NEW.holiday_date)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_holidays_year ON holidays;
CREATE TRIGGER set_holidays_year
  BEFORE INSERT OR UPDATE OF holiday_date ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION set_holiday_year();

-- 2025년 공휴일 데이터
INSERT INTO holidays (holiday_date, holiday_name) VALUES
  ('2025-01-01', '신정'),
  ('2025-01-28', '설날 전날'),
  ('2025-01-29', '설날'),
  ('2025-01-30', '설날 다음날'),
  ('2025-03-01', '삼일절'),
  ('2025-05-05', '어린이날'),
  ('2025-05-06', '부처님오신날'),
  ('2025-06-06', '현충일'),
  ('2025-08-15', '광복절'),
  ('2025-10-03', '개천절'),
  ('2025-10-05', '추석 전날'),
  ('2025-10-06', '추석'),
  ('2025-10-07', '추석 다음날'),
  ('2025-10-08', '추석 대체휴일'),
  ('2025-10-09', '한글날'),
  ('2025-12-25', '크리스마스')
ON CONFLICT (holiday_date) DO NOTHING;

-- 2026년 공휴일 데이터
INSERT INTO holidays (holiday_date, holiday_name) VALUES
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 전날'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 다음날'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '삼일절 대체휴일'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '부처님오신날 대체휴일'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '광복절 대체휴일'),
  ('2026-09-24', '추석 전날'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 다음날'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '개천절 대체휴일'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '크리스마스')
ON CONFLICT (holiday_date) DO NOTHING;

-- ============================================================================
-- 6. 데드라인 자동 계산 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_deadline_date(
  p_trigger_date DATE,
  p_deadline_type deadline_type
)
RETURNS DATE AS $$
DECLARE
  v_days_count INTEGER;
  v_deadline_date DATE;
BEGIN
  -- 일수 조회
  SELECT days_count INTO v_days_count
  FROM deadline_types
  WHERE type = p_deadline_type;

  IF v_days_count IS NULL OR v_days_count = 0 THEN
    RAISE EXCEPTION 'Invalid deadline type or zero days: %', p_deadline_type;
  END IF;

  -- 기본 기한 계산
  v_deadline_date := p_trigger_date + (v_days_count || ' days')::INTERVAL;

  -- 공휴일/주말 조정 (민법 제161조)
  WHILE (
    EXTRACT(DOW FROM v_deadline_date) IN (0, 6) OR  -- 일요일(0), 토요일(6)
    EXISTS (SELECT 1 FROM holidays WHERE holiday_date = v_deadline_date)
  ) LOOP
    v_deadline_date := v_deadline_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_deadline_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_deadline_date(DATE, deadline_type) IS '기산일과 데드라인 유형으로 만료일 계산 (공휴일 조정 포함)';

-- ============================================================================
-- 7. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_deadline_types_updated_at ON deadline_types;
CREATE TRIGGER update_deadline_types_updated_at
  BEFORE UPDATE ON deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_court_hearings_updated_at ON court_hearings;
CREATE TRIGGER update_court_hearings_updated_at
  BEFORE UPDATE ON court_hearings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_deadlines_updated_at ON case_deadlines;
CREATE TRIGGER update_case_deadlines_updated_at
  BEFORE UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_general_schedules_updated_at ON general_schedules;
CREATE TRIGGER update_general_schedules_updated_at
  BEFORE UPDATE ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_general_schedules_tenant_id ON general_schedules;
CREATE TRIGGER set_general_schedules_tenant_id
  BEFORE INSERT ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 9. 데드라인 자동 계산 트리거
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_calculate_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- deadline_date가 없으면 자동 계산
  IF NEW.deadline_date IS NULL AND NEW.deadline_type != 'DL_CUSTOM' THEN
    NEW.deadline_date := calculate_deadline_date(NEW.trigger_date, NEW.deadline_type);
  END IF;

  -- days_count가 없으면 자동 설정
  IF NEW.days_count IS NULL THEN
    SELECT days_count INTO NEW.days_count
    FROM deadline_types
    WHERE type = NEW.deadline_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_calculate_deadline_trigger ON case_deadlines;
CREATE TRIGGER auto_calculate_deadline_trigger
  BEFORE INSERT ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_deadline();

-- ============================================================================
-- 10. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE deadline_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- deadline_types: 모두 조회 가능
CREATE POLICY "anyone_can_view_deadline_types" ON deadline_types
  FOR SELECT TO authenticated
  USING (true);

-- holidays: 모두 조회 가능
CREATE POLICY "anyone_can_view_holidays" ON holidays
  FOR SELECT TO authenticated
  USING (true);

-- court_hearings: 사건 기반 테넌트 격리
CREATE POLICY "tenant_isolation_court_hearings" ON court_hearings
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = court_hearings.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = court_hearings.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  );

-- case_deadlines: 사건 기반 테넌트 격리
CREATE POLICY "tenant_isolation_case_deadlines" ON case_deadlines
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_deadlines.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_deadlines.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  );

-- general_schedules: 테넌트 격리
CREATE POLICY "tenant_isolation_general_schedules" ON general_schedules
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - 상담 도메인
-- 생성일: 2026-02-01
-- 설명: consultations, bookings, consultation_weekly_schedule, consultation_date_exceptions
-- ============================================================================

-- ============================================================================
-- 1. consultations 테이블 (상담 신청)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- 신청자 정보
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- 상담 분류
  category TEXT,                                  -- 테넌트 설정에서 정의
  request_type TEXT,                              -- 상담 요청 유형

  -- 상담 내용
  message TEXT,

  -- 희망 일시 (선택)
  preferred_date DATE,
  preferred_time TEXT,

  -- 상담료
  consultation_fee INTEGER DEFAULT 0,

  -- 유입 경로
  source TEXT,                                    -- 홈페이지, 네이버, 직접방문 등

  -- 사건 연결
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- 메모
  admin_notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_tenant_id ON consultations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_category ON consultations(category);
CREATE INDEX IF NOT EXISTS idx_consultations_preferred_date ON consultations(preferred_date);
CREATE INDEX IF NOT EXISTS idx_consultations_case_id ON consultations(case_id);
CREATE INDEX IF NOT EXISTS idx_consultations_assigned_to ON consultations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- 코멘트
COMMENT ON TABLE consultations IS '상담 신청 정보';
COMMENT ON COLUMN consultations.category IS '상담 분류 (테넌트 설정에서 정의)';
COMMENT ON COLUMN consultations.source IS '유입 경로 (홈페이지, 네이버 등)';

-- ============================================================================
-- 2. bookings 테이블 (상담 예약)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- 예약자 정보
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- 예약 유형
  type TEXT NOT NULL CHECK (type IN ('visit', 'video', 'phone')),

  -- 예약 분류
  category TEXT,                                  -- 테넌트 설정에서 정의
  message TEXT,

  -- 예약 일시
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,

  -- 장소/링크
  office_location TEXT,                           -- 방문 상담 사무소 (테넌트 설정에서 정의, 하드코딩 제거)
  video_link TEXT,                                -- 화상 상담 링크

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),

  -- 메모
  admin_notes TEXT,

  -- 상태 변경 시간
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_office_location ON bookings(office_location);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_to ON bookings(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- 코멘트
COMMENT ON TABLE bookings IS '상담 예약 정보';
COMMENT ON COLUMN bookings.type IS '예약 유형: visit(방문), video(화상), phone(전화)';
COMMENT ON COLUMN bookings.office_location IS '방문 사무소 (테넌트 설정에서 정의)';

-- ============================================================================
-- 3. consultation_weekly_schedule 테이블 (주간 반복 일정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- 시간 범위
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- 예약 설정
  slot_duration_minutes INT DEFAULT 30,           -- 슬롯 길이 (분)
  max_bookings_per_slot INT DEFAULT 1,            -- 슬롯당 최대 예약 수

  -- 필터 (NULL이면 모든 변호사/사무소에 적용)
  assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  office_location TEXT,

  -- 활성화 여부
  is_available BOOLEAN DEFAULT true,

  -- 설명
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_slot_duration CHECK (slot_duration_minutes > 0),
  CONSTRAINT valid_max_bookings CHECK (max_bookings_per_slot > 0)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_tenant_id ON consultation_weekly_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_day ON consultation_weekly_schedule(day_of_week, is_available);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_member ON consultation_weekly_schedule(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_office ON consultation_weekly_schedule(office_location);

-- 코멘트
COMMENT ON TABLE consultation_weekly_schedule IS '상담 예약 주간 반복 일정';
COMMENT ON COLUMN consultation_weekly_schedule.day_of_week IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';
COMMENT ON COLUMN consultation_weekly_schedule.slot_duration_minutes IS '슬롯 길이 (분), 기본 30분';

-- ============================================================================
-- 4. consultation_date_exceptions 테이블 (특정 날짜 예외)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_date_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 예외 날짜
  exception_date DATE NOT NULL,

  -- 예외 타입
  is_blocked BOOLEAN DEFAULT false,               -- true: 휴무, false: 특별 운영

  -- 시간 범위 (NULL이면 종일)
  start_time TIME,
  end_time TIME,

  -- 필터
  assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  office_location TEXT,

  -- 사유
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_exception_time_range CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_date_exceptions_tenant_id ON consultation_date_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_date ON consultation_date_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_member ON consultation_date_exceptions(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_office ON consultation_date_exceptions(office_location);

-- 코멘트
COMMENT ON TABLE consultation_date_exceptions IS '상담 예약 특정 날짜 예외 처리';
COMMENT ON COLUMN consultation_date_exceptions.is_blocked IS 'true: 휴무, false: 특별 운영';

-- ============================================================================
-- 5. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_schedule_updated_at ON consultation_weekly_schedule;
CREATE TRIGGER update_weekly_schedule_updated_at
  BEFORE UPDATE ON consultation_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_date_exceptions_updated_at ON consultation_date_exceptions;
CREATE TRIGGER update_date_exceptions_updated_at
  BEFORE UPDATE ON consultation_date_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 트리거: tenant_id 자동 설정
-- ============================================================================
-- consultations는 공개 INSERT 허용 (tenant_id는 API에서 설정)

DROP TRIGGER IF EXISTS set_bookings_tenant_id ON bookings;
CREATE TRIGGER set_bookings_tenant_id
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_weekly_schedule_tenant_id ON consultation_weekly_schedule;
CREATE TRIGGER set_weekly_schedule_tenant_id
  BEFORE INSERT ON consultation_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_date_exceptions_tenant_id ON consultation_date_exceptions;
CREATE TRIGGER set_date_exceptions_tenant_id
  BEFORE INSERT ON consultation_date_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 7. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_date_exceptions ENABLE ROW LEVEL SECURITY;

-- consultations: 공개 INSERT (웹사이트에서 상담 신청)
CREATE POLICY "public_insert_consultations" ON consultations
  FOR INSERT
  WITH CHECK (true);

-- consultations: 테넌트 격리 (조회/수정/삭제)
CREATE POLICY "tenant_isolation_consultations" ON consultations
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_manage_consultations" ON consultations
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_consultations" ON consultations
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- bookings: 공개 INSERT (웹사이트에서 예약)
CREATE POLICY "public_insert_bookings" ON bookings
  FOR INSERT
  WITH CHECK (true);

-- bookings: 테넌트 격리
CREATE POLICY "tenant_isolation_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_manage_bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_bookings" ON bookings
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- consultation_weekly_schedule: 공개 조회, 테넌트 관리
CREATE POLICY "public_view_weekly_schedule" ON consultation_weekly_schedule
  FOR SELECT
  USING (true);

CREATE POLICY "tenant_manage_weekly_schedule" ON consultation_weekly_schedule
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- consultation_date_exceptions: 공개 조회, 테넌트 관리
CREATE POLICY "public_view_date_exceptions" ON consultation_date_exceptions
  FOR SELECT
  USING (true);

CREATE POLICY "tenant_manage_date_exceptions" ON consultation_date_exceptions
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - 재무 도메인
-- 생성일: 2026-02-01
-- 설명: payments, expenses, recurring_templates, receivable_writeoffs
-- NOTE: 하드코딩된 CONSTRAINT 제거 - 테넌트 설정에서 동적 로드
-- NOTE: partner_withdrawals, monthly_settlements 제거 (더율 특화, SaaS 불필요)
-- ============================================================================

-- ============================================================================
-- 1. payments 테이블 (입금 내역)
-- NOTE: 하드코딩 CONSTRAINT 제거 - payment_category, office_location은 테넌트 설정에서 정의
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 입금 기본 정보
  payment_date DATE NOT NULL,
  depositor_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount != 0),    -- 음수 = 환불

  -- 분류 정보 (테넌트 설정에서 정의 - 하드코딩 제거)
  office_location TEXT,                           -- 사무실 (테넌트 설정에서 정의)
  payment_category TEXT NOT NULL,                 -- 명목 (테넌트 설정에서 정의)

  -- 사건/의뢰인 연결
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,

  -- 상담 연결 (선택)
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,

  -- 백업용 텍스트
  case_name TEXT,                                 -- 사건명 (레거시 호환)

  -- 영수증/세금 정보
  receipt_type TEXT,                              -- 현금영수증/카드결제/세금계산서 등
  receipt_issued_at TIMESTAMPTZ,

  -- 연락처 및 메모
  phone TEXT,
  memo TEXT,
  admin_notes TEXT,

  -- 관리용
  imported_from_csv BOOLEAN DEFAULT false,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 사건/상담 중 하나만 연결 가능
  CONSTRAINT chk_either_case_or_consultation CHECK (
    (case_id IS NOT NULL AND consultation_id IS NULL) OR
    (case_id IS NULL AND consultation_id IS NOT NULL) OR
    (case_id IS NULL AND consultation_id IS NULL)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_case_party_id ON payments(case_party_id);
CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_payments_office_location ON payments(office_location);
CREATE INDEX IF NOT EXISTS idx_payments_payment_category ON payments(payment_category);
CREATE INDEX IF NOT EXISTS idx_payments_depositor_name ON payments(depositor_name);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- 코멘트
COMMENT ON TABLE payments IS '입금 내역 관리';
COMMENT ON COLUMN payments.office_location IS '사무실 (테넌트 설정에서 정의)';
COMMENT ON COLUMN payments.payment_category IS '입금 명목 (테넌트 설정에서 정의)';
COMMENT ON COLUMN payments.case_party_id IS '입금한 당사자 (다수 당사자 지원)';

-- ============================================================================
-- 2. expenses 테이블 (지출 내역)
-- NOTE: 하드코딩 CONSTRAINT 제거 - expense_category, office_location은 테넌트 설정에서 정의
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 지출 기본 정보
  expense_date DATE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보 (테넌트 설정에서 정의 - 하드코딩 제거)
  expense_category TEXT NOT NULL,                 -- 지출 카테고리 (테넌트 설정에서 정의)
  subcategory TEXT,
  office_location TEXT,                           -- 사무실 (테넌트 설정에서 정의)

  -- 고정 지출 관련
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID,

  -- 상세 정보
  vendor_name TEXT,                               -- 거래처
  memo TEXT,
  receipt_url TEXT,                               -- 영수증 이미지 URL
  payment_method TEXT,                            -- 카드/현금/계좌이체 등

  -- 관리 정보
  paid_by TEXT,
  admin_notes TEXT,

  -- 월별 집계용 (YYYY-MM) - 트리거로 자동 설정
  month_key TEXT,

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_category ON expenses(expense_category);
CREATE INDEX IF NOT EXISTS idx_expenses_office_location ON expenses(office_location);
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON expenses(is_recurring);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_template_id ON expenses(recurring_template_id);
CREATE INDEX IF NOT EXISTS idx_expenses_month_key ON expenses(month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- 코멘트
COMMENT ON TABLE expenses IS '지출 내역 관리';
COMMENT ON COLUMN expenses.expense_category IS '지출 카테고리 (테넌트 설정에서 정의)';
COMMENT ON COLUMN expenses.office_location IS '사무실 (테넌트 설정에서 정의)';
COMMENT ON COLUMN expenses.month_key IS '월별 집계용 키 (YYYY-MM)';

-- ============================================================================
-- 3. recurring_templates 테이블 (고정 지출 템플릿)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 템플릿 정보
  name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보 (테넌트 설정에서 정의)
  expense_category TEXT NOT NULL,
  subcategory TEXT,
  office_location TEXT,

  -- 상세 정보
  vendor_name TEXT,
  payment_method TEXT,
  memo TEXT,

  -- 반복 설정
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE,
  day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 28),

  -- 관리 정보
  admin_notes TEXT,

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK 제약조건: expenses.recurring_template_id
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_recurring_template
FOREIGN KEY (recurring_template_id)
REFERENCES recurring_templates(id)
ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_recurring_templates_tenant_id ON recurring_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_is_active ON recurring_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_expense_category ON recurring_templates(expense_category);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_start_date ON recurring_templates(start_date);

-- 코멘트
COMMENT ON TABLE recurring_templates IS '고정 지출 템플릿';
COMMENT ON COLUMN recurring_templates.day_of_month IS '매월 발생일 (1-28)';

-- ============================================================================
-- 4. receivable_writeoffs 테이블 (미수금 포기 이력)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receivable_writeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- 정보
  case_name TEXT NOT NULL,
  client_name TEXT,
  original_amount NUMERIC NOT NULL DEFAULT 0,

  -- 사유
  reason TEXT,

  -- 메타데이터
  written_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  written_off_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_tenant_id ON receivable_writeoffs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_case_id ON receivable_writeoffs(case_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_written_off_at ON receivable_writeoffs(written_off_at DESC);

-- 코멘트
COMMENT ON TABLE receivable_writeoffs IS '미수금 포기 이력';

-- ============================================================================
-- 5. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_templates_updated_at ON recurring_templates;
CREATE TRIGGER update_recurring_templates_updated_at
  BEFORE UPDATE ON recurring_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_payments_tenant_id ON payments;
CREATE TRIGGER set_payments_tenant_id
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_expenses_tenant_id ON expenses;
CREATE TRIGGER set_expenses_tenant_id
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_recurring_templates_tenant_id ON recurring_templates;
CREATE TRIGGER set_recurring_templates_tenant_id
  BEFORE INSERT ON recurring_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_receivable_writeoffs_tenant_id ON receivable_writeoffs;
CREATE TRIGGER set_receivable_writeoffs_tenant_id
  BEFORE INSERT ON receivable_writeoffs
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 6.5 트리거: expenses.month_key 자동 설정
-- ============================================================================
CREATE OR REPLACE FUNCTION set_expense_month_key()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month_key := TO_CHAR(NEW.expense_date, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_expenses_month_key ON expenses;
CREATE TRIGGER set_expenses_month_key
  BEFORE INSERT OR UPDATE OF expense_date ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_month_key();

-- ============================================================================
-- 7. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_writeoffs ENABLE ROW LEVEL SECURITY;

-- payments: 테넌트 격리
CREATE POLICY "tenant_isolation_payments" ON payments
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- expenses: 테넌트 격리 + admin 이상만 접근
CREATE POLICY "tenant_admin_expenses" ON expenses
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- recurring_templates: 테넌트 격리 + admin 이상만 접근
CREATE POLICY "tenant_admin_recurring_templates" ON recurring_templates
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- receivable_writeoffs: 테넌트 격리
CREATE POLICY "tenant_isolation_receivable_writeoffs" ON receivable_writeoffs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 8. 통계 뷰
-- ============================================================================

-- 사건별 입금 합계
CREATE OR REPLACE VIEW case_payment_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.court_case_number,
  lc.case_name,
  COUNT(p.id) as payment_count,
  COALESCE(SUM(p.amount), 0) as total_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '착수금' THEN p.amount ELSE 0 END), 0) as retainer_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '잔금' THEN p.amount ELSE 0 END), 0) as balance_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '성공보수' THEN p.amount ELSE 0 END), 0) as success_fee_amount,
  MIN(p.payment_date) as first_payment_date,
  MAX(p.payment_date) as last_payment_date
FROM legal_cases lc
LEFT JOIN payments p ON lc.id = p.case_id
GROUP BY lc.id, lc.tenant_id, lc.court_case_number, lc.case_name;

COMMENT ON VIEW case_payment_summary IS '사건별 입금 합계 뷰';

-- ============================================================================
-- 완료
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - 알림 도메인
-- 생성일: 2026-02-01
-- 설명: notification_templates, notification_logs, notification_schedules
-- ============================================================================

-- ============================================================================
-- 1. notification_templates 테이블 (알림 템플릿)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL이면 시스템 기본

  -- 템플릿 정보
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms',            -- sms, kakao_alimtalk, email, push
  category TEXT NOT NULL,                         -- hearing_reminder, consultation_reminder, deadline_reminder, manual

  -- 내용
  title TEXT,                                     -- 알림톡용 제목
  content TEXT NOT NULL,                          -- 메시지 내용 (변수는 {{변수명}} 형식)

  -- 변수
  variables JSONB DEFAULT '[]'::jsonb,            -- 사용 가능한 변수 목록

  -- SMS 설정
  message_type TEXT DEFAULT 'SMS',                -- SMS, LMS

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_id ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_category ON notification_templates(category);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- 코멘트
COMMENT ON TABLE notification_templates IS '알림 메시지 템플릿 관리';
COMMENT ON COLUMN notification_templates.tenant_id IS 'NULL이면 시스템 기본 템플릿';
COMMENT ON COLUMN notification_templates.variables IS '템플릿에서 사용 가능한 변수 목록 (예: ["이름", "날짜"])';

-- 기본 템플릿 삽입 (시스템 기본, tenant_id = NULL)
INSERT INTO notification_templates (tenant_id, name, channel, category, content, variables, message_type) VALUES
-- 재판기일 알림
(NULL, '재판기일 리마인더', 'sms', 'hearing_reminder',
'[법률 사무소]
{{의뢰인명}}님, 내일 재판 일정이 있습니다.

📅 일시: {{재판일시}}
📍 법원: {{법원명}}
📋 사건번호: {{사건번호}}

참석 부탁드립니다.',
'["의뢰인명", "재판일시", "법원명", "사건번호"]'::jsonb,
'LMS'),

-- 상담 리마인더
(NULL, '상담 리마인더', 'sms', 'consultation_reminder',
'[법률 사무소]
{{이름}}님, 내일 상담 일정을 알려드립니다.

📅 일시: {{상담일시}}
📍 장소: {{상담장소}}

잊지 말고 참석해 주세요!',
'["이름", "상담일시", "상담장소"]'::jsonb,
'SMS'),

-- 기한 마감 알림
(NULL, '기한 마감 알림', 'sms', 'deadline_reminder',
'[법률 사무소]
{{의뢰인명}}님, 중요한 기한을 알려드립니다.

📅 기한: {{기한일시}}
📋 내용: {{기한내용}}
📁 사건: {{사건명}}

기한 준수 부탁드립니다.',
'["의뢰인명", "기한일시", "기한내용", "사건명"]'::jsonb,
'LMS'),

-- 수동 발송용 기본 템플릿
(NULL, '일반 안내', 'sms', 'manual',
'[법률 사무소]
{{이름}}님께 안내드립니다.

{{내용}}',
'["이름", "내용"]'::jsonb,
'SMS')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. notification_logs 테이블 (알림 발송 이력)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,

  -- 수신자 정보
  recipient_type TEXT NOT NULL,                   -- client, consultation
  recipient_id UUID,                              -- clients.id 또는 consultations.id
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,

  -- 발송 정보
  channel TEXT NOT NULL,                          -- sms, kakao_alimtalk, email, push
  message_type TEXT DEFAULT 'SMS',                -- SMS, LMS
  content TEXT NOT NULL,                          -- 실제 발송된 내용

  -- 상태 정보
  status TEXT DEFAULT 'pending',                  -- pending, sent, delivered, failed, cancelled
  error_message TEXT,
  provider_message_id TEXT,                       -- 외부 서비스 메시지 ID (Solapi 등)
  cost DECIMAL(10, 2),                            -- 발송 비용

  -- 연관 정보
  related_type TEXT,                              -- hearing, consultation, deadline, case
  related_id UUID,                                -- court_hearings.id, consultations.id 등

  -- 시간 정보
  scheduled_at TIMESTAMPTZ,                       -- 예약 발송 시간
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_phone ON notification_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_related ON notification_logs(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_template ON notification_logs(template_id);

-- 코멘트
COMMENT ON TABLE notification_logs IS '알림 발송 이력';
COMMENT ON COLUMN notification_logs.status IS '발송 상태: pending(대기), sent(발송), delivered(전달), failed(실패), cancelled(취소)';

-- ============================================================================
-- 3. notification_schedules 테이블 (자동 발송 설정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 카테고리
  category TEXT NOT NULL,                         -- hearing_reminder, consultation_reminder, deadline_reminder
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,

  -- 발송 설정
  days_before INTEGER DEFAULT 1,                  -- 몇 일 전 발송
  time_of_day TIME DEFAULT '09:00',               -- 발송 시각
  channel TEXT DEFAULT 'sms',                     -- sms, kakao_alimtalk, both

  -- 상태
  is_active BOOLEAN DEFAULT true,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, category)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_schedules_tenant_id ON notification_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_category ON notification_schedules(category);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_is_active ON notification_schedules(is_active);

-- 코멘트
COMMENT ON TABLE notification_schedules IS '자동 발송 설정';
COMMENT ON COLUMN notification_schedules.days_before IS '이벤트 며칠 전 발송';
COMMENT ON COLUMN notification_schedules.time_of_day IS '발송 시각';

-- ============================================================================
-- 4. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_schedules_updated_at ON notification_schedules;
CREATE TRIGGER update_notification_schedules_updated_at
  BEFORE UPDATE ON notification_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_notification_logs_tenant_id ON notification_logs;
CREATE TRIGGER set_notification_logs_tenant_id
  BEFORE INSERT ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_notification_schedules_tenant_id ON notification_schedules;
CREATE TRIGGER set_notification_schedules_tenant_id
  BEFORE INSERT ON notification_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 6. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

-- notification_templates: 시스템 템플릿(tenant_id=NULL)은 모두 조회 가능
CREATE POLICY "view_system_templates" ON notification_templates
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR is_super_admin() OR tenant_id = get_current_tenant_id());

-- notification_templates: 테넌트 템플릿 관리
CREATE POLICY "manage_tenant_templates" ON notification_templates
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id IS NOT NULL AND tenant_id = get_current_tenant_id())
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id IS NOT NULL AND tenant_id = get_current_tenant_id())
  );

-- notification_logs: 테넌트 격리
CREATE POLICY "tenant_isolation_notification_logs" ON notification_logs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- notification_schedules: 테넌트 격리
CREATE POLICY "tenant_isolation_notification_schedules" ON notification_schedules
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 7. 통계 뷰
-- ============================================================================

-- 최근 발송 현황
CREATE OR REPLACE VIEW v_recent_notification_activity AS
SELECT
  nl.id,
  nl.tenant_id,
  nl.created_at,
  nl.recipient_name,
  nl.recipient_phone,
  nl.channel,
  nl.message_type,
  nl.status,
  nl.cost,
  nl.related_type,
  nt.name as template_name,
  nt.category as template_category
FROM notification_logs nl
LEFT JOIN notification_templates nt ON nl.template_id = nt.id
ORDER BY nl.created_at DESC
LIMIT 100;

COMMENT ON VIEW v_recent_notification_activity IS '최근 알림 발송 현황';

-- ============================================================================
-- 완료
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - 대법원 연동 도메인
-- 생성일: 2026-02-01
-- 설명: scourt_profiles, scourt_case_snapshots, scourt_case_updates, scourt_sync_logs
-- ============================================================================

-- ============================================================================
-- 1. scourt_profiles 테이블 (Puppeteer 프로필 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 프로필 정보
  profile_name VARCHAR(100) NOT NULL,             -- userDataDir 이름
  member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 사건 수 관리
  case_count INTEGER DEFAULT 0,
  max_cases INTEGER DEFAULT 50,

  -- 상태
  status VARCHAR(20) DEFAULT 'active',            -- active, full, corrupted

  -- 동기화 정보
  last_sync_at TIMESTAMPTZ,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, profile_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_profiles_tenant_id ON scourt_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profiles_member_id ON scourt_profiles(member_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profiles_status ON scourt_profiles(status);

-- 코멘트
COMMENT ON TABLE scourt_profiles IS '대법원 나의사건검색 Puppeteer 프로필';
COMMENT ON COLUMN scourt_profiles.profile_name IS 'userDataDir 이름';
COMMENT ON COLUMN scourt_profiles.max_cases IS '프로필당 최대 사건 수';

-- ============================================================================
-- 2. scourt_profile_cases 테이블 (프로필별 저장된 사건)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_profile_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES scourt_profiles(id) ON DELETE CASCADE,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,

  -- 사건 정보
  court_code VARCHAR(10),
  court_name VARCHAR(100),
  case_number VARCHAR(50) NOT NULL,               -- 예: 2024드단26718
  case_name VARCHAR(200),
  enc_cs_no TEXT,                                 -- 암호화된 사건번호 (상세조회용)

  -- 메타데이터
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(profile_id, case_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_tenant_id ON scourt_profile_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_profile_id ON scourt_profile_cases(profile_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_legal_case_id ON scourt_profile_cases(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_case_number ON scourt_profile_cases(case_number);

-- 코멘트
COMMENT ON TABLE scourt_profile_cases IS '프로필별 저장된 사건 목록';

-- ============================================================================
-- 3. scourt_case_snapshots 테이블 (사건 스냅샷)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_case_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES scourt_profiles(id) ON DELETE SET NULL,

  -- 스냅샷 시점
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- 원본 데이터 (구조화)
  basic_info JSONB NOT NULL DEFAULT '{}',         -- 기본정보 (사건번호, 당사자, 재판부 등)
  hearings JSONB NOT NULL DEFAULT '[]',           -- 기일 목록
  progress JSONB NOT NULL DEFAULT '[]',           -- 진행내용 (송달, 제출 등)
  documents JSONB NOT NULL DEFAULT '[]',          -- 제출서류
  lower_court JSONB NOT NULL DEFAULT '[]',        -- 심급내용

  -- 원본 raw 데이터
  raw_data JSONB,                                 -- 전체 원본 데이터

  -- 메타데이터
  case_type VARCHAR(20),                          -- family, criminal, civil
  court_code VARCHAR(20),
  case_number VARCHAR(50),

  -- 해시 (변경 감지용)
  content_hash VARCHAR(64),                       -- SHA256 of all content

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_tenant_id ON scourt_case_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_legal_case ON scourt_case_snapshots(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_scraped_at ON scourt_case_snapshots(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_case_number ON scourt_case_snapshots(case_number);

-- 코멘트
COMMENT ON TABLE scourt_case_snapshots IS '대법원 사건 스냅샷 (매 동기화마다 전체 상태 저장)';
COMMENT ON COLUMN scourt_case_snapshots.content_hash IS '변경 감지용 해시 (SHA256)';

-- ============================================================================
-- 4. scourt_case_updates 테이블 (변경 감지)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_case_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES scourt_case_snapshots(id) ON DELETE SET NULL,

  -- 변경 감지 시점
  detected_at TIMESTAMPTZ DEFAULT NOW(),

  -- 변경 유형
  update_type VARCHAR(50) NOT NULL,               -- hearing_new, hearing_changed, document_filed, served, result_announced 등

  -- 변경 요약 (한글)
  update_summary TEXT NOT NULL,                   -- 예: "2026.01.28 11:40 변론기일 추가"

  -- 상세 정보
  details JSONB NOT NULL DEFAULT '{}',

  -- 이전/이후 값 (비교용)
  old_value JSONB,
  new_value JSONB,

  -- 중요도
  importance VARCHAR(20) DEFAULT 'normal',        -- high, normal, low

  -- 읽음 상태
  is_read_by_admin BOOLEAN DEFAULT false,
  is_read_by_client BOOLEAN DEFAULT false,
  read_at_admin TIMESTAMPTZ,
  read_at_client TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_updates_tenant_id ON scourt_case_updates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_legal_case ON scourt_case_updates(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_detected_at ON scourt_case_updates(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_type ON scourt_case_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_importance ON scourt_case_updates(importance);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_unread_client ON scourt_case_updates(legal_case_id) WHERE is_read_by_client = false;

-- 코멘트
COMMENT ON TABLE scourt_case_updates IS '대법원 사건 변경 감지 내역';
COMMENT ON COLUMN scourt_case_updates.update_type IS '변경 유형: hearing_new, hearing_changed, document_filed, served, result_announced 등';
COMMENT ON COLUMN scourt_case_updates.importance IS '중요도: high(기일/판결), normal(서류), low(기타)';

-- ============================================================================
-- 5. scourt_sync_logs 테이블 (동기화 로그)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES scourt_profiles(id) ON DELETE SET NULL,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,

  -- 동기화 정보
  action VARCHAR(50) NOT NULL,                    -- search, detail, refresh, bulk_sync
  status VARCHAR(20) NOT NULL,                    -- success, failed, captcha_error, timeout

  -- 상세 정보
  captcha_attempts INTEGER DEFAULT 0,
  response_data JSONB,                            -- 조회된 데이터 (선택적 저장)
  error_message TEXT,
  duration_ms INTEGER,                            -- 소요 시간

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_tenant_id ON scourt_sync_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_profile_id ON scourt_sync_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_legal_case_id ON scourt_sync_logs(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_action ON scourt_sync_logs(action);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_status ON scourt_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_created_at ON scourt_sync_logs(created_at DESC);

-- 코멘트
COMMENT ON TABLE scourt_sync_logs IS '대법원 동기화 로그';
COMMENT ON COLUMN scourt_sync_logs.action IS '동기화 액션: search, detail, refresh, bulk_sync';
COMMENT ON COLUMN scourt_sync_logs.status IS '상태: success, failed, captcha_error, timeout';

-- ============================================================================
-- 6. scourt_update_types 테이블 (업데이트 유형 정의)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scourt_update_types (
  code VARCHAR(50) PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  importance VARCHAR(20) DEFAULT 'normal',
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 유형 삽입
INSERT INTO scourt_update_types (code, name_ko, importance, icon) VALUES
  ('hearing_new', '기일 지정', 'high', 'calendar-plus'),
  ('hearing_changed', '기일 변경', 'high', 'calendar-edit'),
  ('hearing_canceled', '기일 취소', 'high', 'calendar-x'),
  ('hearing_result', '기일 결과', 'high', 'gavel'),
  ('document_filed', '서류 제출', 'normal', 'file-plus'),
  ('document_served', '서류 송달', 'normal', 'send'),
  ('served', '송달 도달', 'normal', 'check-circle'),
  ('result_announced', '판결/결정', 'high', 'scale'),
  ('appeal_filed', '상소 제기', 'high', 'arrow-up'),
  ('status_changed', '상태 변경', 'normal', 'refresh'),
  ('party_changed', '당사자 변경', 'low', 'users'),
  ('other', '기타', 'low', 'info')
ON CONFLICT (code) DO NOTHING;

-- 코멘트
COMMENT ON TABLE scourt_update_types IS '대법원 업데이트 유형 정의';

-- ============================================================================
-- 7. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_scourt_profiles_updated_at ON scourt_profiles;
CREATE TRIGGER update_scourt_profiles_updated_at
  BEFORE UPDATE ON scourt_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 트리거: 프로필 사건 수 자동 업데이트
-- ============================================================================
CREATE OR REPLACE FUNCTION update_scourt_profile_case_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE scourt_profiles
    SET case_count = case_count + 1,
        status = CASE WHEN case_count + 1 >= max_cases THEN 'full' ELSE status END
    WHERE id = NEW.profile_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE scourt_profiles
    SET case_count = GREATEST(case_count - 1, 0),
        status = CASE WHEN status = 'full' THEN 'active' ELSE status END
    WHERE id = OLD.profile_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_profile_case_count ON scourt_profile_cases;
CREATE TRIGGER trigger_scourt_profile_case_count
  AFTER INSERT OR DELETE ON scourt_profile_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_profile_case_count();

-- ============================================================================
-- 9. 트리거: 미읽음 업데이트 수 갱신 (legal_cases)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_scourt_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE legal_cases
  SET scourt_unread_updates = (
    SELECT COUNT(*)
    FROM scourt_case_updates
    WHERE legal_case_id = COALESCE(NEW.legal_case_id, OLD.legal_case_id)
      AND is_read_by_client = false
  )
  WHERE id = COALESCE(NEW.legal_case_id, OLD.legal_case_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_unread_count ON scourt_case_updates;
CREATE TRIGGER trigger_scourt_unread_count
  AFTER INSERT OR UPDATE OF is_read_by_client OR DELETE
  ON scourt_case_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_unread_count();

-- ============================================================================
-- 10. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_scourt_profiles_tenant_id ON scourt_profiles;
CREATE TRIGGER set_scourt_profiles_tenant_id
  BEFORE INSERT ON scourt_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_scourt_profile_cases_tenant_id ON scourt_profile_cases;
CREATE TRIGGER set_scourt_profile_cases_tenant_id
  BEFORE INSERT ON scourt_profile_cases
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_scourt_case_snapshots_tenant_id ON scourt_case_snapshots;
CREATE TRIGGER set_scourt_case_snapshots_tenant_id
  BEFORE INSERT ON scourt_case_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_scourt_case_updates_tenant_id ON scourt_case_updates;
CREATE TRIGGER set_scourt_case_updates_tenant_id
  BEFORE INSERT ON scourt_case_updates
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_scourt_sync_logs_tenant_id ON scourt_sync_logs;
CREATE TRIGGER set_scourt_sync_logs_tenant_id
  BEFORE INSERT ON scourt_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 11. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE scourt_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scourt_profile_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE scourt_case_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scourt_case_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scourt_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scourt_update_types ENABLE ROW LEVEL SECURITY;

-- scourt_update_types: 모두 조회 가능
CREATE POLICY "anyone_can_view_update_types" ON scourt_update_types
  FOR SELECT TO authenticated
  USING (true);

-- scourt_profiles: 테넌트 격리
CREATE POLICY "tenant_isolation_scourt_profiles" ON scourt_profiles
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- scourt_profile_cases: 테넌트 격리
CREATE POLICY "tenant_isolation_scourt_profile_cases" ON scourt_profile_cases
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- scourt_case_snapshots: 테넌트 격리
CREATE POLICY "tenant_isolation_scourt_case_snapshots" ON scourt_case_snapshots
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- scourt_case_updates: 테넌트 격리
CREATE POLICY "tenant_isolation_scourt_case_updates" ON scourt_case_updates
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- scourt_sync_logs: 테넌트 격리
CREATE POLICY "tenant_isolation_scourt_sync_logs" ON scourt_sync_logs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 12. 뷰: 사건별 최신 업데이트 요약
-- ============================================================================
CREATE OR REPLACE VIEW scourt_case_update_summary AS
SELECT
  lc.id as legal_case_id,
  lc.tenant_id,
  lc.court_case_number as case_number,
  lc.case_name,
  lc.scourt_unread_updates,
  lc.scourt_next_hearing,
  (
    SELECT json_agg(u ORDER BY u.detected_at DESC)
    FROM (
      SELECT id, update_type, update_summary, detected_at, importance, is_read_by_client
      FROM scourt_case_updates
      WHERE legal_case_id = lc.id
      ORDER BY detected_at DESC
      LIMIT 5
    ) u
  ) as recent_updates,
  (
    SELECT MAX(detected_at)
    FROM scourt_case_updates
    WHERE legal_case_id = lc.id
  ) as last_update_at
FROM legal_cases lc
WHERE lc.scourt_last_sync IS NOT NULL;

COMMENT ON VIEW scourt_case_update_summary IS '사건별 대법원 업데이트 요약';

-- ============================================================================
-- 완료
-- ============================================================================
-- ============================================================================
-- 법률 사무소 SaaS - 통합 뷰
-- 생성일: 2026-02-01
-- 설명: unified_calendar, upcoming_hearings, urgent_deadlines 등 통합 뷰
-- ============================================================================

-- ============================================================================
-- 1. unified_calendar 뷰 (통합 캘린더)
-- ============================================================================
DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type::TEXT
      WHEN 'HEARING_MAIN' THEN '변론기일'
      WHEN 'HEARING_INTERIM' THEN '중간심문'
      WHEN 'HEARING_MEDIATION' THEN '조정기일'
      WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
      WHEN 'HEARING_PARENTING' THEN '양육상담'
      WHEN 'HEARING_JUDGMENT' THEN '선고기일'
      WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
      WHEN 'HEARING_SENTENCE' THEN '형사 선고'
      WHEN 'HEARING_TRIAL' THEN '공판기일'
      WHEN 'HEARING_EXAMINATION' THEN '증인신문'
      ELSE ch.hearing_type::TEXT
    END,
    ') ', COALESCE(lc.case_name, ch.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, ch.case_number)::TEXT AS case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date AS event_datetime,
  COALESCE(ch.case_number, lc.court_case_number)::TEXT AS reference_id,
  CASE
    WHEN lc.court_name IS NOT NULL AND ch.location IS NOT NULL THEN lc.court_name || ' ' || ch.location
    WHEN lc.court_name IS NOT NULL THEN lc.court_name
    ELSE ch.location
  END::TEXT AS location,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  ch.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 출석변호사 정보
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 당사자 정보 (의뢰인)
  (
    SELECT party_name
    FROM case_parties cp
    WHERE cp.case_id = ch.case_id AND cp.is_our_client = true
    LIMIT 1
  )::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN tenant_members tm_attending ON ch.attending_lawyer_id = tm_attending.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 2. 사건 데드라인 (DEADLINE)
SELECT
  cd.id,
  'DEADLINE'::TEXT AS event_type,
  '데드라인'::TEXT AS event_type_kr,
  cd.deadline_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type::TEXT
      WHEN 'DL_APPEAL' THEN '상소기간'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
      WHEN 'DL_APPEAL_BRIEF_HIGH' THEN '상고이유서'
      WHEN 'DL_RETRIAL' THEN '재심기한'
      WHEN 'DL_CRIMINAL_APPEAL' THEN '형사상소기간'
      WHEN 'DL_FAMILY_NONLIT' THEN '비송즉시항고'
      WHEN 'DL_PAYMENT_ORDER' THEN '지급명령이의'
      WHEN 'DL_ELEC_SERVICE' THEN '전자송달'
      WHEN 'DL_CUSTOM' THEN COALESCE(cd.custom_deadline_name, '사용자정의')
      ELSE cd.deadline_type::TEXT
    END,
    ') ', COALESCE(lc.case_name, cd.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, cd.case_number)::TEXT AS case_name,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  (cd.deadline_date::TEXT || ' 00:00:00')::TIMESTAMP AS event_datetime,
  COALESCE(cd.case_number, lc.court_case_number)::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  cd.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 담당변호사 (사건 담당자)
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (데드라인에 연결된 당사자 또는 의뢰인)
  COALESCE(
    (SELECT cp.party_name FROM case_parties cp WHERE cp.id = cd.case_party_id),
    (SELECT cp.party_name FROM case_parties cp WHERE cp.case_id = cd.case_id AND cp.is_our_client = true LIMIT 1)
  )::TEXT AS our_client_name,
  -- 정렬 우선순위
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 3. 상담 (CONSULTATION)
SELECT
  c.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담'::TEXT AS event_type_kr,
  c.request_type::TEXT AS event_subtype,
  ('(상담) ' || c.name)::TEXT AS title,
  c.name::TEXT AS case_name,
  c.preferred_date::DATE AS event_date,
  COALESCE(c.preferred_time, '00:00')::TEXT AS event_time,
  (c.preferred_date::TEXT || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  c.phone::TEXT AS reference_id,
  NULL::TEXT AS location,
  c.message::TEXT AS description,
  c.status::TEXT AS status,
  NULL::TEXT AS case_id,
  c.tenant_id::TEXT AS tenant_id,
  -- 담당자
  c.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (상담자 본인)
  c.name::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations c
LEFT JOIN tenant_members tm_assigned ON c.assigned_to = tm_assigned.id
WHERE c.preferred_date IS NOT NULL

UNION ALL

-- 4. 일반 일정 (GENERAL_SCHEDULE)
SELECT
  gs.id,
  'GENERAL_SCHEDULE'::TEXT AS event_type,
  '일반일정'::TEXT AS event_type_kr,
  gs.schedule_type::TEXT AS event_subtype,
  gs.title::TEXT AS title,
  NULL::TEXT AS case_name,
  gs.schedule_date AS event_date,
  COALESCE(gs.schedule_time::TEXT, '00:00') AS event_time,
  (gs.schedule_date::TEXT || ' ' || COALESCE(gs.schedule_time::TEXT, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  NULL::TEXT AS reference_id,
  gs.location::TEXT AS location,
  gs.description::TEXT AS description,
  gs.status::TEXT AS status,
  NULL::TEXT AS case_id,
  gs.tenant_id::TEXT AS tenant_id,
  -- 담당자
  gs.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (해당없음)
  NULL::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN gs.schedule_time IS NULL THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs
LEFT JOIN tenant_members tm_assigned ON gs.assigned_to = tm_assigned.id;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정을 통합한 캘린더 뷰';

-- ============================================================================
-- 2. upcoming_hearings 뷰 (7일 이내 기일)
-- ============================================================================
CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT
  ch.*,
  lc.case_name,
  lc.court_case_number,
  lc.tenant_id
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
WHERE ch.status = 'SCHEDULED'
  AND ch.hearing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY ch.hearing_date, ch.location;

COMMENT ON VIEW upcoming_hearings IS '7일 이내 예정된 기일 목록';

-- ============================================================================
-- 3. urgent_deadlines 뷰 (3일 이내 데드라인)
-- ============================================================================
CREATE OR REPLACE VIEW urgent_deadlines AS
SELECT
  cd.*,
  dt.name as deadline_name,
  lc.case_name,
  lc.court_case_number,
  lc.tenant_id
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
JOIN legal_cases lc ON cd.case_id = lc.id
WHERE cd.status = 'PENDING'
  AND cd.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY cd.deadline_date;

COMMENT ON VIEW urgent_deadlines IS '3일 이내 마감 데드라인 목록';

-- ============================================================================
-- 4. receivables_summary 뷰 (미수금 요약)
-- ============================================================================
CREATE OR REPLACE VIEW receivables_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.case_name,
  lc.court_case_number,
  lc.status as case_status,
  lc.receivable_grade,
  -- 수임료 합계 (case_clients에서 집계)
  COALESCE((
    SELECT SUM(cc.retainer_fee)
    FROM case_clients cc
    WHERE cc.case_id = lc.id
  ), 0) as total_fee,
  -- 입금 합계
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as total_paid,
  -- 미수금 (수임료 - 입금)
  COALESCE((
    SELECT SUM(cc.retainer_fee)
    FROM case_clients cc
    WHERE cc.case_id = lc.id
  ), 0) - COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as receivable_amount,
  -- 의뢰인 정보
  (
    SELECT c.name
    FROM case_clients cc
    JOIN clients c ON cc.client_id = c.id
    WHERE cc.case_id = lc.id AND cc.is_primary_client = true
    LIMIT 1
  ) as client_name,
  (
    SELECT c.phone
    FROM case_clients cc
    JOIN clients c ON cc.client_id = c.id
    WHERE cc.case_id = lc.id AND cc.is_primary_client = true
    LIMIT 1
  ) as client_phone
FROM legal_cases lc
WHERE lc.status = 'active';

COMMENT ON VIEW receivables_summary IS '사건별 미수금 요약';

-- ============================================================================
-- 5. monthly_revenue_summary 뷰 (월별 수입 합계)
-- ============================================================================
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT
  p.tenant_id,
  DATE_TRUNC('month', p.payment_date)::DATE as month,
  COALESCE(p.office_location, '미지정') as office_location,
  p.payment_category,
  COUNT(*) as payment_count,
  SUM(p.amount) as total_amount
FROM payments p
WHERE p.amount > 0
GROUP BY p.tenant_id, DATE_TRUNC('month', p.payment_date), p.office_location, p.payment_category
ORDER BY month DESC, office_location, payment_category;

COMMENT ON VIEW monthly_revenue_summary IS '월별 수입 합계 뷰';

-- ============================================================================
-- 6. monthly_expense_summary 뷰 (월별 지출 합계)
-- ============================================================================
CREATE OR REPLACE VIEW monthly_expense_summary AS
SELECT
  e.tenant_id,
  DATE_TRUNC('month', e.expense_date)::DATE as month,
  COALESCE(e.office_location, '미지정') as office_location,
  e.expense_category,
  COUNT(*) as expense_count,
  SUM(e.amount) as total_amount,
  COUNT(CASE WHEN e.is_recurring = true THEN 1 END) as recurring_count,
  SUM(CASE WHEN e.is_recurring = true THEN e.amount ELSE 0 END) as recurring_total
FROM expenses e
GROUP BY e.tenant_id, DATE_TRUNC('month', e.expense_date), e.office_location, e.expense_category
ORDER BY month DESC, office_location, expense_category;

COMMENT ON VIEW monthly_expense_summary IS '월별 지출 합계 뷰';

-- ============================================================================
-- 완료
-- ============================================================================
