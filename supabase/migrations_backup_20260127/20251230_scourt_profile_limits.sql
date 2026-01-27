-- 대법원 세션 시스템 - 프로필 풀 제한 설정
-- 2025-12-30

-- 사용자별 프로필 제한 설정 테이블
CREATE TABLE IF NOT EXISTS scourt_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,  -- 사용자 ID (null이면 기본 설정)
  max_profiles INTEGER DEFAULT 6,  -- 최대 프로필 수 (기본 6개 = 300건)
  max_cases_per_profile INTEGER DEFAULT 50,  -- 프로필당 최대 사건 수
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 설정 추가 (user_id = null)
INSERT INTO scourt_user_settings (user_id, max_profiles, max_cases_per_profile)
VALUES (null, 6, 50)
ON CONFLICT DO NOTHING;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_user_settings_user_id ON scourt_user_settings(user_id);

-- scourt_profiles에 user_id 컬럼 추가 (lawyer_id 대신 통일)
-- 이미 lawyer_id가 있으므로 그대로 사용

-- 프로필 사용량 조회 뷰
CREATE OR REPLACE VIEW scourt_profile_usage AS
SELECT
  p.lawyer_id as user_id,
  COUNT(p.id) as profile_count,
  SUM(p.case_count) as total_cases,
  SUM(p.max_cases) as total_capacity,
  COALESCE(s.max_profiles, 6) as max_profiles,
  COALESCE(s.max_profiles, 6) - COUNT(p.id) as remaining_profiles,
  COALESCE(s.max_profiles, 6) * COALESCE(s.max_cases_per_profile, 50) as max_total_cases
FROM scourt_profiles p
LEFT JOIN scourt_user_settings s ON s.user_id = p.lawyer_id OR s.user_id IS NULL
GROUP BY p.lawyer_id, s.max_profiles, s.max_cases_per_profile;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_scourt_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scourt_user_settings_updated_at ON scourt_user_settings;
CREATE TRIGGER trigger_scourt_user_settings_updated_at
  BEFORE UPDATE ON scourt_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_user_settings_updated_at();
