-- 연동안함 처리된 SCOURT 관련사건 저장
CREATE TABLE IF NOT EXISTS dismissed_related_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  related_case_no TEXT NOT NULL,           -- SCOURT 사건번호
  related_case_type TEXT NOT NULL,         -- 'lower_court' | 'related_case'
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(case_id, related_case_no, related_case_type)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_dismissed_related_cases_case ON dismissed_related_cases(case_id);

-- RLS
ALTER TABLE dismissed_related_cases ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (case_id 기반 - legal_cases와 연동)
DROP POLICY IF EXISTS "dismissed_related_cases_tenant_isolation" ON dismissed_related_cases;
CREATE POLICY "dismissed_related_cases_tenant_isolation" ON dismissed_related_cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = dismissed_related_cases.case_id
      AND lc.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );
