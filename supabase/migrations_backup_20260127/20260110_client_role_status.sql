-- 의뢰인 역할 상태 관리
-- 2026-01-10
--
-- 사건 등록 시 성씨 비교 없이 기본 "원고측"으로 임시 지정하고,
-- 알림탭에서 사후 확인/변경하도록 변경

-- ============================================================
-- 1. legal_cases: client_role_status 컬럼 추가
-- ============================================================

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS client_role_status VARCHAR(20) DEFAULT 'provisional'
CHECK (client_role_status IN ('provisional', 'confirmed'));

COMMENT ON COLUMN legal_cases.client_role_status IS '의뢰인 역할 상태: provisional(임시지정), confirmed(확정)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_client_role_status
  ON legal_cases(client_role_status);

-- ============================================================
-- 2. 기존 데이터 마이그레이션
-- ============================================================

-- client_role이 이미 설정된 경우: confirmed로 설정 (기존에 명시적으로 선택된 것)
UPDATE legal_cases
SET client_role_status = 'confirmed'
WHERE client_role IS NOT NULL
  AND client_role_status IS NULL;

-- client_role이 NULL인 경우: plaintiff로 설정하고 provisional 유지
UPDATE legal_cases
SET
  client_role = 'plaintiff',
  client_role_status = 'provisional'
WHERE client_role IS NULL;
