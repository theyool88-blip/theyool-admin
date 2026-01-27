-- 상담 설정 테이블 생성
-- 전화 응대 시간, 모달 동작 설정 등을 저장

CREATE TABLE IF NOT EXISTS consultation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE consultation_settings ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회/수정 가능
CREATE POLICY "consultation_settings_admin_all" ON consultation_settings
  FOR ALL USING (true);

-- 공개 조회용 정책 (홈페이지에서 설정 조회)
CREATE POLICY "consultation_settings_public_read" ON consultation_settings
  FOR SELECT USING (setting_key IN ('phone_availability', 'modal_config'));

-- 기본 설정값 삽입
INSERT INTO consultation_settings (setting_key, setting_value, description) VALUES
(
  'phone_availability',
  '{
    "enabled": true,
    "fallback_to_form": true,
    "fallback_delay_seconds": 10,
    "business_hours": {
      "start": "09:00",
      "end": "18:00",
      "lunch_start": "12:00",
      "lunch_end": "13:00",
      "days": [1, 2, 3, 4, 5]
    },
    "holiday_fallback": true
  }'::jsonb,
  '전화 상담 가능 시간 설정'
),
(
  'modal_config',
  '{
    "phone_modal_enabled": true,
    "form_modal_enabled": true,
    "show_countdown": true,
    "countdown_seconds": 5,
    "auto_fallback_on_busy": true
  }'::jsonb,
  '상담 모달 동작 설정'
),
(
  'consultation_types',
  '{
    "callback": {"enabled": true, "label": "전화 상담"},
    "visit": {"enabled": true, "label": "방문 상담"},
    "video": {"enabled": true, "label": "화상 상담"},
    "info": {"enabled": false, "label": "정보 문의"}
  }'::jsonb,
  '상담 유형별 활성화 설정'
)
ON CONFLICT (setting_key) DO NOTHING;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_consultation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consultation_settings_updated_at
  BEFORE UPDATE ON consultation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_settings_updated_at();
