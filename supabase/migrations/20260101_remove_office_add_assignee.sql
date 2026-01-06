-- ============================================================================
-- 마이그레이션: 지점 시스템 제거 + 담당자 시스템 추가 + 변호사 제한
-- ============================================================================

-- ============================================================================
-- PART 0: 의존성 뷰 먼저 삭제 (컬럼 삭제 전 필수)
-- ============================================================================

-- 지점(office_location)에 의존하는 모든 뷰 삭제
-- Payment 관련 뷰
DROP VIEW IF EXISTS payment_stats_by_office CASCADE;
DROP VIEW IF EXISTS payment_stats_by_category CASCADE;
DROP VIEW IF EXISTS payment_stats_by_month CASCADE;
DROP VIEW IF EXISTS monthly_revenue_summary CASCADE;
DROP VIEW IF EXISTS monthly_revenue_aggregation CASCADE;
DROP VIEW IF EXISTS payment_revenue_by_category CASCADE;
DROP VIEW IF EXISTS office_profitability CASCADE;

-- Expense 관련 뷰
DROP VIEW IF EXISTS monthly_expense_summary CASCADE;
DROP VIEW IF EXISTS expense_stats_by_category CASCADE;
DROP VIEW IF EXISTS expense_stats_by_office CASCADE;
DROP VIEW IF EXISTS expense_stats_by_month CASCADE;

-- Calendar/Consultation 관련 뷰
DROP VIEW IF EXISTS unified_calendar CASCADE;
DROP VIEW IF EXISTS consultation_stats_by_office CASCADE;

-- ============================================================================
-- PART 1: 지점(Office) 시스템 완전 제거
-- ============================================================================

-- 1.1 legal_cases.office 컬럼 제거
ALTER TABLE legal_cases DROP COLUMN IF EXISTS office;

-- 1.2 payments.office_location 컬럼 제거
ALTER TABLE payments DROP COLUMN IF EXISTS office_location;

-- 1.3 expenses.office_location 컬럼 제거
ALTER TABLE expenses DROP COLUMN IF EXISTS office_location;

-- 1.4 consultations.office_location 컬럼 제거
ALTER TABLE consultations DROP COLUMN IF EXISTS office_location;

-- 1.5 consultation_weekly_schedule.office_location 컬럼 제거
ALTER TABLE consultation_weekly_schedule DROP COLUMN IF EXISTS office_location;

-- 1.6 recurring_templates.office_location 컬럼 제거 (존재하는 경우)
ALTER TABLE recurring_templates DROP COLUMN IF EXISTS office_location;

-- 1.7 tenant_settings에서 officeLocations 설정 제거
UPDATE tenant_settings
SET settings = settings - 'officeLocations'
WHERE category IN ('payments', 'expenses', 'consultations', 'cases')
  AND settings ? 'officeLocations';

-- 1.8 지점 관련 인덱스 제거 (존재하는 경우)
DROP INDEX IF EXISTS idx_payments_office_location;
DROP INDEX IF EXISTS idx_expenses_office_location;
DROP INDEX IF EXISTS idx_weekly_schedule_office;

-- ============================================================================
-- PART 2: 사건 담당자(Assigned To) 시스템 추가
-- ============================================================================

-- 2.1 legal_cases에 assigned_to 컬럼 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES tenant_members(id) ON DELETE SET NULL;

-- 2.2 담당자 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_cases_assigned_to ON legal_cases(assigned_to);

-- 2.3 코멘트 추가
COMMENT ON COLUMN legal_cases.assigned_to IS '담당 변호사 (tenant_members.id 참조)';

-- ============================================================================
-- PART 3: 테넌트별 변호사 숫자 제한
-- ============================================================================

-- 3.1 tenants.features에 maxLawyers 필드 추가 (없는 경우)
UPDATE tenants
SET features = features || '{"maxLawyers": -1}'::jsonb
WHERE NOT features ? 'maxLawyers';

-- 3.2 features 컬럼 코멘트 업데이트
COMMENT ON COLUMN tenants.features IS '테넌트 기능 제한: maxCases, maxClients, maxMembers, maxLawyers(-1=무제한), scourtSync, clientPortal, homepage';

-- ============================================================================
-- PART 4: 통계 뷰 재생성 (지점 없이)
-- ============================================================================

-- 4.1 payment_stats_by_category 뷰 재생성
CREATE OR REPLACE VIEW payment_stats_by_category AS
SELECT
  tenant_id,
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(payment_date) as first_payment,
  MAX(payment_date) as last_payment
FROM payments
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, payment_category;

-- 4.2 payment_stats_by_month 뷰 재생성
CREATE OR REPLACE VIEW payment_stats_by_month AS
SELECT
  tenant_id,
  TO_CHAR(payment_date, 'YYYY-MM') as month,
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount
FROM payments
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, TO_CHAR(payment_date, 'YYYY-MM'), payment_category;

-- 4.3 monthly_revenue_summary 뷰 재생성
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT
  tenant_id,
  TO_CHAR(payment_date, 'YYYY-MM') as month,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  SUM(CASE WHEN is_confirmed THEN amount ELSE 0 END) as confirmed_amount
FROM payments
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, TO_CHAR(payment_date, 'YYYY-MM');

-- 4.4 expense_stats_by_category 뷰 재생성
CREATE OR REPLACE VIEW expense_stats_by_category AS
SELECT
  tenant_id,
  expense_category,
  COUNT(*) as expense_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM expenses
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, expense_category;

-- 4.5 monthly_expense_summary 뷰 재생성
CREATE OR REPLACE VIEW monthly_expense_summary AS
SELECT
  tenant_id,
  TO_CHAR(expense_date, 'YYYY-MM') as month,
  expense_category,
  COUNT(*) as expense_count,
  SUM(amount) as total_amount
FROM expenses
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id, TO_CHAR(expense_date, 'YYYY-MM'), expense_category;

-- ============================================================================
-- 완료
-- ============================================================================
