-- 사건 테이블에 추가 필드 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS success_fee_agreement TEXT,
ADD COLUMN IF NOT EXISTS calculated_success_fee BIGINT DEFAULT 0;

-- 관련 사건 연결을 위한 테이블 생성
CREATE TABLE IF NOT EXISTS case_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
    related_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
    relation_type TEXT, -- '항소', '상고', '반소', '관련사건' 등
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(case_id, related_case_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_case_relations_case_id ON case_relations(case_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_related_case_id ON case_relations(related_case_id);

-- RLS 정책 추가
ALTER TABLE case_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자와 직원은 모든 사건 관계를 볼 수 있습니다"
ON case_relations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users_profiles
    WHERE users_profiles.auth_user_id = auth.uid()
    AND users_profiles.is_active = true
  )
);

CREATE POLICY "관리자와 직원은 사건 관계를 추가할 수 있습니다"
ON case_relations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users_profiles
    WHERE users_profiles.auth_user_id = auth.uid()
    AND users_profiles.is_active = true
  )
);

CREATE POLICY "관리자와 직원은 사건 관계를 삭제할 수 있습니다"
ON case_relations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users_profiles
    WHERE users_profiles.auth_user_id = auth.uid()
    AND users_profiles.is_active = true
  )
);
