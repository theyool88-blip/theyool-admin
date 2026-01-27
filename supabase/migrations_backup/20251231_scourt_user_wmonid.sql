-- 사용자별 WMONID 관리 테이블
-- 2025-12-31
--
-- WMONID: 대법원 나의사건검색 세션 식별자
-- - 2년간 유효
-- - encCsNo가 이에 바인딩됨
-- - 만료 1개월 전 갱신

CREATE TABLE IF NOT EXISTS scourt_user_wmonid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wmonid VARCHAR(20) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- issued_at + 2년
  status VARCHAR(20) DEFAULT 'active',  -- active, expiring, expired, migrating
  case_count INTEGER DEFAULT 0,  -- 연결된 사건 수
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, wmonid)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_user_id ON scourt_user_wmonid(user_id);
CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_status ON scourt_user_wmonid(status);
CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_expires_at ON scourt_user_wmonid(expires_at);

-- 만료 임박 WMONID 조회용 (1개월 이내 만료)
CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_expiring
  ON scourt_user_wmonid(expires_at)
  WHERE status = 'active';

-- scourt_profile_cases에 user_wmonid_id 연결
ALTER TABLE scourt_profile_cases
  ADD COLUMN IF NOT EXISTS user_wmonid_id UUID REFERENCES scourt_user_wmonid(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_user_wmonid_id
  ON scourt_profile_cases(user_wmonid_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_scourt_user_wmonid_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_user_wmonid_updated_at ON scourt_user_wmonid;
CREATE TRIGGER trigger_scourt_user_wmonid_updated_at
  BEFORE UPDATE ON scourt_user_wmonid
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_user_wmonid_updated_at();

-- case_count 자동 업데이트
CREATE OR REPLACE FUNCTION update_scourt_user_wmonid_case_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.user_wmonid_id IS NOT NULL THEN
    UPDATE scourt_user_wmonid
    SET case_count = case_count + 1
    WHERE id = NEW.user_wmonid_id;
  ELSIF TG_OP = 'DELETE' AND OLD.user_wmonid_id IS NOT NULL THEN
    UPDATE scourt_user_wmonid
    SET case_count = GREATEST(case_count - 1, 0)
    WHERE id = OLD.user_wmonid_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_wmonid_id IS DISTINCT FROM NEW.user_wmonid_id THEN
      IF OLD.user_wmonid_id IS NOT NULL THEN
        UPDATE scourt_user_wmonid
        SET case_count = GREATEST(case_count - 1, 0)
        WHERE id = OLD.user_wmonid_id;
      END IF;
      IF NEW.user_wmonid_id IS NOT NULL THEN
        UPDATE scourt_user_wmonid
        SET case_count = case_count + 1
        WHERE id = NEW.user_wmonid_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_profile_cases_wmonid_count ON scourt_profile_cases;
CREATE TRIGGER trigger_scourt_profile_cases_wmonid_count
  AFTER INSERT OR UPDATE OR DELETE ON scourt_profile_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_user_wmonid_case_count();

-- 만료 임박 WMONID 조회 뷰 (1개월 이내)
CREATE OR REPLACE VIEW scourt_expiring_wmonids AS
SELECT
  w.*,
  w.expires_at - INTERVAL '1 month' AS renewal_date,
  w.expires_at - NOW() AS time_remaining
FROM scourt_user_wmonid w
WHERE w.status = 'active'
  AND w.expires_at <= NOW() + INTERVAL '1 month';

-- 코멘트
COMMENT ON TABLE scourt_user_wmonid IS '사용자별 대법원 WMONID 관리. encCsNo가 WMONID에 바인딩됨.';
COMMENT ON COLUMN scourt_user_wmonid.wmonid IS '대법원 세션 식별자. 2년간 유효.';
COMMENT ON COLUMN scourt_user_wmonid.expires_at IS '만료일. 1개월 전에 갱신 필요.';
COMMENT ON COLUMN scourt_user_wmonid.status IS 'active: 사용중, expiring: 만료임박, expired: 만료됨, migrating: 마이그레이션중';
