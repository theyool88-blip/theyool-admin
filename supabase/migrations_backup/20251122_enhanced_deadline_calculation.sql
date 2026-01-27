-- ================================================================
-- 향상된 법정 기간 계산 시스템
-- 민법 제161조: 기간의 말일이 토요일 또는 공휴일에 해당한 때에는 기간은 그 익일로 만료한다.
-- ================================================================

-- 1. 한국 공휴일 테이블 생성
CREATE TABLE IF NOT EXISTS korean_public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)::INTEGER) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE korean_public_holidays IS '대한민국 법정 공휴일 (관공서의 공휴일에 관한 규정)';

-- 2. 2025년 공휴일 데이터 삽입
INSERT INTO korean_public_holidays (holiday_date, holiday_name) VALUES
  ('2025-01-01', '신정'),
  ('2025-01-28', '설날 연휴'),
  ('2025-01-29', '설날'),
  ('2025-01-30', '설날 연휴'),
  ('2025-03-01', '삼일절'),
  ('2025-03-03', '삼일절 대체공휴일'),
  ('2025-05-05', '어린이날'),
  ('2025-05-06', '어린이날 대체공휴일'),
  ('2025-06-06', '현충일'),
  ('2025-08-15', '광복절'),
  ('2025-10-03', '개천절'),
  ('2025-10-05', '추석 연휴'),
  ('2025-10-06', '추석'),
  ('2025-10-07', '추석 연휴'),
  ('2025-10-08', '추석 대체공휴일'),
  ('2025-10-09', '한글날'),
  ('2025-12-25', '성탄절')
ON CONFLICT (holiday_date) DO NOTHING;

-- 3. 공휴일 확인 함수 (일요일 포함)
CREATE OR REPLACE FUNCTION is_public_holiday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- 일요일은 항상 공휴일 (관공서의 공휴일에 관한 규정 제2조)
  IF is_sunday(check_date) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM korean_public_holidays
    WHERE holiday_date = check_date
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_public_holiday IS '해당 날짜가 법정 공휴일인지 확인 (일요일 포함)';

-- 4. 토요일 확인 함수
CREATE OR REPLACE FUNCTION is_saturday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXTRACT(DOW FROM check_date) = 6;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_saturday IS '해당 날짜가 토요일인지 확인 (0=일요일, 6=토요일)';

-- 5. 일요일 확인 함수
CREATE OR REPLACE FUNCTION is_sunday(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXTRACT(DOW FROM check_date) = 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_sunday IS '해당 날짜가 일요일인지 확인';

-- 6. 비영업일 확인 함수 (토요일 또는 공휴일)
CREATE OR REPLACE FUNCTION is_non_business_day(check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
  -- 민법 제161조: 토요일 또는 공휴일 (일요일 포함)
  RETURN is_saturday(check_date) OR is_public_holiday(check_date);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_non_business_day IS '민법 제161조 적용 대상일 확인 (토요일 또는 공휴일)';

-- 7. 다음 영업일 찾기 함수
CREATE OR REPLACE FUNCTION get_next_business_day(from_date DATE)
RETURNS DATE AS $$
DECLARE
  v_next_day DATE;
  v_max_iterations INTEGER := 10; -- 무한루프 방지 (최대 10일)
  v_counter INTEGER := 0;
BEGIN
  v_next_day := from_date;

  LOOP
    -- 무한루프 방지
    v_counter := v_counter + 1;
    IF v_counter > v_max_iterations THEN
      EXIT;
    END IF;

    -- 영업일이면 반환
    IF NOT is_non_business_day(v_next_day) THEN
      RETURN v_next_day;
    END IF;

    -- 다음 날로 이동
    v_next_day := v_next_day + INTERVAL '1 day';
  END LOOP;

  -- 최악의 경우 원래 날짜 반환 (에러 방지)
  RETURN from_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_next_business_day IS '다음 영업일 찾기 (토요일/공휴일 건너뛰기)';

-- 8. 법정 기간 계산 함수 (민법 제161조 적용)
CREATE OR REPLACE FUNCTION calculate_legal_deadline(
  trigger_date DATE,
  days INTEGER,
  exclude_initial_day BOOLEAN DEFAULT FALSE
)
RETURNS DATE AS $$
DECLARE
  v_start_date DATE;
  v_deadline DATE;
BEGIN
  -- 1. 기산일 설정
  v_start_date := trigger_date;

  -- 2. 초일불산입 처리 (필요시)
  IF exclude_initial_day THEN
    v_start_date := v_start_date + INTERVAL '1 day';
  END IF;

  -- 3. 기간 계산 (단순 일수 더하기)
  v_deadline := v_start_date + (days || ' days')::INTERVAL;

  -- 4. 민법 제161조 적용: 말일이 토요일 또는 공휴일이면 익일로 연장
  v_deadline := get_next_business_day(v_deadline);

  RETURN v_deadline;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_legal_deadline IS '법정 기간 계산 (민법 제161조 자동 적용)';

-- 9. 기존 트리거 함수 대체 (향상된 버전)
CREATE OR REPLACE FUNCTION calculate_deadline_dates()
RETURNS TRIGGER AS $$
DECLARE
  v_days INTEGER;
  v_deadline_date DATE;
  v_deadline_datetime TIMESTAMPTZ;
  v_exclude_initial_day BOOLEAN := FALSE;
BEGIN
  -- deadline_type에 해당하는 기간(일수) 조회
  SELECT days INTO v_days
  FROM deadline_types
  WHERE type = NEW.deadline_type;

  -- deadline_type이 유효하지 않으면 에러
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Invalid deadline_type: %', NEW.deadline_type;
  END IF;

  -- 법정 기간 계산 (민법 제161조 자동 적용)
  v_deadline_date := calculate_legal_deadline(
    NEW.trigger_date,
    v_days,
    v_exclude_initial_day
  );

  -- deadline_datetime 생성 (자정 00:00:00)
  v_deadline_datetime := (v_deadline_date || ' 00:00:00')::TIMESTAMPTZ;

  -- NEW 레코드에 계산된 값 설정
  NEW.deadline_date := v_deadline_date;
  NEW.deadline_datetime := v_deadline_datetime;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_deadline_dates IS '데드라인 자동 계산 트리거 (민법 제161조 적용)';

-- 10. 기존 데이터 재계산 (trigger_date가 있는 경우만)
UPDATE case_deadlines
SET trigger_date = trigger_date -- 트리거 발동을 위한 더미 업데이트
WHERE trigger_date IS NOT NULL;

-- 11. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_holidays_date ON korean_public_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON korean_public_holidays(year);

-- 12. RLS 정책 (Service Role은 모든 권한, Authenticated는 읽기만)
ALTER TABLE korean_public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to holidays" ON korean_public_holidays;
CREATE POLICY "Service role has full access to holidays"
  ON korean_public_holidays
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view holidays" ON korean_public_holidays;
CREATE POLICY "Authenticated users can view holidays"
  ON korean_public_holidays
  FOR SELECT
  TO authenticated
  USING (true);

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 향상된 법정 기간 계산 시스템 설치 완료';
  RAISE NOTICE '   - 민법 제161조 자동 적용 (토요일/공휴일 연장)';
  RAISE NOTICE '   - 2025년 대한민국 공휴일 17개 등록';
  RAISE NOTICE '   - 기존 데드라인 데이터 재계산 완료';
END $$;
