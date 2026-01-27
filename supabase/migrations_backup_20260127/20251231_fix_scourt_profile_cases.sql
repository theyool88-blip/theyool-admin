-- scourt_profile_cases 테이블 수정
-- WMONID 기반 API 접근 방식 지원
-- 2025-12-31

-- 1. profile_id를 nullable로 변경 (API 기반은 프로필 없음)
ALTER TABLE scourt_profile_cases ALTER COLUMN profile_id DROP NOT NULL;

-- 2. user_wmonid_id 컬럼 추가 (scourt_user_wmonid 참조)
ALTER TABLE scourt_profile_cases ADD COLUMN IF NOT EXISTS user_wmonid_id UUID REFERENCES scourt_user_wmonid(id) ON DELETE SET NULL;

-- 3. legal_case_id에 unique constraint 추가 (upsert용)
-- 먼저 기존 중복 제거 필요할 수 있음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scourt_profile_cases_legal_case_id_key'
  ) THEN
    ALTER TABLE scourt_profile_cases
    ADD CONSTRAINT scourt_profile_cases_legal_case_id_key UNIQUE (legal_case_id);
  END IF;
END $$;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_user_wmonid_id ON scourt_profile_cases(user_wmonid_id);

-- 5. 코멘트
COMMENT ON COLUMN scourt_profile_cases.profile_id IS 'Puppeteer 프로필 ID (API 기반은 null)';
COMMENT ON COLUMN scourt_profile_cases.user_wmonid_id IS 'WMONID 레코드 참조 (API 기반 접근용)';
