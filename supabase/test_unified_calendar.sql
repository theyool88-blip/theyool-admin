-- unified_calendar VIEW 검증 및 테스트 쿼리
-- Supabase SQL 에디터에서 실행

-- 1. VIEW 존재 확인
SELECT EXISTS (
  SELECT FROM pg_views
  WHERE viewname = 'unified_calendar'
) AS view_exists;

-- 2. 전체 이벤트 수 확인
SELECT
  event_type,
  event_type_kr,
  COUNT(*) as count
FROM unified_calendar
GROUP BY event_type, event_type_kr
ORDER BY event_type;

-- 3. 최근 20개 이벤트 조회 (날짜 내림차순)
SELECT
  event_type,
  event_type_kr,
  event_subtype,
  title,
  event_date,
  event_time,
  location,
  status
FROM unified_calendar
ORDER BY event_date DESC, event_time DESC, sort_priority ASC
LIMIT 20;

-- 4. 이벤트 타입별 상세 조회

-- 4-1. 법원기일만 조회
SELECT
  event_subtype,
  title,
  event_date,
  event_time,
  location,
  reference_id as case_number
FROM unified_calendar
WHERE event_type = 'COURT_HEARING'
ORDER BY event_date DESC
LIMIT 5;

-- 4-2. 상담만 조회
SELECT
  event_subtype,
  title,
  event_date,
  event_time,
  location as office_location,
  reference_id as phone,
  description as message
FROM unified_calendar
WHERE event_type = 'CONSULTATION'
ORDER BY event_date DESC
LIMIT 5;

-- 4-3. 데드라인만 조회
SELECT
  event_subtype,
  title,
  event_date,
  reference_id as case_number,
  description as notes
FROM unified_calendar
WHERE event_type = 'DEADLINE'
ORDER BY event_date DESC
LIMIT 5;

-- 4-4. 일반일정만 조회
SELECT
  event_subtype,
  title,
  event_date,
  event_time,
  location,
  description
FROM unified_calendar
WHERE event_type = 'GENERAL_SCHEDULE'
ORDER BY event_date DESC
LIMIT 5;

-- 5. 특정 날짜 범위의 모든 이벤트 조회 (예: 이번 달)
SELECT
  event_type_kr,
  event_subtype,
  title,
  event_date,
  event_time,
  location,
  status
FROM unified_calendar
WHERE event_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND event_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY event_date ASC, event_time ASC, sort_priority ASC;

-- 6. 상태별 이벤트 수 확인
SELECT
  event_type_kr,
  status,
  COUNT(*) as count
FROM unified_calendar
GROUP BY event_type_kr, status
ORDER BY event_type_kr, status;

-- 7. enum 값이 제대로 TEXT로 변환되었는지 확인
SELECT DISTINCT
  event_type,
  event_subtype,
  CASE
    WHEN event_type = 'COURT_HEARING' THEN
      CASE event_subtype
        WHEN 'HEARING_MAIN' THEN '변론기일'
        WHEN 'HEARING_INTERIM' THEN '사전·보전처분 심문기일'
        WHEN 'HEARING_MEDIATION' THEN '조정기일'
        WHEN 'HEARING_INVESTIGATION' THEN '조사기일'
        WHEN 'HEARING_PARENTING' THEN '상담·교육·프로그램 기일'
        WHEN 'HEARING_JUDGMENT' THEN '선고기일'
        WHEN 'HEARING_LAWYER_MEETING' THEN '변호사미팅'
      END
    WHEN event_type = 'DEADLINE' THEN
      CASE event_subtype
        WHEN 'DL_APPEAL' THEN '상소기간'
        WHEN 'DL_MEDIATION_OBJ' THEN '조정·화해 이의기간'
        WHEN 'DL_IMM_APPEAL' THEN '즉시항고기간'
        WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서 제출기한'
        WHEN 'DL_RETRIAL' THEN '재심의 소 제기기한'
      END
  END as expected_kr_type,
  COUNT(*) as count
FROM unified_calendar
WHERE event_type IN ('COURT_HEARING', 'DEADLINE')
GROUP BY event_type, event_subtype
ORDER BY event_type, event_subtype;

-- 8. consultations 테이블의 데이터가 제대로 포함되었는지 확인
-- (preferred_date가 있는 상담만 표시되어야 함)
SELECT
  'FROM consultations table' as source,
  COUNT(*) FILTER (WHERE preferred_date IS NOT NULL) as with_date,
  COUNT(*) FILTER (WHERE preferred_date IS NULL) as without_date,
  COUNT(*) as total
FROM consultations
UNION ALL
SELECT
  'FROM unified_calendar view' as source,
  COUNT(*) as with_date,
  0 as without_date,
  COUNT(*) as total
FROM unified_calendar
WHERE event_type = 'CONSULTATION';

-- 9. 데이터 타입 확인 (::text 캐스팅이 제대로 동작하는지)
SELECT
  event_type,
  pg_typeof(event_subtype) as subtype_data_type,
  pg_typeof(title) as title_data_type,
  pg_typeof(event_date) as date_data_type,
  pg_typeof(event_time) as time_data_type
FROM unified_calendar
LIMIT 1;

-- 10. 향후 이벤트만 조회 (오늘 이후)
SELECT
  event_type_kr,
  title,
  event_date,
  event_time,
  location,
  status
FROM unified_calendar
WHERE event_date >= CURRENT_DATE
ORDER BY event_date ASC, event_time ASC, sort_priority ASC
LIMIT 20;
