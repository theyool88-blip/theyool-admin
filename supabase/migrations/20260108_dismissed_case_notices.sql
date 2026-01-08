-- 사건 알림 삭제 기록 테이블
-- 변호사가 확인/처리한 알림을 저장하여 다시 표시되지 않도록 함

CREATE TABLE IF NOT EXISTS dismissed_case_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  notice_id TEXT NOT NULL,  -- 알림 고유 ID (예: next_hearing_2024-01-20, deadline_항소기한)
  dismissed_by UUID REFERENCES tenant_members(id),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 같은 사건의 같은 알림은 한 번만 삭제 가능
  UNIQUE(case_id, notice_id)
);

-- 인덱스
CREATE INDEX idx_dismissed_notices_case_id ON dismissed_case_notices(case_id);

-- RLS 정책
ALTER TABLE dismissed_case_notices ENABLE ROW LEVEL SECURITY;

-- tenant_members만 접근 가능
CREATE POLICY "tenant_members_can_manage_dismissed_notices" ON dismissed_case_notices
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE dismissed_case_notices IS '변호사가 삭제한 사건 알림 기록';
COMMENT ON COLUMN dismissed_case_notices.notice_id IS '알림 고유 ID (category + 날짜/내용 조합)';
