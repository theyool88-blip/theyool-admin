-- =====================================================
-- 법무법인 더율 - 법원 기일 관리 시스템
-- 작성일: 2025-11-22
-- 설명: 이혼사건 기일, 불변기간, 데드라인 관리
-- =====================================================

-- =====================================================
-- 1. ENUM 타입 정의
-- =====================================================

-- 대표 기일 유형 (6가지)
CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',           -- 변론기일
  'HEARING_INTERIM',        -- 사전·보전처분 심문기일
  'HEARING_MEDIATION',      -- 조정기일
  'HEARING_INVESTIGATION',  -- 조사기일
  'HEARING_PARENTING',      -- 상담·교육·프로그램 기일
  'HEARING_JUDGMENT'        -- 선고기일
);

-- 데드라인 유형 (5가지 불변기간)
CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',              -- 상소기간 (14일)
  'DL_MEDIATION_OBJ',       -- 조정·화해 이의기간 (14일)
  'DL_IMM_APPEAL',          -- 즉시항고기간 (7일)
  'DL_APPEAL_BRIEF',        -- 항소이유서 제출 (40일)
  'DL_RETRIAL'              -- 재심의 소 제기 (30일)
);

-- 기일 상태
CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',    -- 예정
  'COMPLETED',    -- 완료
  'POSTPONED',    -- 연기
  'CANCELLED'     -- 취소
);

-- 데드라인 상태
CREATE TYPE deadline_status AS ENUM (
  'PENDING',      -- 대기 중
  'COMPLETED',    -- 완료
  'OVERDUE'       -- 기한 초과
);

-- =====================================================
-- 2. 데드라인 타입 마스터 테이블 (불변기간 정의)
-- =====================================================
CREATE TABLE deadline_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type deadline_type UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  days_count INTEGER NOT NULL, -- 기한 일수
  trigger_event VARCHAR(200),  -- 트리거 이벤트 설명
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입
INSERT INTO deadline_types (type, name, description, days_count, trigger_event) VALUES
  ('DL_APPEAL', '상소기간', '항소 또는 상고 제기 가능 기간', 14, '판결 정본 송달일'),
  ('DL_MEDIATION_OBJ', '조정·화해 이의기간', '조정·화해에 대한 이의 제기 기간', 14, '조정조서 정본 송달일'),
  ('DL_IMM_APPEAL', '즉시항고기간', '즉시항고 제기 가능 기간', 7, '결정문 정본 송달일'),
  ('DL_APPEAL_BRIEF', '항소이유서 제출기한', '항소이유서 제출 마감일', 40, '제1심 판결문 송달일'),
  ('DL_RETRIAL', '재심의 소 제기기한', '재심 청구 가능 기간', 30, '판결 확정일');

-- =====================================================
-- 3. 법원 기일 테이블
-- =====================================================
CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  hearing_type hearing_type NOT NULL,
  hearing_detail VARCHAR(200), -- 세부 기일명 (예: "증인신문기일", "당사자신문기일")

  -- 일시 및 장소
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  court_name VARCHAR(200),     -- 법원명 (예: "수원지방법원 가정법원")
  courtroom VARCHAR(100),      -- 법정 (예: "402호 법정")

  -- 출석 정보
  lawyer_attendance_required BOOLEAN DEFAULT true,
  client_attendance_required BOOLEAN DEFAULT false,

  -- 상태 및 메모
  status hearing_status DEFAULT 'SCHEDULED',
  notes TEXT,                  -- 준비사항, 특이사항 등
  result TEXT,                 -- 기일 결과 (완료 후 입력)

  -- 문서 정보
  notice_received_date DATE,   -- 기일통지서 수령일
  notice_document_url TEXT,    -- 기일통지서 파일 URL

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- 인덱스를 위한 제약조건
  CONSTRAINT valid_date CHECK (scheduled_date >= CURRENT_DATE - INTERVAL '10 years')
);

-- 인덱스 생성
CREATE INDEX idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX idx_court_hearings_date ON court_hearings(scheduled_date);
CREATE INDEX idx_court_hearings_status ON court_hearings(status);
CREATE INDEX idx_court_hearings_type ON court_hearings(hearing_type);

-- =====================================================
-- 4. 사건 데드라인 테이블
-- =====================================================
CREATE TABLE case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연관 정보
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  deadline_type deadline_type NOT NULL,
  related_hearing_id UUID REFERENCES court_hearings(id) ON DELETE SET NULL, -- 트리거가 된 기일

  -- 날짜 정보
  trigger_date DATE NOT NULL,           -- 트리거 기준일 (예: 판결문 송달일)
  deadline_date DATE NOT NULL,          -- 실제 데드라인
  days_count INTEGER NOT NULL,          -- 계산에 사용된 일수

  -- 상태 및 완료 정보
  status deadline_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,               -- 완료 시 메모 (예: "항소 제기 완료")

  -- 알림 설정
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3, -- D-3 알림

  -- 메타데이터
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT valid_deadline CHECK (deadline_date >= trigger_date)
);

-- 인덱스 생성
CREATE INDEX idx_case_deadlines_case_id ON case_deadlines(case_id);
CREATE INDEX idx_case_deadlines_deadline_date ON case_deadlines(deadline_date);
CREATE INDEX idx_case_deadlines_status ON case_deadlines(status);
CREATE INDEX idx_case_deadlines_type ON case_deadlines(deadline_type);

-- =====================================================
-- 5. 데드라인 자동 계산 함수
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_deadline_date(
  p_trigger_date DATE,
  p_deadline_type deadline_type
)
RETURNS DATE AS $$
DECLARE
  v_days_count INTEGER;
  v_deadline_date DATE;
BEGIN
  -- deadline_types 테이블에서 일수 조회
  SELECT days_count INTO v_days_count
  FROM deadline_types
  WHERE type = p_deadline_type;

  IF v_days_count IS NULL THEN
    RAISE EXCEPTION 'Invalid deadline type: %', p_deadline_type;
  END IF;

  -- 기준일 + 일수 계산 (주말/공휴일 포함)
  v_deadline_date := p_trigger_date + (v_days_count || ' days')::INTERVAL;

  RETURN v_deadline_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 6. 자동 업데이트 트리거
-- =====================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- court_hearings 트리거
CREATE TRIGGER update_court_hearings_updated_at
  BEFORE UPDATE ON court_hearings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- case_deadlines 트리거
CREATE TRIGGER update_case_deadlines_updated_at
  BEFORE UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- deadline_types 트리거
CREATE TRIGGER update_deadline_types_updated_at
  BEFORE UPDATE ON deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. 데드라인 INSERT 시 자동 계산 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION auto_calculate_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- deadline_date가 비어있으면 자동 계산
  IF NEW.deadline_date IS NULL THEN
    NEW.deadline_date := calculate_deadline_date(NEW.trigger_date, NEW.deadline_type);
  END IF;

  -- days_count가 비어있으면 자동 채움
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

-- =====================================================
-- 8. 데드라인 상태 자동 업데이트 함수 (Cron Job용)
-- =====================================================
CREATE OR REPLACE FUNCTION update_overdue_deadlines()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- 기한이 지난 PENDING 데드라인을 OVERDUE로 변경
  UPDATE case_deadlines
  SET status = 'OVERDUE'
  WHERE status = 'PENDING'
    AND deadline_date < CURRENT_DATE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. RLS (Row Level Security) 정책
-- =====================================================

-- RLS 활성화
ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_types ENABLE ROW LEVEL SECURITY;

-- deadline_types는 모두 읽기 가능 (마스터 데이터)
CREATE POLICY "deadline_types_select_all"
  ON deadline_types FOR SELECT
  USING (true);

-- 관리자만 deadline_types 수정 가능
CREATE POLICY "deadline_types_admin_all"
  ON deadline_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email = 'admin@theyool.com'
    )
  );

-- court_hearings: 본인이 생성한 사건만 조회
CREATE POLICY "court_hearings_select_own_cases"
  ON court_hearings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = court_hearings.case_id
        AND legal_cases.created_by = auth.uid()
    )
  );

-- court_hearings: 본인이 생성한 사건만 수정
CREATE POLICY "court_hearings_modify_own_cases"
  ON court_hearings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = court_hearings.case_id
        AND legal_cases.created_by = auth.uid()
    )
  );

-- case_deadlines: 본인이 생성한 사건만 조회
CREATE POLICY "case_deadlines_select_own_cases"
  ON case_deadlines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = case_deadlines.case_id
        AND legal_cases.created_by = auth.uid()
    )
  );

-- case_deadlines: 본인이 생성한 사건만 수정
CREATE POLICY "case_deadlines_modify_own_cases"
  ON case_deadlines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = case_deadlines.case_id
        AND legal_cases.created_by = auth.uid()
    )
  );

-- =====================================================
-- 10. 유용한 뷰 (View) 생성
-- =====================================================

-- 다가오는 기일 (7일 이내)
CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT
  ch.*,
  lc.case_name,
  lc.case_number,
  u.email as lawyer_email
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN auth.users u ON lc.created_by = u.id
WHERE ch.status = 'SCHEDULED'
  AND ch.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY ch.scheduled_date, ch.scheduled_time;

-- 긴급 데드라인 (3일 이내)
CREATE OR REPLACE VIEW urgent_deadlines AS
SELECT
  cd.*,
  dt.name as deadline_name,
  lc.case_name,
  lc.case_number,
  u.email as lawyer_email
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN auth.users u ON lc.created_by = u.id
WHERE cd.status = 'PENDING'
  AND cd.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY cd.deadline_date;

-- =====================================================
-- 11. 샘플 데이터 (테스트용)
-- =====================================================

-- 참고: 실제 운영 환경에서는 아래 주석 처리
/*
INSERT INTO court_hearings (
  case_id,
  hearing_type,
  hearing_detail,
  scheduled_date,
  scheduled_time,
  court_name,
  courtroom,
  lawyer_attendance_required,
  client_attendance_required,
  notes
) VALUES (
  'existing-case-uuid-here', -- legal_cases의 실제 ID로 교체
  'HEARING_MAIN',
  '변론기일',
  '2025-12-15',
  '14:00',
  '수원지방법원 가정법원',
  '402호 법정',
  true,
  true,
  '양육권 관련 증거자료 준비 필요'
);

INSERT INTO case_deadlines (
  case_id,
  deadline_type,
  trigger_date,
  notes
) VALUES (
  'existing-case-uuid-here', -- legal_cases의 실제 ID로 교체
  'DL_APPEAL',
  '2025-11-20',
  '판결문 정본 수령, 항소 검토 중'
);
*/

-- =====================================================
-- 완료
-- =====================================================
COMMENT ON TABLE court_hearings IS '법원 기일 관리 테이블';
COMMENT ON TABLE case_deadlines IS '사건 데드라인 관리 테이블';
COMMENT ON TABLE deadline_types IS '불변기간 마스터 테이블';
COMMENT ON FUNCTION calculate_deadline_date IS '데드라인 자동 계산 함수';
COMMENT ON FUNCTION update_overdue_deadlines IS '기한 초과 데드라인 상태 업데이트 (Cron Job용)';
