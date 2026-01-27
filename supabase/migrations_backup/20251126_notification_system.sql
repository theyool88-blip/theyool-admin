-- 알림 시스템 마이그레이션
-- 실행일: 2025-11-26
-- 목적: SMS/카카오 알림톡 통합 발송 시스템

-- 1. 알림 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 템플릿 이름
  channel TEXT NOT NULL DEFAULT 'sms',   -- 'sms', 'kakao_alimtalk'
  category TEXT NOT NULL,                -- 'hearing_reminder', 'consultation_reminder', 'deadline_reminder', 'manual'
  title TEXT,                            -- 알림톡용 제목
  content TEXT NOT NULL,                 -- 메시지 내용 (변수는 {{변수명}} 형식)
  variables JSONB DEFAULT '[]'::jsonb,   -- 사용 가능한 변수 목록
  message_type TEXT DEFAULT 'SMS',       -- 'SMS', 'LMS' (긴 문자)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 템플릿 인덱스
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

-- 2. 알림 발송 이력 테이블
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,

  -- 수신자 정보
  recipient_type TEXT NOT NULL,          -- 'client', 'consultation'
  recipient_id UUID,                      -- clients.id 또는 consultations.id
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,

  -- 발송 정보
  channel TEXT NOT NULL,                  -- 'sms', 'kakao_alimtalk'
  message_type TEXT DEFAULT 'SMS',        -- 'SMS', 'LMS'
  content TEXT NOT NULL,                  -- 실제 발송된 내용

  -- 상태 정보
  status TEXT DEFAULT 'pending',          -- 'pending', 'sent', 'delivered', 'failed'
  error_message TEXT,
  provider_message_id TEXT,               -- Solapi 메시지 ID
  cost DECIMAL(10, 2),                    -- 발송 비용

  -- 연관 정보
  related_type TEXT,                      -- 'hearing', 'consultation', 'deadline', 'case'
  related_id UUID,                        -- court_hearings.id, consultations.id, case_deadlines.id 등

  -- 시간 정보
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 발송 이력 인덱스
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient_phone);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_related ON notification_logs(related_type, related_id);
CREATE INDEX idx_notification_logs_template ON notification_logs(template_id);

-- 3. 자동 발송 설정 테이블
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,          -- 'hearing_reminder', 'consultation_reminder', 'deadline_reminder'
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  days_before INTEGER DEFAULT 1,          -- 몇 일 전 발송
  time_of_day TIME DEFAULT '09:00',       -- 발송 시각
  is_active BOOLEAN DEFAULT true,
  channel TEXT DEFAULT 'sms',             -- 'sms', 'kakao_alimtalk', 'both'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 기본 템플릿 데이터 삽입
INSERT INTO notification_templates (name, channel, category, content, variables, message_type) VALUES
-- 재판기일 알림
('재판기일 리마인더', 'sms', 'hearing_reminder',
'[법무법인 더율]
{{의뢰인명}}님, 내일 재판 일정이 있습니다.

📅 일시: {{재판일시}}
📍 법원: {{법원명}}
📋 사건번호: {{사건번호}}

참석 부탁드립니다.
문의: 02-1234-5678',
'["의뢰인명", "재판일시", "법원명", "사건번호"]'::jsonb,
'LMS'),

-- 상담 리마인더
('상담 리마인더', 'sms', 'consultation_reminder',
'[법무법인 더율]
{{이름}}님, 내일 상담 일정을 알려드립니다.

📅 일시: {{상담일시}}
📍 장소: {{상담장소}}

잊지 말고 참석해 주세요!
문의: 02-1234-5678',
'["이름", "상담일시", "상담장소"]'::jsonb,
'SMS'),

-- 기한 마감 알림
('기한 마감 알림', 'sms', 'deadline_reminder',
'[법무법인 더율]
{{의뢰인명}}님, 중요한 기한을 알려드립니다.

📅 기한: {{기한일시}}
📋 내용: {{기한내용}}
📁 사건: {{사건명}}

기한 준수 부탁드립니다.
문의: 02-1234-5678',
'["의뢰인명", "기한일시", "기한내용", "사건명"]'::jsonb,
'LMS'),

-- 수동 발송용 기본 템플릿
('일반 안내', 'sms', 'manual',
'[법무법인 더율]
{{이름}}님께 안내드립니다.

{{내용}}

문의: 02-1234-5678',
'["이름", "내용"]'::jsonb,
'SMS');

-- 5. 기본 자동 발송 설정 삽입
INSERT INTO notification_schedules (category, template_id, days_before, time_of_day, is_active, channel)
SELECT
  'hearing_reminder',
  id,
  1,
  '09:00'::TIME,
  true,
  'sms'
FROM notification_templates WHERE category = 'hearing_reminder' LIMIT 1;

INSERT INTO notification_schedules (category, template_id, days_before, time_of_day, is_active, channel)
SELECT
  'consultation_reminder',
  id,
  1,
  '09:00'::TIME,
  true,
  'sms'
FROM notification_templates WHERE category = 'consultation_reminder' LIMIT 1;

INSERT INTO notification_schedules (category, template_id, days_before, time_of_day, is_active, channel)
SELECT
  'deadline_reminder',
  id,
  1,
  '09:00'::TIME,
  true,
  'sms'
FROM notification_templates WHERE category = 'deadline_reminder' LIMIT 1;

-- 6. Row Level Security 정책
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자만 접근 가능 (애플리케이션 레벨에서 admin 체크)
CREATE POLICY "Allow all for authenticated users" ON notification_templates
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON notification_logs
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON notification_schedules
  FOR ALL USING (true);

-- 7. 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER update_notification_schedules_updated_at
    BEFORE UPDATE ON notification_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

-- 8. 유용한 뷰 생성
-- 최근 발송 현황
CREATE OR REPLACE VIEW v_recent_notification_activity AS
SELECT
    nl.id,
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

-- 발송 통계
CREATE OR REPLACE VIEW v_notification_statistics AS
SELECT
    DATE(created_at) as date,
    channel,
    COUNT(*) as total_sent,
    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(COALESCE(cost, 0)) as total_cost
FROM notification_logs
GROUP BY DATE(created_at), channel
ORDER BY date DESC;

-- 9. 코멘트
COMMENT ON TABLE notification_templates IS '알림 메시지 템플릿 관리';
COMMENT ON TABLE notification_logs IS '알림 발송 이력';
COMMENT ON TABLE notification_schedules IS '자동 발송 설정';
COMMENT ON COLUMN notification_templates.variables IS '템플릿에서 사용 가능한 변수 목록 (예: ["이름", "날짜"])';
COMMENT ON COLUMN notification_logs.status IS '발송 상태: pending(대기), sent(발송), delivered(전달), failed(실패)';
