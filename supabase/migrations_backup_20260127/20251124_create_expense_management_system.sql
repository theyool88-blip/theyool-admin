-- ============================================================================
-- 법무법인 더율 - 지출 관리 시스템 데이터베이스
-- 생성일: 2025-11-24
-- 설명: 지출 관리, 고정 지출, 변호사별 인출, 월별 정산 시스템
-- ============================================================================

-- ============================================================================
-- 1. EXPENSES 테이블 (지출 내역)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  -- PK
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 지출 기본 정보
  expense_date DATE NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보
  expense_category TEXT NOT NULL,
  subcategory TEXT,
  office_location TEXT,

  -- 고정 지출 관련
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_template_id UUID,

  -- 상세 정보
  vendor_name TEXT,
  memo TEXT,
  receipt_url TEXT,
  payment_method TEXT,

  -- 관리 정보
  paid_by TEXT,
  created_by TEXT,
  admin_notes TEXT,

  -- 제약조건
  CONSTRAINT chk_expense_category CHECK (expense_category IN (
    '임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타'
  )),
  CONSTRAINT chk_office_location CHECK (
    office_location IN ('평택', '천안', '공통', '안쓰는 서비스') OR office_location IS NULL
  ),
  CONSTRAINT chk_payment_method CHECK (
    payment_method IN ('카드', '현금', '계좌이체', '자동이체', '기타') OR payment_method IS NULL
  )
);

-- 인덱스
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_expense_category ON expenses(expense_category);
CREATE INDEX idx_expenses_office_location ON expenses(office_location);
CREATE INDEX idx_expenses_is_recurring ON expenses(is_recurring);
CREATE INDEX idx_expenses_recurring_template_id ON expenses(recurring_template_id);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expenses_updated_at_trigger
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_expenses_updated_at();

-- ============================================================================
-- 2. RECURRING_TEMPLATES 테이블 (고정 지출 템플릿)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recurring_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 템플릿 정보
  name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 분류 정보
  expense_category TEXT NOT NULL,
  subcategory TEXT,
  office_location TEXT,

  -- 상세 정보
  vendor_name TEXT,
  payment_method TEXT,
  memo TEXT,

  -- 반복 설정
  is_active BOOLEAN DEFAULT TRUE,
  start_date DATE NOT NULL,
  end_date DATE,
  day_of_month INTEGER DEFAULT 1 CHECK (day_of_month >= 1 AND day_of_month <= 28),

  -- 관리 정보
  created_by TEXT,
  admin_notes TEXT,

  -- 제약조건
  CONSTRAINT chk_rt_expense_category CHECK (expense_category IN (
    '임대료', '인건비', '필수운영비', '마케팅비', '광고비', '세금', '식대', '구독료', '기타'
  )),
  CONSTRAINT chk_rt_office_location CHECK (
    office_location IN ('평택', '천안', '공통', '안쓰는 서비스') OR office_location IS NULL
  )
);

-- 인덱스
CREATE INDEX idx_recurring_templates_is_active ON recurring_templates(is_active);
CREATE INDEX idx_recurring_templates_expense_category ON recurring_templates(expense_category);
CREATE INDEX idx_recurring_templates_start_date ON recurring_templates(start_date);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_recurring_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_templates_updated_at_trigger
BEFORE UPDATE ON recurring_templates
FOR EACH ROW
EXECUTE FUNCTION update_recurring_templates_updated_at();

-- FK 제약조건 추가 (recurring_template_id)
ALTER TABLE expenses
ADD CONSTRAINT fk_expenses_recurring_template
FOREIGN KEY (recurring_template_id)
REFERENCES recurring_templates(id)
ON DELETE SET NULL;

-- ============================================================================
-- 3. PARTNER_WITHDRAWALS 테이블 (변호사 인출/지급)
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인출 기본 정보
  withdrawal_date DATE NOT NULL,
  partner_name TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),

  -- 인출 유형
  withdrawal_type TEXT NOT NULL,
  payment_method TEXT,
  office_location TEXT,

  -- 정산 정보
  month_key TEXT NOT NULL,
  settlement_id UUID,

  -- 상세 정보
  description TEXT,
  memo TEXT,
  admin_notes TEXT,

  -- 제약조건
  CONSTRAINT chk_partner_name CHECK (partner_name IN ('임은지', '김현성')),
  CONSTRAINT chk_withdrawal_type CHECK (withdrawal_type IN (
    '입금', '카드', '현금', '법인지출'
  )),
  CONSTRAINT chk_pw_office_location CHECK (
    office_location IN ('평택', '천안', '공통') OR office_location IS NULL
  )
);

-- 인덱스
CREATE INDEX idx_withdrawals_withdrawal_date ON partner_withdrawals(withdrawal_date DESC);
CREATE INDEX idx_withdrawals_partner_name ON partner_withdrawals(partner_name);
CREATE INDEX idx_withdrawals_month_key ON partner_withdrawals(month_key);
CREATE INDEX idx_withdrawals_settlement_id ON partner_withdrawals(settlement_id);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_partner_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partner_withdrawals_updated_at_trigger
BEFORE UPDATE ON partner_withdrawals
FOR EACH ROW
EXECUTE FUNCTION update_partner_withdrawals_updated_at();

-- ============================================================================
-- 4. MONTHLY_SETTLEMENTS 테이블 (월별 정산)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monthly_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 정산 기간
  settlement_month TEXT NOT NULL UNIQUE,

  -- 수입 (payments 테이블에서 집계)
  total_revenue BIGINT DEFAULT 0,
  pyeongtaek_revenue BIGINT DEFAULT 0,
  cheonan_revenue BIGINT DEFAULT 0,

  -- 지출 (expenses 테이블에서 집계)
  total_expenses BIGINT DEFAULT 0,
  pyeongtaek_expenses BIGINT DEFAULT 0,
  cheonan_expenses BIGINT DEFAULT 0,
  fixed_expenses BIGINT DEFAULT 0,
  marketing_expenses BIGINT DEFAULT 0,
  tax_expenses BIGINT DEFAULT 0,

  -- 변호사별 인출 (partner_withdrawals에서 집계)
  kim_withdrawals BIGINT DEFAULT 0,
  lim_withdrawals BIGINT DEFAULT 0,

  -- 순수익 (자동 계산) - PostgreSQL GENERATED ALWAYS AS는 BIGINT로 작동
  net_profit BIGINT GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  kim_share BIGINT GENERATED ALWAYS AS ((total_revenue - total_expenses) / 2) STORED,
  lim_share BIGINT GENERATED ALWAYS AS ((total_revenue - total_expenses) / 2) STORED,

  -- 실제 수령액 및 채권/채무
  kim_net_balance BIGINT GENERATED ALWAYS AS (((total_revenue - total_expenses) / 2) - kim_withdrawals) STORED,
  lim_net_balance BIGINT GENERATED ALWAYS AS (((total_revenue - total_expenses) / 2) - lim_withdrawals) STORED,

  -- 누적 채권/채무 (이전 달까지 누적 + 이번 달)
  kim_accumulated_debt BIGINT DEFAULT 0,
  lim_accumulated_debt BIGINT DEFAULT 0,

  -- 정산 상태
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  settled_by TEXT,

  -- 첨부 파일
  excel_file_url TEXT,

  -- 메모
  settlement_notes TEXT,
  admin_notes TEXT
);

-- 인덱스
CREATE INDEX idx_settlements_settlement_month ON monthly_settlements(settlement_month DESC);
CREATE INDEX idx_settlements_is_settled ON monthly_settlements(is_settled);
CREATE INDEX idx_settlements_created_at ON monthly_settlements(created_at DESC);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_monthly_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monthly_settlements_updated_at_trigger
BEFORE UPDATE ON monthly_settlements
FOR EACH ROW
EXECUTE FUNCTION update_monthly_settlements_updated_at();

-- FK 제약조건 추가 (partner_withdrawals.settlement_id)
ALTER TABLE partner_withdrawals
ADD CONSTRAINT fk_partner_withdrawals_settlement
FOREIGN KEY (settlement_id)
REFERENCES monthly_settlements(id)
ON DELETE SET NULL;

-- ============================================================================
-- 5. VIEWS (통계 뷰)
-- ============================================================================

-- 5.1 월별 수입 합계
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT
  DATE_TRUNC('month', payment_date)::DATE as month,
  COALESCE(office_location, '미지정') as office_location,
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount
FROM payments
GROUP BY DATE_TRUNC('month', payment_date), office_location, payment_category
ORDER BY month DESC, office_location, payment_category;

-- 5.2 월별 지출 합계
CREATE OR REPLACE VIEW monthly_expense_summary AS
SELECT
  DATE_TRUNC('month', expense_date)::DATE as month,
  COALESCE(office_location, '미지정') as office_location,
  expense_category,
  COUNT(*) as expense_count,
  SUM(amount) as total_amount,
  COUNT(CASE WHEN is_recurring = true THEN 1 END) as recurring_count,
  SUM(CASE WHEN is_recurring = true THEN amount ELSE 0 END) as recurring_total
FROM expenses
GROUP BY DATE_TRUNC('month', expense_date), office_location, expense_category
ORDER BY month DESC, office_location, expense_category;

-- 5.3 변호사별 현재 채권/채무
CREATE OR REPLACE VIEW partner_debt_status AS
SELECT
  '임은지' as partner_name,
  SUM(lim_accumulated_debt) as accumulated_debt,
  MAX(settlement_month) as last_settlement_month,
  COUNT(*) as total_settlements
FROM monthly_settlements
UNION ALL
SELECT
  '김현성' as partner_name,
  SUM(kim_accumulated_debt) as accumulated_debt,
  MAX(settlement_month) as last_settlement_month,
  COUNT(*) as total_settlements
FROM monthly_settlements;

-- 5.4 카테고리별 지출 통계
CREATE OR REPLACE VIEW expense_stats_by_category AS
SELECT
  expense_category,
  COALESCE(office_location, '미지정') as office_location,
  COUNT(*) as expense_count,
  SUM(amount) as total_amount,
  ROUND(AVG(amount)) as avg_amount,
  MIN(expense_date) as first_expense_date,
  MAX(expense_date) as last_expense_date,
  COUNT(CASE WHEN is_recurring = true THEN 1 END) as recurring_count
FROM expenses
GROUP BY expense_category, office_location
ORDER BY total_amount DESC;

-- 5.5 정산 대시보드 (최근 12개월)
CREATE OR REPLACE VIEW settlement_dashboard AS
SELECT
  settlement_month,
  total_revenue,
  total_expenses,
  net_profit,
  kim_withdrawals,
  lim_withdrawals,
  kim_net_balance,
  lim_net_balance,
  kim_accumulated_debt,
  lim_accumulated_debt,
  is_settled,
  settled_at
FROM monthly_settlements
ORDER BY settlement_month DESC
LIMIT 12;

-- ============================================================================
-- 6. RLS (Row Level Security) 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_settlements ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능 (기존 users_profiles 테이블 활용)
CREATE POLICY "관리자만 expenses 조회" ON expenses
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 expenses 삽입" ON expenses
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 expenses 수정" ON expenses
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 expenses 삭제" ON expenses
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

-- recurring_templates 정책
CREATE POLICY "관리자만 recurring_templates 조회" ON recurring_templates
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 recurring_templates 삽입" ON recurring_templates
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 recurring_templates 수정" ON recurring_templates
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 recurring_templates 삭제" ON recurring_templates
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

-- partner_withdrawals 정책
CREATE POLICY "관리자만 partner_withdrawals 조회" ON partner_withdrawals
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 partner_withdrawals 삽입" ON partner_withdrawals
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 partner_withdrawals 수정" ON partner_withdrawals
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 partner_withdrawals 삭제" ON partner_withdrawals
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

-- monthly_settlements 정책
CREATE POLICY "관리자만 monthly_settlements 조회" ON monthly_settlements
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 monthly_settlements 삽입" ON monthly_settlements
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 monthly_settlements 수정" ON monthly_settlements
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "관리자만 monthly_settlements 삭제" ON monthly_settlements
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_user_id FROM users_profiles WHERE role = 'admin'
    )
  );

-- ============================================================================
-- 완료
-- ============================================================================
COMMENT ON TABLE expenses IS '지출 내역 테이블';
COMMENT ON TABLE recurring_templates IS '고정 지출 템플릿 테이블';
COMMENT ON TABLE partner_withdrawals IS '변호사별 인출/지급 테이블';
COMMENT ON TABLE monthly_settlements IS '월별 정산 테이블';
