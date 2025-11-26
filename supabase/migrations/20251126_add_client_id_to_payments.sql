-- =====================================================
-- payments 테이블에 client_id 컬럼 추가
-- 입금 → 의뢰인 직접 연결을 위한 구조 개선
-- =====================================================

-- 1. client_id 컬럼 추가
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 2. 인덱스 추가 (의뢰인별 입금 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);

-- 3. 기존 데이터 마이그레이션: case_id가 있는 입금에 client_id 자동 설정
UPDATE payments p
SET client_id = lc.client_id
FROM legal_cases lc
WHERE p.case_id = lc.id
  AND p.client_id IS NULL
  AND lc.client_id IS NOT NULL;

-- 4. 확인용 코멘트
COMMENT ON COLUMN payments.client_id IS '의뢰인 직접 연결 (사건 삭제 시에도 연결 유지)';

-- =====================================================
-- 결과 확인 쿼리 (실행 후 확인용)
-- =====================================================
-- SELECT
--   COUNT(*) as total_payments,
--   COUNT(client_id) as with_client_id,
--   COUNT(case_id) as with_case_id
-- FROM payments;
