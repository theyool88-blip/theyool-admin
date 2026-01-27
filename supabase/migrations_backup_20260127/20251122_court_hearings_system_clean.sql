-- 법무법인 더율 - 법원 기일 관리 시스템
-- 작성일: 2025-11-22
-- 설명: 이혼사건 기일, 불변기간, 데드라인 관리

-- 1. ENUM 타입 정의

CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',           -- 변론기일
  'HEARING_INTERIM',        -- 사전·보전처분 심문기일
  'HEARING_MEDIATION',      -- 조정기일
  'HEARING_INVESTIGATION',  -- 조사기일
  'HEARING_PARENTING',      -- 상담·교육·프로그램 기일
  'HEARING_JUDGMENT'        -- 선고기일
);

CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',              -- 상소기간 (14일)
  'DL_MEDIATION_OBJ',       -- 조정·화해 이의기간 (14일)
  'DL_IMM_APPEAL',          -- 즉시항고기간 (7일)
  'DL_APPEAL_BRIEF',        -- 항소이유서 제출 (40일)
  'DL_RETRIAL'              -- 재심의 소 제기 (30일)
);

CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',    -- 예정
  'COMPLETED',    -- 완료
  'POSTPONED',    -- 연기
  'CANCELLED'     -- 취소
);

CREATE TYPE deadline_status AS ENUM (
  'PENDING',      -- 대기 중
  'COMPLETED',    -- 완료
  'OVERDUE'       -- 기한 초과
);

-- 2. 데드라인 타입 마스터 테이블 (불변기간 정의)

CREATE TABLE deadline_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type deadline_type UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  days_count INTEGER NOT NULL,
  trigger_event VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO deadline_types (type, name, description, days_count, trigger_event) VALUES
  ('DL_APPEAL', '상소기간', '항소 또는 상고 제기 가능 기간', 14, '판결 정본 송달일'),
  ('DL_MEDIATION_OBJ', '조정·화해 이의기간', '조정·화해에 대한 이의 제기 기간', 14, '조정조서 정본 송달일'),
  ('DL_IMM_APPEAL', '즉시항고기간', '즉시항고 제기 가능 기간', 7, '결정문 정본 송달일'),
  ('DL_APPEAL_BRIEF', '항소이유서 제출기한', '항소이유서 제출 마감일', 40, '제1심 판결문 송달일'),
  ('DL_RETRIAL', '재심의 소 제기기한', '재심 청구 가능 기간', 30, '판결 확정일');

-- 3. 법원 기일 테이블

CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  hearing_type hearing_type NOT NULL,
  hearing_detail VARCHAR(200),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  court_name VARCHAR(200),
  courtroom VARCHAR(100),
  lawyer_attendance_required BOOLEAN DEFAULT true,
  client_attendance_required BOOLEAN DEFAULT false,
  status hearing_status DEFAULT 'SCHEDULED',
  notes TEXT,
  result TEXT,
  notice_received_date DATE,
  notice_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date CHECK (scheduled_date >= CURRENT_DATE - INTERVAL '10 years')
);

CREATE INDEX idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX idx_court_hearings_date ON court_hearings(scheduled_date);
CREATE INDEX idx_court_hearings_status ON court_hearings(status);
CREATE INDEX idx_court_hearings_type ON court_hearings(hearing_type);

-- 4. 사건 데드라인 테이블

CREATE TABLE case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  deadline_type deadline_type NOT NULL,
  related_hearing_id UUID REFERENCES court_hearings(id) ON DELETE SET NULL,
  trigger_date DATE NOT NULL,
  deadline_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  status deadline_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_deadline CHECK (deadline_date >= trigger_date)
);

CREATE INDEX idx_case_deadlines_case_id ON case_deadlines(case_id);
CREATE INDEX idx_case_deadlines_deadline_date ON case_deadlines(deadline_date);
CREATE INDEX idx_case_deadlines_status ON case_deadlines(status);
CREATE INDEX idx_case_deadlines_type ON case_deadlines(deadline_type);

-- 5. 데드라인 자동 계산 함수

CREATE OR REPLACE FUNCTION calculate_deadline_date(
  p_trigger_date DATE,
  p_deadline_type deadline_type
)
RETURNS DATE AS $$
DECLARE
  v_days_count INTEGER;
  v_deadline_date DATE;
BEGIN
  SELECT days_count INTO v_days_count
  FROM deadline_types
  WHERE type = p_deadline_type;

  IF v_days_count IS NULL THEN
    RAISE EXCEPTION 'Invalid deadline type: %', p_deadline_type;
  END IF;

  v_deadline_date := p_trigger_date + (v_days_count || ' days')::INTERVAL;

  RETURN v_deadline_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. 자동 업데이트 트리거

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_court_hearings_updated_at
  BEFORE UPDATE ON court_hearings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_deadlines_updated_at
  BEFORE UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deadline_types_updated_at
  BEFORE UPDATE ON deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. 데드라인 INSERT 시 자동 계산 트리거

CREATE OR REPLACE FUNCTION auto_calculate_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deadline_date IS NULL THEN
    NEW.deadline_date := calculate_deadline_date(NEW.trigger_date, NEW.deadline_type);
  END IF;

  IF NEW.days_count IS NULL THEN
    SELECT days_count INTO NEW.days_count
    FROM deadline_types
    WHERE type = NEW.deadline_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_deadline_trigger
  BEFORE INSERT ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_deadline();

-- 8. 데드라인 상태 자동 업데이트 함수

CREATE OR REPLACE FUNCTION update_overdue_deadlines()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE case_deadlines
  SET status = 'OVERDUE'
  WHERE status = 'PENDING'
    AND deadline_date < CURRENT_DATE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- 9. 유용한 뷰 생성

CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT
  ch.*,
  lc.case_name,
  lc.contract_number as case_number
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
WHERE ch.status = 'SCHEDULED'
  AND ch.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY ch.scheduled_date, ch.scheduled_time;

CREATE OR REPLACE VIEW urgent_deadlines AS
SELECT
  cd.*,
  dt.name as deadline_name,
  lc.case_name,
  lc.contract_number as case_number
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
JOIN legal_cases lc ON cd.case_id = lc.id
WHERE cd.status = 'PENDING'
  AND cd.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY cd.deadline_date;
