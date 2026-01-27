-- ================================================================
-- 전체 불변기간 유형 추가
-- 민사소송법 및 가사소송법 불변기간 완전판
-- ================================================================

-- 1. 기존 deadline_types에 추가 불변기간 삽입
INSERT INTO deadline_types (type, label, days, is_immutable, description) VALUES
  -- 기존 5개는 이미 존재
  -- ('DL_APPEAL', '상소기간', 14, TRUE, '선고일로부터 14일 이내 항소/상고 제기'),
  -- ('DL_MEDIATION_OBJ', '조정·화해 이의기간', 14, TRUE, '조정·화해 성립일로부터 14일 이내 이의신청'),
  -- ('DL_IMMEDIATE_APPEAL', '즉시항고기간', 7, TRUE, '재판고지일로부터 1주일 이내 즉시항고'),
  -- ('DL_APPELLATE_BRIEF', '항소이유서 제출기한', 40, TRUE, '항소기록접수 통지일로부터 40일 이내 제출'),
  -- ('DL_RETRIAL', '재심의 소 제기기한', 30, TRUE, '판결확정일 또는 사유를 안 날로부터 30일 이내'),

  -- 추가 불변기간 (2025. 3. 1. 개정 민사소송법 시행)
  ('DL_FINAL_APPEAL_BRIEF', '상고이유서 제출기한', 20, TRUE, '상고기록접수 통지일로부터 20일 이내 제출'),
  ('DL_PAYMENT_ORDER_OBJ', '지급명령 이의신청', 14, TRUE, '지급명령 송달일로부터 2주일 이내 이의신청'),
  ('DL_RECONCILIATION_OBJ', '화해권고결정 이의신청', 14, TRUE, '화해권고결정 정본 송달일로부터 2주일 이내 이의신청'),
  ('DL_APPEAL_DISMISSAL_IMMED', '항소각하결정 즉시항고', 7, TRUE, '항소각하결정 고지일로부터 1주일 이내 즉시항고'),

  -- 가사소송 특화 불변기간
  ('DL_FAMILY_APPEAL', '가사소송 항소기간', 14, TRUE, '가사소송 판결 선고일로부터 14일 이내 항소'),
  ('DL_FAMILY_RETRIAL', '가사소송 재심', 30, TRUE, '가사소송 판결확정일 또는 사유를 안 날로부터 30일 이내'),

  -- 기타 실무 중요 기한
  ('DL_EXECUTION_OBJECTION', '집행이의', 14, TRUE, '집행개시 또는 종료일로부터 2주일 이내 이의신청'),
  ('DL_PROVISIONAL_APPEAL', '가처분 이의', 14, TRUE, '가처분결정 송달일로부터 2주일 이내 이의신청')

ON CONFLICT (type) DO UPDATE SET
  label = EXCLUDED.label,
  days = EXCLUDED.days,
  is_immutable = EXCLUDED.is_immutable,
  description = EXCLUDED.description;

-- 2. 기존 AUTO_DEADLINE_MAPPING에 추가할 매핑 (애플리케이션 레벨)
-- lib/supabase/court-hearings.ts에 다음 매핑 추가 필요:
-- 'HEARING_JUDGMENT' → 'DL_APPEAL' (이미 존재)
-- 'HEARING_MEDIATION' → 'DL_MEDIATION_OBJ' (이미 존재)
-- 'HEARING_RECONCILIATION' → 'DL_RECONCILIATION_OBJ' (화해권고)
-- 'HEARING_PAYMENT_ORDER' → 'DL_PAYMENT_ORDER_OBJ' (지급명령)

-- 3. hearing_type에 추가 기일 유형이 필요한 경우 (현재는 없음)
-- 필요시 types/court-hearing.ts에 추가

-- 4. 연장 가능 기간 관리용 컬럼 추가
ALTER TABLE deadline_types
ADD COLUMN IF NOT EXISTS is_extendable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_extensions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extension_days INTEGER DEFAULT 0;

COMMENT ON COLUMN deadline_types.is_extendable IS '기간 연장 가능 여부';
COMMENT ON COLUMN deadline_types.max_extensions IS '최대 연장 횟수';
COMMENT ON COLUMN deadline_types.extension_days IS '1회 연장 시 추가 일수';

-- 5. 항소이유서는 1개월 연장 가능 (딱 1번)
UPDATE deadline_types
SET
  is_extendable = TRUE,
  max_extensions = 1,
  extension_days = 30
WHERE type = 'DL_APPELLATE_BRIEF';

-- 6. 연장 이력 추가용 테이블 (선택사항, 향후 필요시 활성화)
CREATE TABLE IF NOT EXISTS deadline_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id UUID NOT NULL REFERENCES case_deadlines(id) ON DELETE CASCADE,
  extension_number INTEGER NOT NULL, -- 몇 번째 연장인지 (1, 2, ...)
  original_deadline DATE NOT NULL,
  extended_deadline DATE NOT NULL,
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(deadline_id, extension_number)
);

COMMENT ON TABLE deadline_extensions IS '데드라인 연장 이력 관리';

-- RLS 정책
ALTER TABLE deadline_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to extensions" ON deadline_extensions;
CREATE POLICY "Service role has full access to extensions"
  ON deadline_extensions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view extensions" ON deadline_extensions;
CREATE POLICY "Authenticated users can view extensions"
  ON deadline_extensions
  FOR SELECT
  TO authenticated
  USING (true);

-- 완료 메시지
DO $$
DECLARE
  v_total_types INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_types FROM deadline_types;

  RAISE NOTICE '✅ 전체 불변기간 유형 추가 완료';
  RAISE NOTICE '   - 총 불변기간 유형: % 개', v_total_types;
  RAISE NOTICE '   - 항소이유서 제출기한: 1개월 연장 가능 (최대 1회)';
  RAISE NOTICE '   - 데드라인 연장 이력 테이블 생성 완료';
  RAISE NOTICE '';
  RAISE NOTICE '📝 애플리케이션 코드 업데이트 필요:';
  RAISE NOTICE '   - lib/supabase/court-hearings.ts의 AUTO_DEADLINE_MAPPING 업데이트';
  RAISE NOTICE '   - types/court-hearing.ts에 필요시 HearingType 추가';
  RAISE NOTICE '   - components/QuickAddHearingModal.tsx의 안내 메시지 확장';
END $$;
