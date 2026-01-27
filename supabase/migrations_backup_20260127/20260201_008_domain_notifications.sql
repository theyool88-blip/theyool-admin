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
