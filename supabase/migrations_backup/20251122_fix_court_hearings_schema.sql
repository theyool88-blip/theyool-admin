-- 법무법인 더율 - 법원 기일 관리 시스템 (수정본)
-- 작성일: 2025-11-22
-- 설명: TypeScript 타입에 맞춰 스키마 수정

-- 1. 기존 테이블 삭제 (의존성 순서대로)
DROP VIEW IF EXISTS upcoming_hearings CASCADE;
DROP VIEW IF EXISTS urgent_deadlines CASCADE;
DROP TABLE IF EXISTS case_deadlines CASCADE;
DROP TABLE IF EXISTS court_hearings CASCADE;
DROP TABLE IF EXISTS deadline_types CASCADE;

-- 2. ENUM 타입 삭제 및 재생성
DROP TYPE IF EXISTS hearing_type CASCADE;
DROP TYPE IF EXISTS deadline_type CASCADE;
DROP TYPE IF EXISTS hearing_status CASCADE;
DROP TYPE IF EXISTS deadline_status CASCADE;

CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',
  'HEARING_INTERIM',
  'HEARING_MEDIATION',
  'HEARING_INVESTIGATION',
  'HEARING_PARENTING',
  'HEARING_JUDGMENT',
  'HEARING_LAWYER_MEETING'
);

CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',
  'DL_MEDIATION_OBJ',
  'DL_IMM_APPEAL',
  'DL_APPEAL_BRIEF',
  'DL_RETRIAL'
);

CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',
  'COMPLETED',
  'POSTPONED',
  'CANCELLED'
);

CREATE TYPE deadline_status AS ENUM (
  'PENDING',
  'COMPLETED',
  'OVERDUE'
);

-- 3. deadline_types 마스터 테이블
CREATE TABLE deadline_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type deadline_type UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO deadline_types (type, name, days, description) VALUES
  ('DL_APPEAL', '상소기간', 14, '판결선고일로부터 14일'),
  ('DL_MEDIATION_OBJ', '조정·화해 이의기간', 14, '조정조서 송달일로부터 14일'),
  ('DL_IMM_APPEAL', '즉시항고기간', 7, '결정문 송달일로부터 7일'),
  ('DL_APPEAL_BRIEF', '항소이유서 제출기한', 40, '제1심 판결문 송달일로부터 40일'),
  ('DL_RETRIAL', '재심의 소 제기기한', 30, '판결 확정일로부터 30일');

-- 4. court_hearings 테이블 (TypeScript 타입에 맞춤)
CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(100) NOT NULL,  -- 사건번호 (문자열)
  hearing_type hearing_type NOT NULL,
  hearing_date TIMESTAMPTZ NOT NULL,  -- ISO 8601 datetime
  location VARCHAR(200),              -- 법정 (예: "서울가정법원 301호")
  judge_name VARCHAR(100),            -- 담당 판사
  notes TEXT,
  status hearing_status DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_court_hearings_case_number ON court_hearings(case_number);
CREATE INDEX idx_court_hearings_date ON court_hearings(hearing_date);
CREATE INDEX idx_court_hearings_status ON court_hearings(status);

-- 5. case_deadlines 테이블 (TypeScript 타입에 맞춤)
CREATE TABLE case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(100) NOT NULL,  -- 사건번호 (문자열)
  deadline_type deadline_type NOT NULL,
  trigger_date DATE NOT NULL,         -- 기산일
  deadline_date DATE NOT NULL,        -- 만료일 (자동 계산)
  deadline_datetime TIMESTAMPTZ NOT NULL, -- 만료 일시 (자동 계산)
  notes TEXT,
  status deadline_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_deadlines_case_number ON case_deadlines(case_number);
CREATE INDEX idx_case_deadlines_deadline_date ON case_deadlines(deadline_date);
CREATE INDEX idx_case_deadlines_status ON case_deadlines(status);

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

-- 7. 데드라인 자동 계산 트리거
CREATE OR REPLACE FUNCTION calculate_deadline_dates()
RETURNS TRIGGER AS $$
DECLARE
  v_days INTEGER;
  v_deadline_date DATE;
  v_deadline_datetime TIMESTAMPTZ;
BEGIN
  -- deadline_types에서 일수 조회
  SELECT days INTO v_days
  FROM deadline_types
  WHERE type = NEW.deadline_type;

  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Invalid deadline type: %', NEW.deadline_type;
  END IF;

  -- 만료일 계산 (기산일 + 일수)
  v_deadline_date := NEW.trigger_date + (v_days || ' days')::INTERVAL;

  -- 만료 일시 계산 (만료일 자정)
  v_deadline_datetime := (v_deadline_date || ' 00:00:00')::TIMESTAMPTZ;

  -- 자동으로 계산된 값 설정
  NEW.deadline_date := v_deadline_date;
  NEW.deadline_datetime := v_deadline_datetime;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_deadline_dates_trigger
  BEFORE INSERT OR UPDATE OF trigger_date, deadline_type ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_deadline_dates();

-- 8. 유용한 뷰 생성
CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT
  ch.*,
  (DATE(ch.hearing_date) - CURRENT_DATE) AS days_until_hearing
FROM court_hearings ch
WHERE ch.status = 'SCHEDULED'
  AND ch.hearing_date >= NOW()
ORDER BY ch.hearing_date ASC;

CREATE OR REPLACE VIEW urgent_deadlines AS
SELECT
  cd.*,
  dt.name as deadline_type_name,
  (cd.deadline_date - CURRENT_DATE) AS days_until_deadline
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
WHERE cd.status = 'PENDING'
  AND cd.deadline_date >= CURRENT_DATE
ORDER BY cd.deadline_date ASC;

-- 9. RLS 정책 (모든 인증된 사용자 허용)
ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_types ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 권한
CREATE POLICY "Service role can do everything on court_hearings"
  ON court_hearings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on case_deadlines"
  ON case_deadlines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on deadline_types"
  ON deadline_types
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 인증된 사용자도 모든 권한 (관리자 시스템)
CREATE POLICY "Authenticated users can manage court_hearings"
  ON court_hearings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage case_deadlines"
  ON case_deadlines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read deadline_types"
  ON deadline_types
  FOR SELECT
  TO authenticated
  USING (true);
