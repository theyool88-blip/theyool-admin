-- ============================================================
-- 의뢰인별 메모 시스템으로 변경
-- ============================================================

-- 1. receivable_memos 테이블에 client_id 추가
ALTER TABLE receivable_memos
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 2. case_id를 nullable로 변경 (기존 데이터 호환)
ALTER TABLE receivable_memos
ALTER COLUMN case_id DROP NOT NULL;

-- 3. client_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_receivable_memos_client_id ON receivable_memos(client_id);

-- 4. 기존 case_id 기반 메모들의 client_id 채우기 (있는 경우)
UPDATE receivable_memos rm
SET client_id = lc.client_id
FROM legal_cases lc
WHERE rm.case_id = lc.id
AND rm.client_id IS NULL;
