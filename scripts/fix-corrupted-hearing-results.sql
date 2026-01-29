-- ============================================================================
-- Script: Fix corrupted court_hearings result values
-- Date: 2026-01-28
-- Description: Reset result=NULL for records where scourt_raw_data.result
--              is not a postponement keyword but result='adjourned'
-- ============================================================================

-- Step 1: 손상된 레코드 확인
SELECT
  id,
  case_number,
  hearing_type,
  result,
  scourt_raw_data->>'result' as scourt_result
FROM court_hearings
WHERE result = 'adjourned'
  AND scourt_raw_data->>'result' IS NOT NULL
  AND scourt_raw_data->>'result' NOT IN ('기일변경', '연기', '휴정');

-- Step 2: 손상된 레코드 수정 (result를 NULL로 리셋)
UPDATE court_hearings
SET result = NULL
WHERE result = 'adjourned'
  AND scourt_raw_data->>'result' IS NOT NULL
  AND scourt_raw_data->>'result' NOT IN ('기일변경', '연기', '휴정');

-- Step 3: 수정 결과 확인 (쌍방조사 레코드)
SELECT
  id,
  case_number,
  result,
  scourt_raw_data->>'result' as scourt_result
FROM court_hearings
WHERE scourt_raw_data->>'result' = '쌍방조사';
-- 예상 결과: result가 NULL이어야 함
