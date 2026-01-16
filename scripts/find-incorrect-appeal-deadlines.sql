-- 잘못 등록된 상소기간 데드라인 조회
-- 2026-01-14

-- 1. SCOURT 자동등록된 DL_APPEAL 전체 조회
-- notes에 "[SCOURT 자동등록]"이 포함된 상소기간만 조회
SELECT
  cd.id,
  cd.case_number,
  lc.case_name,
  cd.deadline_type,
  cd.trigger_date,
  cd.deadline_date,
  cd.notes,
  cd.created_at,
  -- 종국결과 확인 (NULL이면 판결 전 상태)
  sc.basic_info->>'종국결과' as final_result
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN scourt_cases sc ON lc.court_case_number = sc.case_number
WHERE cd.deadline_type = 'DL_APPEAL'
  AND cd.notes LIKE '%SCOURT 자동등록%'
ORDER BY cd.created_at DESC;

-- 2. 종국결과가 없는데 상소기간이 등록된 사건들 (의심 케이스)
SELECT
  cd.id,
  cd.case_number,
  lc.case_name,
  cd.deadline_type,
  cd.trigger_date,
  cd.deadline_date,
  cd.notes,
  cd.created_at
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN scourt_cases sc ON lc.court_case_number = sc.case_number
WHERE cd.deadline_type IN ('DL_APPEAL', 'DL_FAMILY_NONLIT', 'DL_CRIMINAL_APPEAL')
  AND cd.notes LIKE '%SCOURT 자동등록%'
  AND (sc.basic_info->>'종국결과' IS NULL OR sc.basic_info->>'종국결과' = '')
ORDER BY cd.created_at DESC;

-- 3. 특정 사건의 데드라인 조회 (서산가정2025드단50218)
SELECT
  cd.*
FROM case_deadlines cd
WHERE cd.case_number LIKE '%2025드단50218%';

-- 4. 삭제 쿼리 (실행 전 반드시 위 SELECT로 확인!)
-- DELETE FROM case_deadlines
-- WHERE id IN (
--   SELECT cd.id
--   FROM case_deadlines cd
--   LEFT JOIN legal_cases lc ON cd.case_id = lc.id
--   LEFT JOIN scourt_cases sc ON lc.court_case_number = sc.case_number
--   WHERE cd.deadline_type IN ('DL_APPEAL', 'DL_FAMILY_NONLIT', 'DL_CRIMINAL_APPEAL')
--     AND cd.notes LIKE '%SCOURT 자동등록%'
--     AND (sc.basic_info->>'종국결과' IS NULL OR sc.basic_info->>'종국결과' = '')
-- );
