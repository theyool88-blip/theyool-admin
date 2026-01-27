-- =====================================================
-- 테넌트별 Google OAuth 연동 시스템
-- 생성일: 2025-12-31
-- 설명: 각 테넌트가 자신의 Google 계정으로 Calendar/Drive 연결
-- =====================================================

-- =====================================================
-- 1. tenant_integrations 테이블 생성
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 연동 유형
  provider VARCHAR(50) NOT NULL,  -- 'google_calendar', 'google_drive'

  -- OAuth 토큰
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,

  -- 연동별 설정 (JSONB)
  -- Calendar: { "calendarId": "xxx@group.calendar.google.com", "calendarName": "케이스노트" }
  -- Drive: { "folderId": "xxx", "folderName": "의뢰인 파일" }
  settings JSONB DEFAULT '{}'::jsonb,

  -- 상태
  status VARCHAR(20) DEFAULT 'disconnected',  -- 'connected', 'disconnected', 'expired'
  connected_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),

  -- 웹훅 정보 (Calendar용)
  webhook_channel_id VARCHAR(200),
  webhook_resource_id VARCHAR(200),
  webhook_expiry TIMESTAMPTZ,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 한 테넌트당 하나의 provider만 연결 가능
  UNIQUE(tenant_id, provider)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_id
  ON tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_provider
  ON tenant_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_status
  ON tenant_integrations(status);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_provider
  ON tenant_integrations(tenant_id, provider);

-- 코멘트
COMMENT ON TABLE tenant_integrations IS '테넌트별 외부 서비스 연동 (Google Calendar, Drive 등)';
COMMENT ON COLUMN tenant_integrations.provider IS '연동 서비스: google_calendar, google_drive';
COMMENT ON COLUMN tenant_integrations.access_token IS 'OAuth access token (만료 시 자동 갱신)';
COMMENT ON COLUMN tenant_integrations.refresh_token IS 'OAuth refresh token (장기 보관)';
COMMENT ON COLUMN tenant_integrations.settings IS '연동별 설정 (calendarId, folderId 등)';
COMMENT ON COLUMN tenant_integrations.status IS 'connected: 연결됨, disconnected: 해제됨, expired: 토큰 만료';

-- =====================================================
-- 2. updated_at 자동 업데이트 트리거
-- =====================================================
DROP TRIGGER IF EXISTS update_tenant_integrations_updated_at ON tenant_integrations;
CREATE TRIGGER update_tenant_integrations_updated_at
  BEFORE UPDATE ON tenant_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. RLS (Row Level Security) 활성화
-- =====================================================
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS 정책
-- =====================================================

-- 4.1 service_role은 전체 접근 가능
CREATE POLICY "service_role_full_access_integrations" ON tenant_integrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 4.2 테넌트 멤버는 자신의 테넌트 연동만 조회 가능
CREATE POLICY "tenant_members_can_view_integrations" ON tenant_integrations
  FOR SELECT TO authenticated
  USING (
    -- 슈퍼 어드민은 모든 연동 조회 가능
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
    OR
    -- 테넌트 멤버는 자신의 테넌트만
    tenant_id IN (
      SELECT tm.tenant_id FROM tenant_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- 4.3 admin 이상만 연동 생성/수정/삭제 가능
CREATE POLICY "tenant_admins_can_manage_integrations" ON tenant_integrations
  FOR ALL TO authenticated
  USING (
    -- 슈퍼 어드민
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
    OR
    -- 테넌트의 owner 또는 admin
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_integrations.tenant_id
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    -- 슈퍼 어드민
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
    OR
    -- 테넌트의 owner 또는 admin
    EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = tenant_integrations.tenant_id
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 5. OAuth State 임시 저장 테이블 (CSRF 방지)
-- =====================================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(500) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 만료된 state 자동 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
  ON oauth_states(expires_at);

-- RLS
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_oauth_states" ON oauth_states
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE oauth_states IS 'OAuth 인증 중 CSRF 방지용 임시 state 저장';

-- =====================================================
-- 완료
-- =====================================================
