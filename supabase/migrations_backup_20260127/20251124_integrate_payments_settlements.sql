-- ============================================================
-- 입금 관리 시스템 통합 개선 마이그레이션
-- 날짜: 2025-11-24
-- 목적: 입금-지출 통합 정산 시스템 구축
-- ============================================================

-- 1. payments 테이블에 필요한 컬럼 추가
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS month_key VARCHAR(7),
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT;

-- 2. 기존 데이터에 month_key 자동 생성
-- ============================================================

UPDATE payments
SET month_key = TO_CHAR(payment_date, 'YYYY-MM')
WHERE month_key IS NULL;

-- 3. month_key 자동 생성 트리거 함수 생성
-- ============================================================

CREATE OR REPLACE FUNCTION update_payments_month_key()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month_key := TO_CHAR(NEW.payment_date, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성 (INSERT/UPDATE 시 자동 실행)
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_payments_month_key ON payments;

CREATE TRIGGER trigger_update_payments_month_key
  BEFORE INSERT OR UPDATE OF payment_date ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_month_key();

-- 5. 인덱스 추가 (성능 최적화)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_payments_month_key ON payments(month_key);
CREATE INDEX IF NOT EXISTS idx_payments_is_confirmed ON payments(is_confirmed);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_office_location ON payments(office_location);
CREATE INDEX IF NOT EXISTS idx_payments_payment_category ON payments(payment_category);

-- 6. 월별 수익 집계 뷰 생성
-- ============================================================

CREATE OR REPLACE VIEW monthly_revenue_aggregation AS
SELECT
  TO_CHAR(payment_date, 'YYYY-MM') as month_key,

  -- 총 수익
  SUM(amount) as total_revenue,
  COUNT(*) as payment_count,
  AVG(amount) as avg_payment,

  -- 사무소별
  SUM(CASE WHEN office_location = '평택' THEN amount ELSE 0 END) as pyeongtaek_revenue,
  COUNT(CASE WHEN office_location = '평택' THEN 1 END) as pyeongtaek_count,
  SUM(CASE WHEN office_location = '천안' THEN amount ELSE 0 END) as cheonan_revenue,
  COUNT(CASE WHEN office_location = '천안' THEN 1 END) as cheonan_count,

  -- 확인 상태별
  SUM(CASE WHEN is_confirmed = true THEN amount ELSE 0 END) as confirmed_revenue,
  COUNT(CASE WHEN is_confirmed = true THEN 1 END) as confirmed_count,
  SUM(CASE WHEN is_confirmed = false THEN amount ELSE 0 END) as pending_revenue,
  COUNT(CASE WHEN is_confirmed = false THEN 1 END) as pending_count,

  -- 카테고리별 (주요 항목만)
  SUM(CASE WHEN payment_category = '착수금' THEN amount ELSE 0 END) as retainer_revenue,
  COUNT(CASE WHEN payment_category = '착수금' THEN 1 END) as retainer_count,
  SUM(CASE WHEN payment_category = '잔금' THEN amount ELSE 0 END) as balance_revenue,
  COUNT(CASE WHEN payment_category = '잔금' THEN 1 END) as balance_count,
  SUM(CASE WHEN payment_category = '성공보수' THEN amount ELSE 0 END) as success_fee_revenue,
  COUNT(CASE WHEN payment_category = '성공보수' THEN 1 END) as success_fee_count,
  SUM(CASE WHEN payment_category = '모든 상담' THEN amount ELSE 0 END) as consultation_revenue,
  COUNT(CASE WHEN payment_category = '모든 상담' THEN 1 END) as consultation_count

FROM payments
GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
ORDER BY month_key DESC;

-- 7. 수익 카테고리별 통계 뷰 (기존 payment_stats_by_category 개선)
-- ============================================================

CREATE OR REPLACE VIEW payment_revenue_by_category AS
SELECT
  payment_category,

  -- 전체 통계
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount,

  -- 확인 통계
  COUNT(CASE WHEN is_confirmed = true THEN 1 END) as confirmed_count,
  SUM(CASE WHEN is_confirmed = true THEN amount ELSE 0 END) as confirmed_amount,
  COUNT(CASE WHEN is_confirmed = false THEN 1 END) as pending_count,
  SUM(CASE WHEN is_confirmed = false THEN amount ELSE 0 END) as pending_amount,

  -- 사무소별
  COUNT(CASE WHEN office_location = '평택' THEN 1 END) as pyeongtaek_count,
  SUM(CASE WHEN office_location = '평택' THEN amount ELSE 0 END) as pyeongtaek_total,
  COUNT(CASE WHEN office_location = '천안' THEN 1 END) as cheonan_count,
  SUM(CASE WHEN office_location = '천안' THEN amount ELSE 0 END) as cheonan_total,

  -- 기간
  MIN(payment_date) as first_payment,
  MAX(payment_date) as last_payment

FROM payments
GROUP BY payment_category
ORDER BY total_amount DESC;

-- 8. 전환율 분석 뷰 생성
-- ============================================================

CREATE OR REPLACE VIEW payment_conversion_funnel AS
SELECT
  TO_CHAR(payment_date, 'YYYY-MM') as month,

  -- 상담
  COUNT(DISTINCT CASE WHEN payment_category = '모든 상담' THEN consultation_id END) as consultation_count,
  SUM(CASE WHEN payment_category = '모든 상담' THEN amount ELSE 0 END) as consultation_revenue,
  AVG(CASE WHEN payment_category = '모든 상담' THEN amount END) as avg_consultation_fee,

  -- 사건 (착수금 기준)
  COUNT(DISTINCT CASE WHEN payment_category = '착수금' THEN case_id END) as case_count,
  SUM(CASE WHEN payment_category IN ('착수금', '잔금', '성공보수') THEN amount ELSE 0 END) as case_revenue,
  AVG(CASE WHEN payment_category = '착수금' THEN amount END) as avg_retainer,

  -- 전환율 (상담 → 사건)
  CASE
    WHEN COUNT(DISTINCT CASE WHEN payment_category = '모든 상담' THEN consultation_id END) > 0
    THEN ROUND(
      (COUNT(DISTINCT CASE WHEN payment_category = '착수금' THEN case_id END)::NUMERIC /
       COUNT(DISTINCT CASE WHEN payment_category = '모든 상담' THEN consultation_id END)::NUMERIC) * 100,
      2
    )
    ELSE 0
  END as conversion_rate

FROM payments
GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
ORDER BY month DESC;

-- 9. 수익성 분석 뷰 (사무소별)
-- ============================================================

CREATE OR REPLACE VIEW office_profitability AS
SELECT
  office_location,
  TO_CHAR(payment_date, 'YYYY-MM') as month_key,

  -- 수익
  SUM(amount) as total_revenue,
  COUNT(*) as payment_count,
  AVG(amount) as avg_payment,

  -- 확인 비율
  COUNT(CASE WHEN is_confirmed = true THEN 1 END) as confirmed_count,
  ROUND(
    (COUNT(CASE WHEN is_confirmed = true THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) as confirmation_rate

FROM payments
WHERE office_location IS NOT NULL
GROUP BY office_location, TO_CHAR(payment_date, 'YYYY-MM')
ORDER BY month_key DESC, office_location;

-- 10. 코멘트 추가 (문서화)
-- ============================================================

COMMENT ON COLUMN payments.month_key IS '월 키 (YYYY-MM 형식), 정산 시스템 연동용';
COMMENT ON COLUMN payments.is_confirmed IS '입금 확인 여부 (false: 미확인, true: 확인 완료)';
COMMENT ON COLUMN payments.confirmed_at IS '입금 확인 일시';
COMMENT ON COLUMN payments.confirmed_by IS '입금 확인자 (관리자 이메일 또는 이름)';

COMMENT ON VIEW monthly_revenue_aggregation IS '월별 수익 집계 뷰 (사무소별, 카테고리별, 확인 상태별)';
COMMENT ON VIEW payment_revenue_by_category IS '카테고리별 수익 통계 뷰 (확인 상태 및 사무소별 분석 포함)';
COMMENT ON VIEW payment_conversion_funnel IS '전환율 분석 뷰 (상담 → 사건 전환 추적)';
COMMENT ON VIEW office_profitability IS '사무소별 수익성 분석 뷰 (월별 추세 포함)';

-- ============================================================
-- 마이그레이션 완료
-- ============================================================
