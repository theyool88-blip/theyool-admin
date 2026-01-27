-- =====================================================
-- 20260116000012_add_performance_indexes.sql
-- 성능 최적화 인덱스 추가
-- 작성일: 2026-01-16
-- 설명: unified_calendar 및 주요 쿼리 최적화를 위한 인덱스 추가
-- =====================================================

-- =====================================================
-- 0. 필수 확장 설치 (먼저 설치해야 gin_trgm_ops 사용 가능)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- 1. unified_calendar 쿼리 최적화 인덱스
-- =====================================================

-- court_hearings: 기일 조회 최적화
CREATE INDEX IF NOT EXISTS idx_court_hearings_date_tenant
  ON court_hearings(hearing_date, case_id)
  WHERE status != 'CANCELLED';

-- case_deadlines: 데드라인 조회 최적화
CREATE INDEX IF NOT EXISTS idx_case_deadlines_date_status
  ON case_deadlines(deadline_date, status)
  WHERE status = 'PENDING';

-- consultations: 상담 일정 조회 최적화
CREATE INDEX IF NOT EXISTS idx_consultations_preferred_date
  ON consultations(preferred_date, tenant_id)
  WHERE preferred_date IS NOT NULL;

-- =====================================================
-- 2. 사건 조회 최적화 인덱스
-- =====================================================

-- legal_cases: 테넌트별 사건 조회
CREATE INDEX IF NOT EXISTS idx_legal_cases_tenant_status
  ON legal_cases(tenant_id, status);

-- legal_cases: 담당자별 사건 조회
CREATE INDEX IF NOT EXISTS idx_legal_cases_assigned_to
  ON legal_cases(assigned_to, status);

-- legal_cases: 사건번호 검색
CREATE INDEX IF NOT EXISTS idx_legal_cases_court_case_number_gin
  ON legal_cases USING gin(court_case_number gin_trgm_ops);

-- =====================================================
-- 3. 당사자 조회 최적화 인덱스
-- =====================================================

-- case_parties: 사건별 당사자 조회
CREATE INDEX IF NOT EXISTS idx_case_parties_case_client
  ON case_parties(case_id, is_our_client, is_primary);

-- case_parties: 의뢰인 이름 검색
CREATE INDEX IF NOT EXISTS idx_case_parties_name_gin
  ON case_parties USING gin(party_name gin_trgm_ops);

-- =====================================================
-- 4. 입금/지출 조회 최적화 인덱스
-- =====================================================

-- payments: 월별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date
  ON payments(tenant_id, payment_date DESC);

-- payments: 사건별 입금 합계
CREATE INDEX IF NOT EXISTS idx_payments_case_category
  ON payments(case_id, payment_category)
  WHERE case_id IS NOT NULL;

-- expenses: 월별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date
  ON expenses(tenant_id, expense_date DESC);

-- =====================================================
-- 5. SCOURT 시스템 최적화 인덱스
-- =====================================================

-- scourt_sync_jobs: 처리 대기 작업 조회
CREATE INDEX IF NOT EXISTS idx_scourt_sync_jobs_pending
  ON scourt_sync_jobs(status, priority DESC, created_at)
  WHERE status = 'queued';

-- scourt_case_updates: 미읽음 업데이트 조회 (이미 006_scourt_system.sql에 정의됨)
-- idx_scourt_updates_unread_client ON scourt_case_updates(legal_case_id) WHERE is_read_by_client = FALSE

-- scourt_profiles: 프로필별 사건 조회 (이미 006_scourt_system.sql에 정의됨)
-- idx_scourt_profile_cases_profile_id ON scourt_profile_cases(profile_id)

-- =====================================================
-- 6. 복합 인덱스 (자주 사용되는 JOIN 패턴)
-- =====================================================

-- court_hearings + legal_cases JOIN 최적화
CREATE INDEX IF NOT EXISTS idx_court_hearings_case_date
  ON court_hearings(case_id, hearing_date DESC);

-- case_deadlines + legal_cases JOIN 최적화
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_date
  ON case_deadlines(case_id, deadline_date);

-- =====================================================
-- 완료
-- =====================================================
