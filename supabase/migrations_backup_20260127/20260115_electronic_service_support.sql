-- 전자송달 지원을 위한 스키마 확장
-- 민법 제157조 단서: 오전 영시로부터 시작하는 경우 초일산입
-- 전자소송에서 미열람 7일 후 0시에 송달 의제되면 기한이 1일 단축됨

-- 1. case_deadlines에 전자송달 여부 컬럼 추가
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS is_electronic_service BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN case_deadlines.is_electronic_service IS '전자송달(0시 의제) 여부. true인 경우 민법 제157조 단서에 따라 초일산입 적용';

-- 2. DB 트리거 함수 업데이트 (전자송달 시 1일 단축)
CREATE OR REPLACE FUNCTION calculate_deadline_dates()
RETURNS TRIGGER AS $$
DECLARE
  v_days INTEGER;
  v_deadline_date DATE;
  v_deadline_datetime TIMESTAMPTZ;
  v_effective_days INTEGER;
BEGIN
  -- deadline_type에 해당하는 기간(일수) 조회
  SELECT days INTO v_days
  FROM deadline_types
  WHERE type = NEW.deadline_type;

  -- deadline_type이 유효하지 않으면 에러
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Invalid deadline_type: %', NEW.deadline_type;
  END IF;

  -- 전자송달(0시 의제)인 경우 1일 단축 (민법 제157조 단서: 초일산입)
  -- 일반 송달: 기산일 + N일 (초일불산입이 이미 반영됨)
  -- 전자송달: 기산일 + (N-1)일 (초일산입)
  IF NEW.is_electronic_service = TRUE THEN
    v_effective_days := v_days - 1;
  ELSE
    v_effective_days := v_days;
  END IF;

  -- 법정 기간 계산 (민법 제161조 자동 적용)
  v_deadline_date := calculate_legal_deadline(
    NEW.trigger_date,
    v_effective_days,
    FALSE  -- exclude_initial_day는 이제 사용하지 않음
  );

  -- deadline_datetime 생성 (자정 00:00:00)
  v_deadline_datetime := (v_deadline_date || ' 00:00:00')::TIMESTAMPTZ;

  -- NEW 레코드에 계산된 값 설정
  NEW.deadline_date := v_deadline_date;
  NEW.deadline_datetime := v_deadline_datetime;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 인덱스 추가 (전자송달 필터링용)
CREATE INDEX IF NOT EXISTS idx_case_deadlines_electronic_service
ON case_deadlines(is_electronic_service)
WHERE is_electronic_service = TRUE;
