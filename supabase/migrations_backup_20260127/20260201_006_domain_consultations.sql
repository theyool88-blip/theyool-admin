-- ============================================================================
-- 법률 사무소 SaaS - 상담 도메인
-- 생성일: 2026-02-01
-- 설명: consultations, bookings, consultation_weekly_schedule, consultation_date_exceptions
-- ============================================================================

-- ============================================================================
-- 1. consultations 테이블 (상담 신청)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- 신청자 정보
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- 상담 분류
  category TEXT,                                  -- 테넌트 설정에서 정의
  request_type TEXT,                              -- 상담 요청 유형

  -- 상담 내용
  message TEXT,

  -- 희망 일시 (선택)
  preferred_date DATE,
  preferred_time TEXT,

  -- 상담료
  consultation_fee INTEGER DEFAULT 0,

  -- 유입 경로
  source TEXT,                                    -- 홈페이지, 네이버, 직접방문 등

  -- 사건 연결
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- 메모
  admin_notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_tenant_id ON consultations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_category ON consultations(category);
CREATE INDEX IF NOT EXISTS idx_consultations_preferred_date ON consultations(preferred_date);
CREATE INDEX IF NOT EXISTS idx_consultations_case_id ON consultations(case_id);
CREATE INDEX IF NOT EXISTS idx_consultations_assigned_to ON consultations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- 코멘트
COMMENT ON TABLE consultations IS '상담 신청 정보';
COMMENT ON COLUMN consultations.category IS '상담 분류 (테넌트 설정에서 정의)';
COMMENT ON COLUMN consultations.source IS '유입 경로 (홈페이지, 네이버 등)';

-- ============================================================================
-- 2. bookings 테이블 (상담 예약)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- 예약자 정보
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,

  -- 예약 유형
  type TEXT NOT NULL CHECK (type IN ('visit', 'video', 'phone')),

  -- 예약 분류
  category TEXT,                                  -- 테넌트 설정에서 정의
  message TEXT,

  -- 예약 일시
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,

  -- 장소/링크
  office_location TEXT,                           -- 방문 상담 사무소 (테넌트 설정에서 정의, 하드코딩 제거)
  video_link TEXT,                                -- 화상 상담 링크

  -- 담당자
  assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),

  -- 메모
  admin_notes TEXT,

  -- 상태 변경 시간
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_office_location ON bookings(office_location);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_to ON bookings(assigned_to);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- 코멘트
COMMENT ON TABLE bookings IS '상담 예약 정보';
COMMENT ON COLUMN bookings.type IS '예약 유형: visit(방문), video(화상), phone(전화)';
COMMENT ON COLUMN bookings.office_location IS '방문 사무소 (테넌트 설정에서 정의)';

-- ============================================================================
-- 3. consultation_weekly_schedule 테이블 (주간 반복 일정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 요일 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- 시간 범위
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- 예약 설정
  slot_duration_minutes INT DEFAULT 30,           -- 슬롯 길이 (분)
  max_bookings_per_slot INT DEFAULT 1,            -- 슬롯당 최대 예약 수

  -- 필터 (NULL이면 모든 변호사/사무소에 적용)
  assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  office_location TEXT,

  -- 활성화 여부
  is_available BOOLEAN DEFAULT true,

  -- 설명
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_slot_duration CHECK (slot_duration_minutes > 0),
  CONSTRAINT valid_max_bookings CHECK (max_bookings_per_slot > 0)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_tenant_id ON consultation_weekly_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_day ON consultation_weekly_schedule(day_of_week, is_available);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_member ON consultation_weekly_schedule(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_office ON consultation_weekly_schedule(office_location);

-- 코멘트
COMMENT ON TABLE consultation_weekly_schedule IS '상담 예약 주간 반복 일정';
COMMENT ON COLUMN consultation_weekly_schedule.day_of_week IS '요일 (0=일요일, 1=월요일, ..., 6=토요일)';
COMMENT ON COLUMN consultation_weekly_schedule.slot_duration_minutes IS '슬롯 길이 (분), 기본 30분';

-- ============================================================================
-- 4. consultation_date_exceptions 테이블 (특정 날짜 예외)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultation_date_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 예외 날짜
  exception_date DATE NOT NULL,

  -- 예외 타입
  is_blocked BOOLEAN DEFAULT false,               -- true: 휴무, false: 특별 운영

  -- 시간 범위 (NULL이면 종일)
  start_time TIME,
  end_time TIME,

  -- 필터
  assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
  office_location TEXT,

  -- 사유
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_exception_time_range CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_date_exceptions_tenant_id ON consultation_date_exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_date ON consultation_date_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_member ON consultation_date_exceptions(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_date_exceptions_office ON consultation_date_exceptions(office_location);

-- 코멘트
COMMENT ON TABLE consultation_date_exceptions IS '상담 예약 특정 날짜 예외 처리';
COMMENT ON COLUMN consultation_date_exceptions.is_blocked IS 'true: 휴무, false: 특별 운영';

-- ============================================================================
-- 5. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_schedule_updated_at ON consultation_weekly_schedule;
CREATE TRIGGER update_weekly_schedule_updated_at
  BEFORE UPDATE ON consultation_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_date_exceptions_updated_at ON consultation_date_exceptions;
CREATE TRIGGER update_date_exceptions_updated_at
  BEFORE UPDATE ON consultation_date_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 트리거: tenant_id 자동 설정
-- ============================================================================
-- consultations는 공개 INSERT 허용 (tenant_id는 API에서 설정)

DROP TRIGGER IF EXISTS set_bookings_tenant_id ON bookings;
CREATE TRIGGER set_bookings_tenant_id
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_weekly_schedule_tenant_id ON consultation_weekly_schedule;
CREATE TRIGGER set_weekly_schedule_tenant_id
  BEFORE INSERT ON consultation_weekly_schedule
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_date_exceptions_tenant_id ON consultation_date_exceptions;
CREATE TRIGGER set_date_exceptions_tenant_id
  BEFORE INSERT ON consultation_date_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 7. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_date_exceptions ENABLE ROW LEVEL SECURITY;

-- consultations: 공개 INSERT (웹사이트에서 상담 신청)
CREATE POLICY "public_insert_consultations" ON consultations
  FOR INSERT
  WITH CHECK (true);

-- consultations: 테넌트 격리 (조회/수정/삭제)
CREATE POLICY "tenant_isolation_consultations" ON consultations
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_manage_consultations" ON consultations
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_consultations" ON consultations
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- bookings: 공개 INSERT (웹사이트에서 예약)
CREATE POLICY "public_insert_bookings" ON bookings
  FOR INSERT
  WITH CHECK (true);

-- bookings: 테넌트 격리
CREATE POLICY "tenant_isolation_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_manage_bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_bookings" ON bookings
  FOR DELETE TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- consultation_weekly_schedule: 공개 조회, 테넌트 관리
CREATE POLICY "public_view_weekly_schedule" ON consultation_weekly_schedule
  FOR SELECT
  USING (true);

CREATE POLICY "tenant_manage_weekly_schedule" ON consultation_weekly_schedule
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- consultation_date_exceptions: 공개 조회, 테넌트 관리
CREATE POLICY "public_view_date_exceptions" ON consultation_date_exceptions
  FOR SELECT
  USING (true);

CREATE POLICY "tenant_manage_date_exceptions" ON consultation_date_exceptions
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 완료
-- ============================================================================
