-- 상담 예약 가능 시간 관리 시스템
--
-- 목적:
-- 1. 주간 반복 일정 관리 (월~금 09:00-18:00 등)
-- 2. 특정 날짜 예외 처리 (휴무일, 특별 운영 시간)
-- 3. 변호사별, 사무소별 예약 가능 시간 설정

-- ============================================================================
-- 1. consultation_weekly_schedule 테이블
--    주간 반복 일정 (매주 반복되는 상담 가능 시간)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultation_weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- 시간 범위
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- 예약 설정
  slot_duration_minutes INT DEFAULT 30,  -- 슬롯 길이 (분)
  max_bookings_per_slot INT DEFAULT 1,   -- 슬롯당 최대 예약 수

  -- 필터 (NULL이면 모든 변호사/사무소에 적용)
  lawyer_name TEXT,                      -- 특정 변호사만
  office_location TEXT,                  -- 특정 사무소만

  -- 활성화 여부
  is_available BOOLEAN DEFAULT true,

  -- 설명
  description TEXT,

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_slot_duration CHECK (slot_duration_minutes > 0),
  CONSTRAINT valid_max_bookings CHECK (max_bookings_per_slot > 0)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_day ON consultation_weekly_schedule(day_of_week, is_available);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_lawyer ON consultation_weekly_schedule(lawyer_name);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_office ON consultation_weekly_schedule(office_location);

-- ============================================================================
-- 2. consultation_date_exceptions 테이블
--    특정 날짜 예외 처리 (휴무일, 임시 운영 시간 변경)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultation_date_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 예외 날짜
  exception_date DATE NOT NULL,

  -- 예외 타입
  is_blocked BOOLEAN DEFAULT false,      -- true: 휴무, false: 특별 운영

  -- 시간 범위 (NULL이면 종일)
  start_time TIME,
  end_time TIME,

  -- 필터
  lawyer_name TEXT,
  office_location TEXT,

  -- 사유
  reason TEXT,

  CONSTRAINT valid_exception_time_range CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_date_exceptions_date ON consultation_date_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_lawyer ON consultation_date_exceptions(lawyer_name);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_office ON consultation_date_exceptions(office_location);

-- ============================================================================
-- 3. 기본 데이터 삽입
-- ============================================================================

-- 평일 기본 운영 시간 (월~금 09:00-18:00, 점심시간 12:00-13:00 제외)
INSERT INTO consultation_weekly_schedule
  (day_of_week, start_time, end_time, slot_duration_minutes, max_bookings_per_slot, description)
VALUES
  -- 월요일 오전
  (1, '09:00', '12:00', 30, 1, '월요일 오전'),
  -- 월요일 오후
  (1, '13:00', '18:00', 30, 1, '월요일 오후'),

  -- 화요일 오전
  (2, '09:00', '12:00', 30, 1, '화요일 오전'),
  -- 화요일 오후
  (2, '13:00', '18:00', 30, 1, '화요일 오후'),

  -- 수요일 오전
  (3, '09:00', '12:00', 30, 1, '수요일 오전'),
  -- 수요일 오후
  (3, '13:00', '18:00', 30, 1, '수요일 오후'),

  -- 목요일 오전
  (4, '09:00', '12:00', 30, 1, '목요일 오전'),
  -- 목요일 오후
  (4, '13:00', '18:00', 30, 1, '목요일 오후'),

  -- 금요일 오전
  (5, '09:00', '12:00', 30, 1, '금요일 오전'),
  -- 금요일 오후
  (5, '13:00', '18:00', 30, 1, '금요일 오후')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. RLS (Row Level Security) 정책
-- ============================================================================

-- consultation_weekly_schedule
ALTER TABLE consultation_weekly_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_weekly_schedule_select_all" ON consultation_weekly_schedule
  FOR SELECT
  USING (true);

CREATE POLICY "consultation_weekly_schedule_admin_all" ON consultation_weekly_schedule
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- consultation_date_exceptions
ALTER TABLE consultation_date_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_date_exceptions_select_all" ON consultation_date_exceptions
  FOR SELECT
  USING (true);

CREATE POLICY "consultation_date_exceptions_admin_all" ON consultation_date_exceptions
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 5. 업데이트 timestamp 자동 갱신
-- ============================================================================

CREATE OR REPLACE FUNCTION update_weekly_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_weekly_schedule_updated_at ON consultation_weekly_schedule;
CREATE TRIGGER trigger_weekly_schedule_updated_at
  BEFORE UPDATE ON consultation_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_schedule_updated_at();

CREATE OR REPLACE FUNCTION update_date_exceptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_date_exceptions_updated_at ON consultation_date_exceptions;
CREATE TRIGGER trigger_date_exceptions_updated_at
  BEFORE UPDATE ON consultation_date_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_date_exceptions_updated_at();

-- ============================================================================
-- 6. 코멘트
-- ============================================================================

COMMENT ON TABLE consultation_weekly_schedule IS '상담 예약 주간 반복 일정';
COMMENT ON COLUMN consultation_weekly_schedule.day_of_week IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';
COMMENT ON COLUMN consultation_weekly_schedule.slot_duration_minutes IS '슬롯 길이 (분), 기본 30분';
COMMENT ON COLUMN consultation_weekly_schedule.max_bookings_per_slot IS '슬롯당 최대 예약 수';

COMMENT ON TABLE consultation_date_exceptions IS '상담 예약 특정 날짜 예외 처리';
COMMENT ON COLUMN consultation_date_exceptions.is_blocked IS 'true: 휴무, false: 특별 운영';

-- ============================================================================
-- 7. 검증 쿼리 (주석 처리, 필요 시 실행)
-- ============================================================================

/*
-- 주간 일정 확인
SELECT
  day_of_week,
  CASE day_of_week
    WHEN 0 THEN '일요일'
    WHEN 1 THEN '월요일'
    WHEN 2 THEN '화요일'
    WHEN 3 THEN '수요일'
    WHEN 4 THEN '목요일'
    WHEN 5 THEN '금요일'
    WHEN 6 THEN '토요일'
  END as day_name,
  start_time,
  end_time,
  slot_duration_minutes,
  max_bookings_per_slot,
  is_available,
  description
FROM consultation_weekly_schedule
ORDER BY day_of_week, start_time;

-- 예외 날짜 확인
SELECT
  exception_date,
  is_blocked,
  start_time,
  end_time,
  reason,
  lawyer_name,
  office_location
FROM consultation_date_exceptions
ORDER BY exception_date;

-- 특정 날짜의 예약 가능 시간 확인 (예시: 2025-11-25는 월요일)
SELECT * FROM consultation_weekly_schedule
WHERE day_of_week = 1  -- 월요일
  AND is_available = true
ORDER BY start_time;
*/
