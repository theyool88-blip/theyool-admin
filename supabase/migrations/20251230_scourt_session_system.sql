-- 대법원 나의사건검색 세션 관리 시스템
-- 2025-12-30

-- scourt_profiles: Puppeteer 프로필(userDataDir) 관리
CREATE TABLE IF NOT EXISTS scourt_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID,  -- 변호사별 격리 (향후 사용)
  profile_name VARCHAR(100) NOT NULL UNIQUE,  -- userDataDir 이름
  case_count INTEGER DEFAULT 0,
  max_cases INTEGER DEFAULT 50,
  status VARCHAR(20) DEFAULT 'active',  -- active, full, corrupted
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_profiles_lawyer_id ON scourt_profiles(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profiles_status ON scourt_profiles(status);

-- scourt_profile_cases: 프로필별 저장된 사건 목록
CREATE TABLE IF NOT EXISTS scourt_profile_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES scourt_profiles(id) ON DELETE CASCADE,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  court_code VARCHAR(10),
  court_name VARCHAR(100),
  case_number VARCHAR(50) NOT NULL,  -- 예: 2024드단26718
  case_name VARCHAR(200),
  enc_cs_no TEXT,  -- 암호화된 사건번호 (상세조회용, nullable)
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, case_number)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_profile_id ON scourt_profile_cases(profile_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_legal_case_id ON scourt_profile_cases(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_case_number ON scourt_profile_cases(case_number);

-- scourt_sync_logs: 동기화 로그
CREATE TABLE IF NOT EXISTS scourt_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES scourt_profiles(id) ON DELETE SET NULL,
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- search, detail, refresh, bulk_sync
  status VARCHAR(20) NOT NULL,  -- success, failed, captcha_error, timeout
  captcha_attempts INTEGER DEFAULT 0,
  response_data JSONB,  -- 조회된 데이터 (선택적 저장)
  error_message TEXT,
  duration_ms INTEGER,  -- 소요 시간
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_profile_id ON scourt_sync_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_legal_case_id ON scourt_sync_logs(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_action ON scourt_sync_logs(action);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_status ON scourt_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_created_at ON scourt_sync_logs(created_at DESC);

-- legal_cases 테이블에 대법원 연동 필드 추가
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS scourt_last_sync TIMESTAMPTZ;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS scourt_raw_data JSONB;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS scourt_sync_status VARCHAR(20);  -- synced, pending, error

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_scourt_sync_status ON legal_cases(scourt_sync_status);

-- updated_at 자동 업데이트 트리거 (scourt_profiles)
CREATE OR REPLACE FUNCTION update_scourt_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_profiles_updated_at ON scourt_profiles;
CREATE TRIGGER trigger_scourt_profiles_updated_at
  BEFORE UPDATE ON scourt_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_profiles_updated_at();

-- 프로필의 사건 수 자동 업데이트 함수
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
