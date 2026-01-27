-- Migration: Add UNIQUE constraints to prevent duplicate legal_cases
-- Created: 2026-01-27
-- Purpose: 같은 테넌트에서 동일한 사건번호+법원 조합의 중복 등록 방지

-- ============================================================
-- PRE-MIGRATION CHECK (Run this query BEFORE applying migration)
-- ============================================================
-- 중복 데이터가 있으면 마이그레이션이 실패합니다.
-- 아래 쿼리로 먼저 확인하고, 중복이 있으면 수동으로 정리하세요.
--
-- SELECT tenant_id, court_case_number, court_name, COUNT(*), array_agg(id)
-- FROM legal_cases
-- WHERE court_case_number IS NOT NULL
-- GROUP BY tenant_id, court_case_number, court_name
-- HAVING COUNT(*) > 1;
-- ============================================================

-- 사건번호와 법원명이 모두 있는 경우 중복 방지
-- PostgreSQL에서 NULL은 서로 다른 값으로 취급되므로 별도 인덱스 필요
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_with_court
ON legal_cases (tenant_id, court_case_number, court_name)
WHERE court_case_number IS NOT NULL AND court_name IS NOT NULL;

-- 사건번호만 있고 법원명이 NULL인 경우 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_unique_no_court
ON legal_cases (tenant_id, court_case_number)
WHERE court_case_number IS NOT NULL AND court_name IS NULL;

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
-- 인덱스 생성 확인:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'legal_cases'
-- AND indexname LIKE 'idx_legal_cases_unique%';
-- ============================================================
