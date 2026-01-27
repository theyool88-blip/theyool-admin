-- ============================================================================
-- 상담 가능 시간 관리 시스템
-- 홈페이지 상담 예약 시 표시될 시간대를 어드민에서 관리
-- ============================================================================

-- 주간 기본 상담 시간 설정 (매주 반복되는 일정)
CREATE TABLE IF NOT EXISTS consultation_weekly_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=일요일, 1=월요일, ..., 6=토요일
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 30, -- 예약 단위 (기본 30분)
  is_available BOOLEAN DEFAULT true,
  office_location TEXT, -- '천안', '평택', NULL이면 모든 사무소
  lawyer_name TEXT, -- '육심원', '임은지', NULL이면 모든 변호사
  consultation_type TEXT, -- 'visit', 'video', NULL이면 모든 타입
  max_bookings_per_slot INTEGER DEFAULT 1, -- 동일 시간대 최대 예약 수
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 시작 시간이 종료 시간보다 빠른지 체크
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- 특정 날짜 예외 설정 (휴무일, 특별 운영 시간)
CREATE TABLE IF NOT EXISTS consultation_date_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exception_date DATE NOT NULL,
  start_time TIME, -- NULL이면 종일
  end_time TIME,
  is_blocked BOOLEAN DEFAULT true, -- true=차단(휴무), false=특별 추가
  reason TEXT, -- 예: '설날 연휴', '임시 휴무', '특별 상담 가능'
  office_location TEXT,
  lawyer_name TEXT,
  consultation_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 시간이 지정된 경우 유효성 체크
  CONSTRAINT valid_exception_time_range CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

-- 인덱스 생성
CREATE INDEX idx_weekly_schedule_day ON consultation_weekly_schedule(day_of_week, is_available);
CREATE INDEX idx_date_exceptions_date ON consultation_date_exceptions(exception_date, is_blocked);
CREATE INDEX idx_weekly_schedule_lawyer ON consultation_weekly_schedule(lawyer_name) WHERE lawyer_name IS NOT NULL;
CREATE INDEX idx_date_exceptions_lawyer ON consultation_date_exceptions(lawyer_name) WHERE lawyer_name IS NOT NULL;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_consultation_weekly_schedule_updated_at
  BEFORE UPDATE ON consultation_weekly_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_date_exceptions_updated_at
  BEFORE UPDATE ON consultation_date_exceptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 기본 데이터 삽입 (평일 09:00-18:00, 점심시간 12:00-13:00 제외)
-- ============================================================================

-- 월요일 ~ 금요일: 오전 (09:00 - 12:00)
INSERT INTO consultation_weekly_schedule (day_of_week, start_time, end_time, is_available, notes)
VALUES
  (1, '09:00', '12:00', true, '월요일 오전'),
  (2, '09:00', '12:00', true, '화요일 오전'),
  (3, '09:00', '12:00', true, '수요일 오전'),
  (4, '09:00', '12:00', true, '목요일 오전'),
  (5, '09:00', '12:00', true, '금요일 오전');

-- 월요일 ~ 금요일: 오후 (13:00 - 18:00)
INSERT INTO consultation_weekly_schedule (day_of_week, start_time, end_time, is_available, notes)
VALUES
  (1, '13:00', '18:00', true, '월요일 오후'),
  (2, '13:00', '18:00', true, '화요일 오후'),
  (3, '13:00', '18:00', true, '수요일 오후'),
  (4, '13:00', '18:00', true, '목요일 오후'),
  (5, '13:00', '18:00', true, '금요일 오후');

-- 주말은 기본적으로 휴무 (데이터 없음)

-- RLS (Row Level Security) 정책
ALTER TABLE consultation_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_date_exceptions ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 권한
CREATE POLICY "Admin full access to weekly schedule"
  ON consultation_weekly_schedule FOR ALL
  USING (true);

CREATE POLICY "Admin full access to date exceptions"
  ON consultation_date_exceptions FOR ALL
  USING (true);

-- 공개 읽기 권한 (홈페이지에서 조회)
CREATE POLICY "Public read access to weekly schedule"
  ON consultation_weekly_schedule FOR SELECT
  USING (is_available = true);

CREATE POLICY "Public read access to date exceptions"
  ON consultation_date_exceptions FOR SELECT
  USING (true);

COMMENT ON TABLE consultation_weekly_schedule IS '주간 반복 상담 가능 시간 설정';
COMMENT ON TABLE consultation_date_exceptions IS '특정 날짜 예외 설정 (휴무일, 특별 운영)';
