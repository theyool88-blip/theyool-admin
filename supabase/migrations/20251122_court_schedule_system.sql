-- ============================================================
-- 법무법인 더율 이혼사건 기일 관리 시스템
-- ============================================================

-- 1. 기일 유형 ENUM 타입 정의
CREATE TYPE hearing_type AS ENUM (
  'HEARING_MAIN',        -- 변론기일
  'HEARING_INTERIM',     -- 사전·보전처분 심문기일
  'HEARING_MEDIATION',   -- 조정기일
  'HEARING_INVESTIGATION', -- 조사기일
  'HEARING_PARENTING',   -- 상담·교육·프로그램 기일
  'HEARING_JUDGMENT'     -- 선고기일
);

-- 2. 불변기간 유형 ENUM 타입 정의
CREATE TYPE deadline_type AS ENUM (
  'DL_APPEAL',          -- 상소기간 14일
  'DL_MEDIATION_OBJ',   -- 조정·화해 이의기간 14일
  'DL_IMM_APPEAL',      -- 즉시항고기간 7일
  'DL_APPEAL_BRIEF',    -- 항소이유서 제출기간 40일
  'DL_RETRIAL'          -- 재심의 소 제기기간 30일
);

-- 3. 기일 상태 ENUM 타입 정의
CREATE TYPE hearing_status AS ENUM (
  'SCHEDULED',    -- 예정
  'COMPLETED',    -- 완료
  'POSTPONED',    -- 연기
  'CANCELLED'     -- 취소
);

-- 4. 메인 기일 테이블
CREATE TABLE court_hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 사건 연결
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 기일 기본 정보
  hearing_type hearing_type NOT NULL,
  hearing_subtype TEXT, -- 세부 유형 (예: "변론준비기일", "증인신문기일")
  hearing_date TIMESTAMPTZ NOT NULL,
  hearing_time TEXT, -- "14:00", "오전 10시" 등

  -- 법원 정보
  court_name TEXT NOT NULL,
  court_room TEXT, -- 법정 호수
  judge_name TEXT,

  -- 출석 요구사항
  lawyer_required BOOLEAN DEFAULT true,
  client_required BOOLEAN DEFAULT false,
  opponent_required BOOLEAN DEFAULT false,

  -- 상태 및 결과
  status hearing_status DEFAULT 'SCHEDULED',
  result TEXT, -- 기일 결과 메모

  -- 연기 정보
  postponed_from UUID REFERENCES court_hearings(id), -- 이전 기일 참조
  postponed_to UUID REFERENCES court_hearings(id), -- 다음 기일 참조
  postpone_reason TEXT,

  -- 메모 및 준비사항
  preparation_notes TEXT, -- 준비사항
  internal_notes TEXT, -- 내부 메모

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- 5. 불변기간 관리 테이블
CREATE TABLE court_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 사건 연결
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,

  -- 관련 기일 (선택적)
  hearing_id UUID REFERENCES court_hearings(id) ON DELETE CASCADE,

  -- 불변기간 정보
  deadline_type deadline_type NOT NULL,
  base_date DATE NOT NULL, -- 기산일
  deadline_date DATE NOT NULL, -- 만료일
  days_count INTEGER NOT NULL, -- 기간 일수

  -- 상태 관리
  is_completed BOOLEAN DEFAULT false,
  completed_date DATE,
  completion_notes TEXT,

  -- 알림 설정
  alert_enabled BOOLEAN DEFAULT true,
  alert_days_before INTEGER DEFAULT 3, -- 며칠 전 알림

  -- 메모
  description TEXT,
  internal_notes TEXT,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 기일 세부 유형 참조 테이블 (마스터 데이터)
CREATE TABLE hearing_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_type hearing_type NOT NULL,
  subtype_name TEXT NOT NULL,
  description TEXT,
  lawyer_required_default BOOLEAN DEFAULT true,
  client_required_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(hearing_type, subtype_name)
);

-- 7. 기일 관련 문서 테이블
CREATE TABLE hearing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id UUID NOT NULL REFERENCES court_hearings(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT, -- "준비서면", "증거자료", "신청서" 등
  file_url TEXT,
  submitted_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 기일 알림 로그 테이블
CREATE TABLE hearing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id UUID REFERENCES court_hearings(id) ON DELETE CASCADE,
  deadline_id UUID REFERENCES court_deadlines(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'SMS', 'EMAIL', 'KAKAO'
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_successful BOOLEAN DEFAULT true,
  error_message TEXT,

  CHECK (
    (hearing_id IS NOT NULL AND deadline_id IS NULL) OR
    (hearing_id IS NULL AND deadline_id IS NOT NULL)
  )
);

-- ============================================================
-- 인덱스 생성
-- ============================================================

CREATE INDEX idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX idx_court_hearings_hearing_date ON court_hearings(hearing_date);
CREATE INDEX idx_court_hearings_status ON court_hearings(status);
CREATE INDEX idx_court_hearings_type ON court_hearings(hearing_type);

CREATE INDEX idx_court_deadlines_case_id ON court_deadlines(case_id);
CREATE INDEX idx_court_deadlines_deadline_date ON court_deadlines(deadline_date);
CREATE INDEX idx_court_deadlines_is_completed ON court_deadlines(is_completed);

-- ============================================================
-- 트리거 함수: updated_at 자동 업데이트
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_court_hearings_updated_at
  BEFORE UPDATE ON court_hearings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_court_deadlines_updated_at
  BEFORE UPDATE ON court_deadlines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 뷰: 다가오는 기일 및 불변기간
-- ============================================================

-- 다가오는 기일 뷰 (7일 이내)
CREATE VIEW upcoming_hearings AS
SELECT
  ch.*,
  lc.case_number,
  lc.client_name,
  lc.opponent_name,
  DATE_PART('day', ch.hearing_date - NOW()) as days_until
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
WHERE ch.status = 'SCHEDULED'
  AND ch.hearing_date >= NOW()
  AND ch.hearing_date <= NOW() + INTERVAL '7 days'
ORDER BY ch.hearing_date;

-- 임박한 불변기간 뷰 (3일 이내)
CREATE VIEW urgent_deadlines AS
SELECT
  cd.*,
  lc.case_number,
  lc.client_name,
  DATE_PART('day', cd.deadline_date - CURRENT_DATE) as days_remaining
FROM court_deadlines cd
JOIN legal_cases lc ON cd.case_id = lc.id
WHERE cd.is_completed = false
  AND cd.deadline_date >= CURRENT_DATE
  AND cd.deadline_date <= CURRENT_DATE + 3
ORDER BY cd.deadline_date;

-- ============================================================
-- 초기 마스터 데이터 입력
-- ============================================================

-- 기일 세부 유형 마스터 데이터
INSERT INTO hearing_subtypes (hearing_type, subtype_name, description, lawyer_required_default, client_required_default, sort_order) VALUES
-- 변론기일 세부 유형
('HEARING_MAIN', '변론기일', '일반 변론기일', true, false, 1),
('HEARING_MAIN', '변론준비기일', '변론 준비를 위한 기일', true, false, 2),
('HEARING_MAIN', '증인신문기일', '증인 신문을 위한 기일', true, true, 3),
('HEARING_MAIN', '당사자신문기일', '당사자 본인 신문 기일', true, true, 4),
('HEARING_MAIN', '화해기일', '화해 시도를 위한 기일', true, true, 5),

-- 사전·보전처분 심문기일 세부 유형
('HEARING_INTERIM', '임시양육자지정 심문', '임시양육자 지정 심문', true, true, 1),
('HEARING_INTERIM', '임시양육비 심문', '임시양육비 결정 심문', true, false, 2),
('HEARING_INTERIM', '재산가처분 심문', '재산 가처분 심문', true, false, 3),
('HEARING_INTERIM', '면접교섭 심문', '면접교섭권 관련 심문', true, true, 4),

-- 조정기일 세부 유형
('HEARING_MEDIATION', '조정기일', '일반 조정기일', true, true, 1),
('HEARING_MEDIATION', '조정전치기일', '조정전치 절차 기일', true, true, 2),
('HEARING_MEDIATION', '조정회부기일', '조정 회부된 사건 기일', true, true, 3),

-- 조사기일 세부 유형
('HEARING_INVESTIGATION', '가사조사관 조사', '가사조사관 조사 기일', false, true, 1),
('HEARING_INVESTIGATION', '자녀면담', '미성년자녀 의견 청취', false, false, 2),
('HEARING_INVESTIGATION', '심리검사', '심리검사 진행', false, true, 3),

-- 상담·교육 세부 유형
('HEARING_PARENTING', '부모교육', '이혼 전 부모교육', false, true, 1),
('HEARING_PARENTING', '자녀상담', '자녀 심리상담', false, false, 2),
('HEARING_PARENTING', '가족상담', '가족 전체 상담', false, true, 3),

-- 선고기일 세부 유형
('HEARING_JUDGMENT', '선고기일', '판결 선고 기일', true, false, 1),
('HEARING_JUDGMENT', '결정선고', '결정 선고 기일', true, false, 2);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

ALTER TABLE court_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_notifications ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 기일 조회/수정 가능
CREATE POLICY "Admins can manage all hearings" ON court_hearings
  FOR ALL USING (true);

CREATE POLICY "Admins can manage all deadlines" ON court_deadlines
  FOR ALL USING (true);

-- ============================================================
-- 헬퍼 함수: 불변기간 자동 계산
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_deadline_date(
  p_base_date DATE,
  p_deadline_type deadline_type
) RETURNS DATE AS $$
DECLARE
  v_days INTEGER;
BEGIN
  CASE p_deadline_type
    WHEN 'DL_APPEAL' THEN v_days := 14;
    WHEN 'DL_MEDIATION_OBJ' THEN v_days := 14;
    WHEN 'DL_IMM_APPEAL' THEN v_days := 7;
    WHEN 'DL_APPEAL_BRIEF' THEN v_days := 40;
    WHEN 'DL_RETRIAL' THEN v_days := 30;
    ELSE v_days := 0;
  END CASE;

  RETURN p_base_date + v_days;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 통계 뷰: 기일 현황 대시보드용
-- ============================================================

CREATE VIEW hearing_statistics AS
SELECT
  lc.id as case_id,
  lc.case_number,
  COUNT(DISTINCT ch.id) FILTER (WHERE ch.status = 'SCHEDULED') as scheduled_count,
  COUNT(DISTINCT ch.id) FILTER (WHERE ch.status = 'COMPLETED') as completed_count,
  COUNT(DISTINCT cd.id) FILTER (WHERE cd.is_completed = false) as pending_deadlines,
  MIN(ch.hearing_date) FILTER (WHERE ch.status = 'SCHEDULED') as next_hearing_date
FROM legal_cases lc
LEFT JOIN court_hearings ch ON lc.id = ch.case_id
LEFT JOIN court_deadlines cd ON lc.id = cd.case_id
GROUP BY lc.id, lc.case_number;