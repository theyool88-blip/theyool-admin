-- ============================================================================
-- 법률 사무소 SaaS - 기일 & 일정 도메인
-- 생성일: 2026-02-01
-- 설명: court_hearings, case_deadlines, deadline_types, general_schedules, holidays
-- ============================================================================

-- ============================================================================
-- 1. deadline_types 테이블 (데드라인 유형 마스터)
-- ============================================================================
CREATE TABLE IF NOT EXISTS deadline_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type deadline_type UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ko VARCHAR(100),
  description TEXT,
  days_count INTEGER NOT NULL,
  trigger_event VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 데드라인 유형 삽입
INSERT INTO deadline_types (type, name, name_ko, description, days_count, trigger_event) VALUES
  ('DL_APPEAL', '상소기간', '상소기간', '항소 또는 상고 제기 가능 기간', 14, '판결 정본 송달일'),
  ('DL_MEDIATION_OBJ', '조정·화해 이의기간', '조정이의기간', '조정·화해에 대한 이의 제기 기간', 14, '조정조서 정본 송달일'),
  ('DL_IMM_APPEAL', '즉시항고기간', '즉시항고', '즉시항고 제기 가능 기간', 7, '결정문 정본 송달일'),
  ('DL_APPEAL_BRIEF', '항소이유서 제출기한', '항소이유서', '항소이유서 제출 마감일', 40, '제1심 판결문 송달일'),
  ('DL_APPEAL_BRIEF_HIGH', '상고이유서 제출기한', '상고이유서', '상고이유서 제출 마감일', 20, '항소심 판결문 송달일'),
  ('DL_RETRIAL', '재심의 소 제기기한', '재심기한', '재심 청구 가능 기간', 30, '판결 확정일'),
  ('DL_CRIMINAL_APPEAL', '형사상소기간', '형사상소', '형사사건 상소 기간', 7, '판결 선고일'),
  ('DL_FAMILY_NONLIT', '가사비송즉시항고', '비송즉시항고', '가사비송 즉시항고 기간', 7, '결정문 송달일'),
  ('DL_PAYMENT_ORDER', '지급명령이의기간', '지급명령이의', '지급명령 이의 기간', 14, '지급명령 송달일'),
  ('DL_ELEC_SERVICE', '전자송달기간', '전자송달', '전자송달 열람 간주 기간', 7, '전자송달 발송일'),
  ('DL_CUSTOM', '사용자정의기한', '사용자정의', '사용자가 직접 지정한 기한', 0, '사용자 지정')
ON CONFLICT (type) DO NOTHING;

-- 코멘트
COMMENT ON TABLE deadline_types IS '데드라인 유형 마스터 테이블 (불변기간 정의)';
COMMENT ON COLUMN deadline_types.days_count IS '불변기간 일수';
COMMENT ON COLUMN deadline_types.trigger_event IS '기산일 이벤트 설명';

-- ============================================================================
-- 2. court_hearings 테이블 (법원 기일)
-- ============================================================================
CREATE TABLE IF NOT EXISTS court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 기일 유형
  hearing_type hearing_type NOT NULL,
  hearing_detail VARCHAR(200),                    -- 상세 유형 (선택)

  -- 일시/장소
  hearing_date TIMESTAMPTZ NOT NULL,              -- 기일 날짜+시간
  court_name VARCHAR(200),                        -- 법원명
  location VARCHAR(200),                          -- 법정 위치 (본관 402호 등)

  -- 사건번호 (레거시 호환)
  case_number VARCHAR(100),                       -- 기일에 직접 연결된 사건번호

  -- 출석 정보
  lawyer_attendance_required BOOLEAN DEFAULT true,
  client_attendance_required BOOLEAN DEFAULT false,
  attending_lawyer_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,  -- 출석 변호사

  -- 화상기일 정보
  video_participant_side TEXT,                    -- plaintiff_side, defendant_side, both, NULL

  -- 상태 및 결과
  status hearing_status DEFAULT 'SCHEDULED',
  result hearing_result,
  result_notes TEXT,

  -- SCOURT 연동
  scourt_synced BOOLEAN DEFAULT false,
  scourt_hearing_hash VARCHAR(64),                -- 중복 확인용 해시
  scourt_type_raw TEXT,                           -- 원본 기일 유형
  scourt_raw_data JSONB,                          -- 원본 데이터

  -- 알림
  notice_received_date DATE,
  notice_document_url TEXT,

  -- 메모
  notes TEXT,

  -- Google Calendar 연동
  google_event_id VARCHAR(200),

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_hearing_date ON court_hearings(hearing_date);
CREATE INDEX IF NOT EXISTS idx_court_hearings_hearing_type ON court_hearings(hearing_type);
CREATE INDEX IF NOT EXISTS idx_court_hearings_status ON court_hearings(status);
CREATE INDEX IF NOT EXISTS idx_court_hearings_attending_lawyer ON court_hearings(attending_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_google_event_id ON court_hearings(google_event_id);
CREATE INDEX IF NOT EXISTS idx_court_hearings_video_participant ON court_hearings(video_participant_side) WHERE video_participant_side IS NOT NULL;

-- 코멘트
COMMENT ON TABLE court_hearings IS '법원 기일 정보';
COMMENT ON COLUMN court_hearings.hearing_type IS '기일 유형: HEARING_MAIN, HEARING_MEDIATION 등';
COMMENT ON COLUMN court_hearings.video_participant_side IS '화상 참여자 측: plaintiff_side, defendant_side, both, NULL';
COMMENT ON COLUMN court_hearings.attending_lawyer_id IS '출석 변호사 (담당 변호사와 다를 수 있음)';

-- ============================================================================
-- 3. case_deadlines 테이블 (사건 데드라인)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 데드라인 유형
  deadline_type deadline_type NOT NULL,
  custom_deadline_name VARCHAR(100),              -- DL_CUSTOM인 경우 이름

  -- 관련 기일 (선택)
  related_hearing_id UUID REFERENCES court_hearings(id) ON DELETE SET NULL,

  -- 당사자별 기한 지원 (20260114_deadline_party_support.sql)
  party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,
  party_side VARCHAR(30),  -- 'plaintiff_side' | 'defendant_side' | NULL

  -- 날짜 정보
  trigger_date DATE NOT NULL,                     -- 기산일
  deadline_date DATE NOT NULL,                    -- 만료일
  days_count INTEGER NOT NULL,                    -- 기간 일수

  -- 사건번호 (레거시 호환)
  case_number VARCHAR(100),

  -- 상태
  status deadline_status DEFAULT 'PENDING',
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,

  -- 알림
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 3,

  -- 메모
  notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_deadline CHECK (deadline_date >= trigger_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_id ON case_deadlines(case_id);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_deadline_date ON case_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_deadline_type ON case_deadlines(deadline_type);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_status ON case_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_id ON case_deadlines(party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_side ON case_deadlines(party_side) WHERE party_side IS NOT NULL;

-- 코멘트
COMMENT ON TABLE case_deadlines IS '사건 데드라인 (불변기간)';
COMMENT ON COLUMN case_deadlines.trigger_date IS '기산일 (송달일 등)';
COMMENT ON COLUMN case_deadlines.deadline_date IS '만료일 (공휴일 조정 포함)';
COMMENT ON COLUMN case_deadlines.party_id IS '연관된 당사자 ID (NULL이면 사건 전체 적용)';
COMMENT ON COLUMN case_deadlines.party_side IS '당사자 측: plaintiff_side(원고측), defendant_side(피고측), NULL(전체)';

-- ============================================================================
-- 4. general_schedules 테이블 (일반 일정 - 사건 무관)
-- ============================================================================
CREATE TABLE IF NOT EXISTS general_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 일정 정보
  title TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('meeting', 'appointment', 'task', 'other')),
  schedule_date DATE NOT NULL,
  schedule_time TIME,
  location TEXT,
  description TEXT,

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_general_schedules_tenant_id ON general_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_general_schedules_schedule_date ON general_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_general_schedules_schedule_type ON general_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_general_schedules_status ON general_schedules(status);
CREATE INDEX IF NOT EXISTS idx_general_schedules_assigned_to ON general_schedules(assigned_to);

-- 코멘트
COMMENT ON TABLE general_schedules IS '사건번호 없는 일반 일정';
COMMENT ON COLUMN general_schedules.schedule_type IS '일정 유형: meeting, appointment, task, other';

-- ============================================================================
-- 5. holidays 테이블 (한국 공휴일)
-- ============================================================================
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  year INTEGER,  -- 트리거로 자동 설정
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- 코멘트
COMMENT ON TABLE holidays IS '대한민국 법정 공휴일 (관공서의 공휴일에 관한 규정)';

-- holidays.year 자동 설정 트리거
CREATE OR REPLACE FUNCTION set_holiday_year()
RETURNS TRIGGER AS $$
BEGIN
  NEW.year := EXTRACT(YEAR FROM NEW.holiday_date)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_holidays_year ON holidays;
CREATE TRIGGER set_holidays_year
  BEFORE INSERT OR UPDATE OF holiday_date ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION set_holiday_year();

-- 2025년 공휴일 데이터
INSERT INTO holidays (holiday_date, holiday_name) VALUES
  ('2025-01-01', '신정'),
  ('2025-01-28', '설날 전날'),
  ('2025-01-29', '설날'),
  ('2025-01-30', '설날 다음날'),
  ('2025-03-01', '삼일절'),
  ('2025-05-05', '어린이날'),
  ('2025-05-06', '부처님오신날'),
  ('2025-06-06', '현충일'),
  ('2025-08-15', '광복절'),
  ('2025-10-03', '개천절'),
  ('2025-10-05', '추석 전날'),
  ('2025-10-06', '추석'),
  ('2025-10-07', '추석 다음날'),
  ('2025-10-08', '추석 대체휴일'),
  ('2025-10-09', '한글날'),
  ('2025-12-25', '크리스마스')
ON CONFLICT (holiday_date) DO NOTHING;

-- 2026년 공휴일 데이터
INSERT INTO holidays (holiday_date, holiday_name) VALUES
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 전날'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 다음날'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '삼일절 대체휴일'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '부처님오신날 대체휴일'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '광복절 대체휴일'),
  ('2026-09-24', '추석 전날'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 다음날'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '개천절 대체휴일'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '크리스마스')
ON CONFLICT (holiday_date) DO NOTHING;

-- ============================================================================
-- 6. 데드라인 자동 계산 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_deadline_date(
  p_trigger_date DATE,
  p_deadline_type deadline_type
)
RETURNS DATE AS $$
DECLARE
  v_days_count INTEGER;
  v_deadline_date DATE;
BEGIN
  -- 일수 조회
  SELECT days_count INTO v_days_count
  FROM deadline_types
  WHERE type = p_deadline_type;

  IF v_days_count IS NULL OR v_days_count = 0 THEN
    RAISE EXCEPTION 'Invalid deadline type or zero days: %', p_deadline_type;
  END IF;

  -- 기본 기한 계산
  v_deadline_date := p_trigger_date + (v_days_count || ' days')::INTERVAL;

  -- 공휴일/주말 조정 (민법 제161조)
  WHILE (
    EXTRACT(DOW FROM v_deadline_date) IN (0, 6) OR  -- 일요일(0), 토요일(6)
    EXISTS (SELECT 1 FROM holidays WHERE holiday_date = v_deadline_date)
  ) LOOP
    v_deadline_date := v_deadline_date + INTERVAL '1 day';
  END LOOP;

  RETURN v_deadline_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_deadline_date(DATE, deadline_type) IS '기산일과 데드라인 유형으로 만료일 계산 (공휴일 조정 포함)';

-- ============================================================================
-- 7. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_deadline_types_updated_at ON deadline_types;
CREATE TRIGGER update_deadline_types_updated_at
  BEFORE UPDATE ON deadline_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_court_hearings_updated_at ON court_hearings;
CREATE TRIGGER update_court_hearings_updated_at
  BEFORE UPDATE ON court_hearings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_deadlines_updated_at ON case_deadlines;
CREATE TRIGGER update_case_deadlines_updated_at
  BEFORE UPDATE ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_general_schedules_updated_at ON general_schedules;
CREATE TRIGGER update_general_schedules_updated_at
  BEFORE UPDATE ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_general_schedules_tenant_id ON general_schedules;
CREATE TRIGGER set_general_schedules_tenant_id
  BEFORE INSERT ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 9. 데드라인 자동 계산 트리거
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_calculate_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- deadline_date가 없으면 자동 계산
  IF NEW.deadline_date IS NULL AND NEW.deadline_type != 'DL_CUSTOM' THEN
    NEW.deadline_date := calculate_deadline_date(NEW.trigger_date, NEW.deadline_type);
  END IF;

  -- days_count가 없으면 자동 설정
  IF NEW.days_count IS NULL THEN
    SELECT days_count INTO NEW.days_count
    FROM deadline_types
    WHERE type = NEW.deadline_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_calculate_deadline_trigger ON case_deadlines;
CREATE TRIGGER auto_calculate_deadline_trigger
  BEFORE INSERT ON case_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_deadline();

-- ============================================================================
-- 10. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE deadline_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- deadline_types: 모두 조회 가능
CREATE POLICY "anyone_can_view_deadline_types" ON deadline_types
  FOR SELECT TO authenticated
  USING (true);

-- holidays: 모두 조회 가능
CREATE POLICY "anyone_can_view_holidays" ON holidays
  FOR SELECT TO authenticated
  USING (true);

-- court_hearings: 사건 기반 테넌트 격리
CREATE POLICY "tenant_isolation_court_hearings" ON court_hearings
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = court_hearings.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = court_hearings.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  );

-- case_deadlines: 사건 기반 테넌트 격리
CREATE POLICY "tenant_isolation_case_deadlines" ON case_deadlines
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_deadlines.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_deadlines.case_id
        AND lc.tenant_id = get_current_tenant_id()
    )
  );

-- general_schedules: 테넌트 격리
CREATE POLICY "tenant_isolation_general_schedules" ON general_schedules
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
