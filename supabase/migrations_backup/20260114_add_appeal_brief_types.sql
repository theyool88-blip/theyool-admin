-- ================================================================
-- 항소이유서/상고이유서 제출기한 유형 추가
-- 민사소송법 및 형사소송법 기반
--
-- 참조:
-- - 민소법 §402의2: 민사 항소이유서 40일 (2025.3.1 시행)
-- - 민소법 §427: 민사 상고이유서 20일
-- - 형소법 §361의3: 형사 항소이유서 20일
-- - 형소법 §379: 형사 상고이유서 20일
-- ================================================================

-- 1. 형사 항소이유서/상고이유서 제출기한 추가
INSERT INTO deadline_types (type, label, days, is_immutable, description, is_extendable, max_extensions, extension_days) VALUES
  -- 형사 항소이유서: 20일, 연장 불가
  ('DL_CRIMINAL_APPEAL_BRIEF', '형사 항소이유서 제출기한', 20, TRUE,
   '형사 항소기록접수 통지일로부터 20일 이내 제출 (형소법 §361의3)', FALSE, 0, 0),

  -- 형사 상고이유서: 20일, 연장 불가
  ('DL_CRIMINAL_FINAL_BRIEF', '형사 상고이유서 제출기한', 20, TRUE,
   '형사 상고기록접수 통지일로부터 20일 이내 제출 (형소법 §379)', FALSE, 0, 0)

ON CONFLICT (type) DO UPDATE SET
  label = EXCLUDED.label,
  days = EXCLUDED.days,
  is_immutable = EXCLUDED.is_immutable,
  description = EXCLUDED.description,
  is_extendable = EXCLUDED.is_extendable,
  max_extensions = EXCLUDED.max_extensions,
  extension_days = EXCLUDED.extension_days;

-- 2. 기존 민사 항소이유서/상고이유서 정보 업데이트
UPDATE deadline_types SET
  label = '민사 항소이유서 제출기한',
  description = '민사 항소기록접수 통지일로부터 40일 이내 제출 (민소법 §402의2, 2025.3.1 시행)',
  is_extendable = TRUE,
  max_extensions = 1,
  extension_days = 30
WHERE type = 'DL_APPEAL_BRIEF';

UPDATE deadline_types SET
  label = '민사 상고이유서 제출기한',
  description = '민사 상고기록접수 통지일로부터 20일 이내 제출 (민소법 §427)',
  is_extendable = FALSE,  -- 통상기간이지만 실무상 연장 어려움
  max_extensions = 0,
  extension_days = 0
WHERE type = 'DL_FINAL_APPEAL_BRIEF';

-- 3. 완료 메시지
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM deadline_types
  WHERE type IN ('DL_APPEAL_BRIEF', 'DL_CRIMINAL_APPEAL_BRIEF',
                 'DL_FINAL_APPEAL_BRIEF', 'DL_CRIMINAL_FINAL_BRIEF');

  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '항소이유서/상고이유서 제출기한 유형 추가 완료';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '추가된 기한 유형: % 개', v_count;
  RAISE NOTICE '';
  RAISE NOTICE '┌────────────────────────────┬──────┬────────┬────────┐';
  RAISE NOTICE '│ 유형                        │ 기간 │ 연장   │ 법적근거│';
  RAISE NOTICE '├────────────────────────────┼──────┼────────┼────────┤';
  RAISE NOTICE '│ 민사 항소이유서             │ 40일 │ 1회30일│ 민소§402의2 │';
  RAISE NOTICE '│ 민사 상고이유서             │ 20일 │ 불가   │ 민소§427    │';
  RAISE NOTICE '│ 형사 항소이유서             │ 20일 │ 불가   │ 형소§361의3 │';
  RAISE NOTICE '│ 형사 상고이유서             │ 20일 │ 불가   │ 형소§379    │';
  RAISE NOTICE '└────────────────────────────┴──────┴────────┴────────┘';
  RAISE NOTICE '';
  RAISE NOTICE '※ 기산일: 기록접수 통지일 (SCOURT 자동등록 시 수동 입력 필요)';
END $$;
