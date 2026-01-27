-- 입금 관리 시스템
-- 작성일: 2025-11-24
-- 목적: 사건별/상담별 입금 내역 관리 및 통계

-- =====================================================
-- 0. 기존 테이블 및 뷰 삭제 (클린 재생성)
-- =====================================================

DROP VIEW IF EXISTS consultation_payment_summary;
DROP VIEW IF EXISTS case_payment_summary;
DROP VIEW IF EXISTS payment_stats_by_month;
DROP VIEW IF EXISTS payment_stats_by_category;
DROP VIEW IF EXISTS payment_stats_by_office;
DROP TABLE IF EXISTS payments CASCADE;

-- =====================================================
-- 1. payments 테이블 생성
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 입금 기본 정보
  payment_date DATE NOT NULL,                    -- 입금일
  depositor_name TEXT NOT NULL,                  -- 입금인
  amount INTEGER NOT NULL,                       -- 입금액 (원 단위 정수)

  -- 분류 정보
  office_location TEXT,                          -- 사무실 (평택/천안)
  payment_category TEXT NOT NULL,                -- 명목 (착수금/잔금/성공보수/모든 상담 등)

  -- 사건 연결 (optional - 사건 입금인 경우만)
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  case_name TEXT,                                -- 사건명 (백업용, Notion URL 포함 가능)

  -- 상담 연결 (optional - 상담 입금인 경우만)
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,

  -- 영수증/세금 정보
  receipt_type TEXT,                             -- 세금영수증 유형 (현금영수증/카드결제/세금계산서 등)
  receipt_issued_at TIMESTAMPTZ,                 -- 영수증 발행일시

  -- 연락처 및 메모
  phone TEXT,                                    -- 전화번호
  memo TEXT,                                     -- 메모

  -- 관리용
  admin_notes TEXT,                              -- 관리자 메모
  imported_from_csv BOOLEAN DEFAULT FALSE,       -- CSV에서 임포트된 데이터 여부

  -- 제약조건
  CONSTRAINT chk_payment_category CHECK (payment_category IN (
    '착수금', '잔금', '성공보수', '모든 상담', '내용증명', '집행(소송비용)', '기타'
  )),
  CONSTRAINT chk_office_location CHECK (
    office_location IN ('평택', '천안') OR office_location IS NULL
  ),
  CONSTRAINT chk_either_case_or_consultation CHECK (
    (case_id IS NOT NULL AND consultation_id IS NULL) OR
    (case_id IS NULL AND consultation_id IS NOT NULL) OR
    (case_id IS NULL AND consultation_id IS NULL)
  )
);

-- =====================================================
-- 2. 인덱스 생성
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_consultation_id ON payments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_payments_office_location ON payments(office_location);
CREATE INDEX IF NOT EXISTS idx_payments_payment_category ON payments(payment_category);
CREATE INDEX IF NOT EXISTS idx_payments_depositor_name ON payments(depositor_name);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- =====================================================
-- 3. Updated_at 트리거
-- =====================================================

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. RLS (Row Level Security) 정책
-- =====================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 권한
DROP POLICY IF EXISTS "Service role has full access to payments" ON payments;
CREATE POLICY "Service role has full access to payments"
  ON payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated 사용자는 읽기/쓰기 가능 (관리자 전용)
DROP POLICY IF EXISTS "Authenticated users can manage payments" ON payments;
CREATE POLICY "Authenticated users can manage payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. 통계 뷰 - 사무실별 집계
-- =====================================================

CREATE OR REPLACE VIEW payment_stats_by_office AS
SELECT
  COALESCE(office_location, '미지정') as office_location,
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  ROUND(AVG(amount)) as avg_amount,
  MIN(payment_date) as first_payment,
  MAX(payment_date) as last_payment
FROM payments
GROUP BY office_location, payment_category
ORDER BY office_location, payment_category;

-- =====================================================
-- 6. 통계 뷰 - 명목별 집계
-- =====================================================

CREATE OR REPLACE VIEW payment_stats_by_category AS
SELECT
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount,
  ROUND(AVG(amount)) as avg_amount,
  COUNT(CASE WHEN office_location = '평택' THEN 1 END) as pyeongtaek_count,
  COUNT(CASE WHEN office_location = '천안' THEN 1 END) as cheonan_count,
  SUM(CASE WHEN office_location = '평택' THEN amount ELSE 0 END) as pyeongtaek_total,
  SUM(CASE WHEN office_location = '천안' THEN amount ELSE 0 END) as cheonan_total
FROM payments
GROUP BY payment_category
ORDER BY total_amount DESC;

-- =====================================================
-- 7. 통계 뷰 - 월별 집계
-- =====================================================

CREATE OR REPLACE VIEW payment_stats_by_month AS
SELECT
  DATE_TRUNC('month', payment_date)::DATE as month,
  COALESCE(office_location, '미지정') as office_location,
  payment_category,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount
FROM payments
GROUP BY DATE_TRUNC('month', payment_date), office_location, payment_category
ORDER BY month DESC, office_location, payment_category;

-- =====================================================
-- 8. 사건별 입금 합계 뷰
-- =====================================================

CREATE OR REPLACE VIEW case_payment_summary AS
SELECT
  lc.id as case_id,
  lc.court_case_number,
  lc.case_name,
  COUNT(p.id) as payment_count,
  SUM(p.amount) as total_amount,
  SUM(CASE WHEN p.payment_category = '착수금' THEN p.amount ELSE 0 END) as retainer_amount,
  SUM(CASE WHEN p.payment_category = '잔금' THEN p.amount ELSE 0 END) as balance_amount,
  SUM(CASE WHEN p.payment_category = '성공보수' THEN p.amount ELSE 0 END) as success_fee_amount,
  MIN(p.payment_date) as first_payment_date,
  MAX(p.payment_date) as last_payment_date
FROM legal_cases lc
LEFT JOIN payments p ON lc.id = p.case_id
GROUP BY lc.id, lc.court_case_number, lc.case_name;

-- =====================================================
-- 9. 상담별 입금 합계 뷰
-- =====================================================

CREATE OR REPLACE VIEW consultation_payment_summary AS
SELECT
  c.id as consultation_id,
  c.name,
  c.phone,
  c.request_type,
  COUNT(p.id) as payment_count,
  SUM(p.amount) as total_amount,
  MIN(p.payment_date) as first_payment_date,
  MAX(p.payment_date) as last_payment_date
FROM consultations c
LEFT JOIN payments p ON c.id = p.consultation_id
GROUP BY c.id, c.name, c.phone, c.request_type;

-- =====================================================
-- 10. 코멘트 추가
-- =====================================================

COMMENT ON TABLE payments IS '입금 관리 테이블: 사건별/상담별 입금 내역 추적';
COMMENT ON COLUMN payments.payment_date IS '입금일 (YYYY-MM-DD)';
COMMENT ON COLUMN payments.depositor_name IS '입금자 이름';
COMMENT ON COLUMN payments.amount IS '입금액 (원 단위 정수)';
COMMENT ON COLUMN payments.office_location IS '사무실 위치 (평택/천안)';
COMMENT ON COLUMN payments.payment_category IS '입금 명목 (착수금/잔금/성공보수/모든 상담/내용증명/집행/기타)';
COMMENT ON COLUMN payments.case_id IS '연결된 사건 ID (legal_cases FK)';
COMMENT ON COLUMN payments.case_name IS '사건명 백업 (Notion URL 포함 가능)';
COMMENT ON COLUMN payments.consultation_id IS '연결된 상담 ID (consultations FK)';
COMMENT ON COLUMN payments.receipt_type IS '영수증 유형 (현금영수증/카드결제/세금계산서/현금/네이버페이 등)';
COMMENT ON COLUMN payments.receipt_issued_at IS '영수증 발행일시';
COMMENT ON COLUMN payments.phone IS '연락처';
COMMENT ON COLUMN payments.memo IS '메모 (CSV 임포트 시 원본 메모)';
COMMENT ON COLUMN payments.admin_notes IS '관리자 메모';
COMMENT ON COLUMN payments.imported_from_csv IS 'CSV 임포트 여부 플래그';
