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
