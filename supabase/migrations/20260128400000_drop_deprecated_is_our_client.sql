-- ============================================================================
-- Migration: Drop deprecated is_our_client column from case_parties
-- Date: 2026-01-28
-- Description: Clean up schema by removing deprecated column that was replaced
--              by case_clients table and is_primary column
-- ============================================================================

-- 1. Drop the index first (if exists)
DROP INDEX IF EXISTS idx_case_parties_is_our_client;

-- 2. Drop the deprecated column
-- Note: This column was deprecated in favor of:
--   - case_clients table (for client-case M:N relationships)
--   - is_primary column (for identifying main party on each side)
ALTER TABLE case_parties DROP COLUMN IF EXISTS is_our_client;

-- Add comment documenting the deprecation
COMMENT ON TABLE case_parties IS '사건별 당사자 정보. 의뢰인 연결은 case_clients 테이블을 사용.';

-- ============================================================================
-- Change Summary:
-- 1. Removed idx_case_parties_is_our_client index
-- 2. Removed is_our_client BOOLEAN column
-- 3. Client relationships now managed via case_clients table
-- ============================================================================
