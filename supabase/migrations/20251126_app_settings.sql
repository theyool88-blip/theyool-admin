-- 앱 설정 테이블 (Google Calendar 토큰 등 저장용)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능
CREATE POLICY "Authenticated users can manage app_settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_app_settings_key ON app_settings(key);
