-- ============================================================================
-- 법률 사무소 SaaS - 재무 도메인
-- 생성일: 2026-02-01
-- 설명: payments, expenses, recurring_templates, receivable_writeoffs
-- NOTE: 하드코딩된 CONSTRAINT 제거 - 테넌트 설정에서 동적 로드
-- NOTE: partner_withdrawals, monthly_settlements 제거 (더율 특화, SaaS 불필요)
-- ============================================================================

-- ============================================================================
-- 1. payments 테이블 (입금 내역)
-- NOTE: 하드코딩 CONSTRAINT 제거 - payment_category, office_location은 테넌트 설정에서 정의
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 입금 기본 정보
  payment_date DATE NOT NULL,
  depositor_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount != 0),    -- 음수 = 환불

  -- 분류 정보 (테넌트 설정에서 정의 - 하드코딩 제거)
  office_location TEXT,                           -- 사무실 (테넌트 설정에서 정의)
  payment_category TEXT NOT NULL,                 -- 명목 (테넌트 설정에서 정의)

  -- 사건/의뢰인 연결
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL,

  -- 상담 연결 (선택)
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,

  -- 백업용 텍스트
  case_name TEXT,                                 -- 사건명 (레거시 호환)

  -- 영수증/세금 정보
  receipt_type TEXT,                              -- 현금영수증/카드결제/세금계산서 등
  receipt_issued_at TIMESTAMPTZ,

  -- 연락처 및 메모
  phone TEXT,
  memo TEXT,
  admin_notes TEXT,

  -- 관리용
  imported_from_csv BOOLEAN DEFAULT false,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 사건/상담 중 하나만 연결 가능
  CONSTRAINT chk_either_case_or_consultation CHECK (
    (case_id IS NOT NULL AND consultation_id IS NULL) OR
    (case_id IS NULL AND consultation_id IS NOT NULL) OR
    (case_id IS NULL AND consultation_id IS NULL)
  )
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_case_party_id ON payments(case_party_id);
CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_payments_office_location ON payments(office_location);
CREATE INDEX IF NOT EXISTS idx_payments_payment_category ON payments(payment_category);
CREATE INDEX IF NOT EXISTS idx_payments_depositor_name ON payments(depositor_name);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- 코멘트
COMMENT ON TABLE payments IS '입금 내역 관리';
COMMENT ON COLUMN payments.office_location IS '사무실 (테넌트 설정에서 정의)';
COMMENT ON COLUMN payments.payment_category IS '입금 명목 (테넌트 설정에서 정의)';
COMMENT ON COLUMN payments.case_party_id IS '입금한 당사자 (다수 당사자 지원)';

-- ============================================================================
-- 2. expenses 테이블 (지출 내역)
-- NOTE: 하드코딩 CONSTRAINT 제거 - expense_category, office_location은 테넌트 설정에서 정의
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 지출 기본 정보
  expense_date DATE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보 (테넌트 설정에서 정의 - 하드코딩 제거)
  expense_category TEXT NOT NULL,                 -- 지출 카테고리 (테넌트 설정에서 정의)
  subcategory TEXT,
  office_location TEXT,                           -- 사무실 (테넌트 설정에서 정의)

  -- 고정 지출 관련
  is_recurring BOOLEAN DEFAULT false,
  recurring_template_id UUID,

  -- 상세 정보
  vendor_name TEXT,                               -- 거래처
  memo TEXT,
  receipt_url TEXT,                               -- 영수증 이미지 URL
  payment_method TEXT,                            -- 카드/현금/계좌이체 등

  -- 관리 정보
  paid_by TEXT,
  admin_notes TEXT,

  -- 월별 집계용 (YYYY-MM) - 트리거로 자동 설정
  month_key TEXT,

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_category ON expenses(expense_category);
CREATE INDEX IF NOT EXISTS idx_expenses_office_location ON expenses(office_location);
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON expenses(is_recurring);
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_template_id ON expenses(recurring_template_id);
CREATE INDEX IF NOT EXISTS idx_expenses_month_key ON expenses(month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);

-- 코멘트
COMMENT ON TABLE expenses IS '지출 내역 관리';
COMMENT ON COLUMN expenses.expense_category IS '지출 카테고리 (테넌트 설정에서 정의)';
COMMENT ON COLUMN expenses.office_location IS '사무실 (테넌트 설정에서 정의)';
COMMENT ON COLUMN expenses.month_key IS '월별 집계용 키 (YYYY-MM)';

-- ============================================================================
-- 3. recurring_templates 테이블 (고정 지출 템플릿)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 템플릿 정보
  name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보 (테넌트 설정에서 정의)
  expense_category TEXT NOT NULL,
  subcategory TEXT,
  office_location TEXT,

  -- 상세 정보
  vendor_name TEXT,
  payment_method TEXT,
  memo TEXT,

  -- 반복 설정
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE,
  day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 28),

  -- 관리 정보
  admin_notes TEXT,

  -- 메타데이터
  created_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK 제약조건: expenses.recurring_template_id
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_recurring_template
FOREIGN KEY (recurring_template_id)
REFERENCES recurring_templates(id)
ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_recurring_templates_tenant_id ON recurring_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_is_active ON recurring_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_expense_category ON recurring_templates(expense_category);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_start_date ON recurring_templates(start_date);

-- 코멘트
COMMENT ON TABLE recurring_templates IS '고정 지출 템플릿';
COMMENT ON COLUMN recurring_templates.day_of_month IS '매월 발생일 (1-28)';

-- ============================================================================
-- 4. receivable_writeoffs 테이블 (미수금 포기 이력)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receivable_writeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- 정보
  case_name TEXT NOT NULL,
  client_name TEXT,
  original_amount NUMERIC NOT NULL DEFAULT 0,

  -- 사유
  reason TEXT,

  -- 메타데이터
  written_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  written_off_by UUID REFERENCES tenant_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_tenant_id ON receivable_writeoffs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_case_id ON receivable_writeoffs(case_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_written_off_at ON receivable_writeoffs(written_off_at DESC);

-- 코멘트
COMMENT ON TABLE receivable_writeoffs IS '미수금 포기 이력';

-- ============================================================================
-- 5. 트리거: updated_at 자동 업데이트
-- ============================================================================
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_templates_updated_at ON recurring_templates;
CREATE TRIGGER update_recurring_templates_updated_at
  BEFORE UPDATE ON recurring_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_payments_tenant_id ON payments;
CREATE TRIGGER set_payments_tenant_id
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_expenses_tenant_id ON expenses;
CREATE TRIGGER set_expenses_tenant_id
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_recurring_templates_tenant_id ON recurring_templates;
CREATE TRIGGER set_recurring_templates_tenant_id
  BEFORE INSERT ON recurring_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_receivable_writeoffs_tenant_id ON receivable_writeoffs;
CREATE TRIGGER set_receivable_writeoffs_tenant_id
  BEFORE INSERT ON receivable_writeoffs
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 6.5 트리거: expenses.month_key 자동 설정
-- ============================================================================
CREATE OR REPLACE FUNCTION set_expense_month_key()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month_key := TO_CHAR(NEW.expense_date, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_expenses_month_key ON expenses;
CREATE TRIGGER set_expenses_month_key
  BEFORE INSERT OR UPDATE OF expense_date ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_expense_month_key();

-- ============================================================================
-- 7. RLS 활성화 및 정책
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_writeoffs ENABLE ROW LEVEL SECURITY;

-- payments: 테넌트 격리
CREATE POLICY "tenant_isolation_payments" ON payments
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- expenses: 테넌트 격리 + admin 이상만 접근
CREATE POLICY "tenant_admin_expenses" ON expenses
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- recurring_templates: 테넌트 격리 + admin 이상만 접근
CREATE POLICY "tenant_admin_recurring_templates" ON recurring_templates
  FOR ALL TO authenticated
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- receivable_writeoffs: 테넌트 격리
CREATE POLICY "tenant_isolation_receivable_writeoffs" ON receivable_writeoffs
  FOR ALL TO authenticated
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- ============================================================================
-- 8. 통계 뷰
-- ============================================================================

-- 사건별 입금 합계
CREATE OR REPLACE VIEW case_payment_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.court_case_number,
  lc.case_name,
  COUNT(p.id) as payment_count,
  COALESCE(SUM(p.amount), 0) as total_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '착수금' THEN p.amount ELSE 0 END), 0) as retainer_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '잔금' THEN p.amount ELSE 0 END), 0) as balance_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '성공보수' THEN p.amount ELSE 0 END), 0) as success_fee_amount,
  MIN(p.payment_date) as first_payment_date,
  MAX(p.payment_date) as last_payment_date
FROM legal_cases lc
LEFT JOIN payments p ON lc.id = p.case_id
GROUP BY lc.id, lc.tenant_id, lc.court_case_number, lc.case_name;

COMMENT ON VIEW case_payment_summary IS '사건별 입금 합계 뷰';

-- ============================================================================
-- 완료
-- ============================================================================
