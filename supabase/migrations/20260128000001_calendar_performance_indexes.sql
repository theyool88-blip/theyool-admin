-- =====================================================
-- 20260128000001_calendar_performance_indexes.sql
-- 캘린더 성능 최적화 인덱스
-- 작성일: 2026-01-28
-- 설명: unified_calendar 쿼리 최적화를 위한 복합 인덱스 추가
-- 주의: 기존 인덱스(20260116000012)와 충돌 확인 완료
-- =====================================================

-- =====================================================
-- 1. 테넌트 + 날짜 복합 인덱스 (가장 중요)
-- unified_calendar 쿼리의 핵심 필터링 조건
-- =====================================================

-- court_hearings: tenant는 legal_cases를 통해 필터링되므로
-- case_id + hearing_date 복합 인덱스가 더 효과적
CREATE INDEX IF NOT EXISTS idx_court_hearings_case_date_covering
  ON court_hearings(case_id, hearing_date)
  INCLUDE (id, hearing_type, status, location, notes, attending_lawyer_id,
           video_participant_side, scourt_type_raw, scourt_raw_data, case_number)
  WHERE status != 'CANCELLED';

-- case_deadlines: 마찬가지로 case_id + deadline_date
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_date_covering
  ON case_deadlines(case_id, deadline_date)
  INCLUDE (id, deadline_type, status, notes, case_number, case_party_id, custom_deadline_name)
  WHERE status = 'PENDING';

-- consultations: tenant_id + preferred_date (직접 테넌트 필터)
CREATE INDEX IF NOT EXISTS idx_consultations_tenant_date_covering
  ON consultations(tenant_id, preferred_date)
  INCLUDE (id, name, request_type, preferred_time, status, message, phone, assigned_to)
  WHERE preferred_date IS NOT NULL;

-- general_schedules: tenant_id + schedule_date
CREATE INDEX IF NOT EXISTS idx_general_schedules_tenant_date_covering
  ON general_schedules(tenant_id, schedule_date)
  INCLUDE (id, title, schedule_type, schedule_time, status, location, description, assigned_to);

-- =====================================================
-- 2. legal_cases 테넌트 인덱스 개선
-- JOIN 성능 향상을 위한 covering index
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_legal_cases_tenant_covering
  ON legal_cases(tenant_id, id)
  INCLUDE (case_name, court_name, court_case_number, assigned_to, primary_client_name);

-- =====================================================
-- 3. tenant_members display_name 조회 최적화
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tenant_members_id_covering
  ON tenant_members(id)
  INCLUDE (display_name);

-- =====================================================
-- 4. case_parties 서브쿼리 최적화
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_case_parties_case_order_covering
  ON case_parties(case_id, party_order)
  INCLUDE (party_type, party_name);

-- =====================================================
-- 완료
-- =====================================================

COMMENT ON INDEX idx_court_hearings_case_date_covering IS '캘린더 조회 최적화: court_hearings covering index';
COMMENT ON INDEX idx_case_deadlines_case_date_covering IS '캘린더 조회 최적화: case_deadlines covering index';
COMMENT ON INDEX idx_consultations_tenant_date_covering IS '캘린더 조회 최적화: consultations covering index';
COMMENT ON INDEX idx_general_schedules_tenant_date_covering IS '캘린더 조회 최적화: general_schedules covering index';
