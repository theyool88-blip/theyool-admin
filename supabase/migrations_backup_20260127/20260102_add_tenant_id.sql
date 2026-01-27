-- =====================================================
-- 멀티테넌트 SaaS 시스템 - 기존 테이블에 tenant_id 추가
-- 생성일: 2025-12-31
-- 설명: 기존 테이블들에 tenant_id 컬럼 추가 및 인덱스 생성
-- 주의: 이 마이그레이션 후 데이터 마이그레이션 필요 (20260105_migrate_theyool.sql)
-- =====================================================

-- =====================================================
-- 1. clients 테이블
-- =====================================================
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);

COMMENT ON COLUMN clients.tenant_id IS '소속 테넌트 ID';

-- =====================================================
-- 2. legal_cases 테이블
-- =====================================================
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 담당 변호사 (멤버) 연결
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_cases_tenant_id ON legal_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_assigned_member ON legal_cases(assigned_member_id);

COMMENT ON COLUMN legal_cases.tenant_id IS '소속 테넌트 ID';
COMMENT ON COLUMN legal_cases.assigned_member_id IS '담당 변호사 (멤버) ID';

-- =====================================================
-- 3. consultations 테이블
-- =====================================================
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 담당자 연결
ALTER TABLE consultations
ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_tenant_id ON consultations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consultations_assigned_member ON consultations(assigned_member_id);

COMMENT ON COLUMN consultations.tenant_id IS '소속 테넌트 ID';
COMMENT ON COLUMN consultations.assigned_member_id IS '담당자 ID';

-- =====================================================
-- 4. payments 테이블
-- =====================================================
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);

COMMENT ON COLUMN payments.tenant_id IS '소속 테넌트 ID';

-- =====================================================
-- 5. expenses 테이블
-- =====================================================
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);

COMMENT ON COLUMN expenses.tenant_id IS '소속 테넌트 ID';

-- =====================================================
-- 6. bookings 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 7. general_schedules 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'general_schedules') THEN
    ALTER TABLE general_schedules
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_general_schedules_tenant_id ON general_schedules(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 8. consultation_weekly_schedule 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultation_weekly_schedule') THEN
    ALTER TABLE consultation_weekly_schedule
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_consultation_weekly_schedule_tenant_id
      ON consultation_weekly_schedule(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 9. consultation_date_exceptions 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultation_date_exceptions') THEN
    ALTER TABLE consultation_date_exceptions
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_consultation_date_exceptions_tenant_id
      ON consultation_date_exceptions(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 10. receivable_writeoffs 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receivable_writeoffs') THEN
    ALTER TABLE receivable_writeoffs
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_tenant_id
      ON receivable_writeoffs(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 11. receivable_memos 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receivable_memos') THEN
    ALTER TABLE receivable_memos
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_receivable_memos_tenant_id
      ON receivable_memos(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 12. notification_templates 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_templates') THEN
    -- NULL이면 시스템 기본 템플릿
    ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_id
      ON notification_templates(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 13. notification_logs 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_logs') THEN
    ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id
      ON notification_logs(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 14. scourt_profiles 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profiles') THEN
    ALTER TABLE scourt_profiles
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    ALTER TABLE scourt_profiles
    ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_scourt_profiles_tenant_id ON scourt_profiles(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_scourt_profiles_member_id ON scourt_profiles(member_id);

    COMMENT ON COLUMN scourt_profiles.tenant_id IS '소속 테넌트 ID';
    COMMENT ON COLUMN scourt_profiles.member_id IS '담당 멤버 ID';
  END IF;
END $$;

-- =====================================================
-- 15. scourt_user_wmonid 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_user_wmonid') THEN
    ALTER TABLE scourt_user_wmonid
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    ALTER TABLE scourt_user_wmonid
    ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_tenant_id ON scourt_user_wmonid(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_scourt_user_wmonid_member_id ON scourt_user_wmonid(member_id);

    COMMENT ON COLUMN scourt_user_wmonid.tenant_id IS '소속 테넌트 ID';
    COMMENT ON COLUMN scourt_user_wmonid.member_id IS '담당 멤버 ID (WMONID 소유자)';
  END IF;
END $$;

-- =====================================================
-- 16. scourt_profile_cases 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profile_cases') THEN
    ALTER TABLE scourt_profile_cases
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_scourt_profile_cases_tenant_id ON scourt_profile_cases(tenant_id);

    COMMENT ON COLUMN scourt_profile_cases.tenant_id IS '소속 테넌트 ID';
  END IF;
END $$;

-- =====================================================
-- 17. scourt_case_snapshots 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_case_snapshots') THEN
    ALTER TABLE scourt_case_snapshots
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_scourt_case_snapshots_tenant_id ON scourt_case_snapshots(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 18. scourt_case_updates 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_case_updates') THEN
    ALTER TABLE scourt_case_updates
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_scourt_case_updates_tenant_id ON scourt_case_updates(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 19. scourt_sync_logs 테이블
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_sync_logs') THEN
    ALTER TABLE scourt_sync_logs
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_scourt_sync_logs_tenant_id ON scourt_sync_logs(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 20. case_files 테이블 (존재하는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_files') THEN
    ALTER TABLE case_files
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_case_files_tenant_id ON case_files(tenant_id);
  END IF;
END $$;

-- =====================================================
-- 완료 - 다음 마이그레이션에서 데이터 마이그레이션 필요
-- =====================================================
