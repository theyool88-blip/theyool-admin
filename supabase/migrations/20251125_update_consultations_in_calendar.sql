-- unified_calendar VIEW 수정: 상담의 confirmed_date/preferred_date 구분
--
-- 변경사항:
-- 1. confirmed 상태 상담: confirmed_date/confirmed_time 사용
-- 2. pending/contacted 상태 상담: preferred_date/preferred_time 사용
-- 3. event_subtype에 상태 prefix 추가 (pending_visit, confirmed_visit 등)

DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING' AS event_type,
  '법원기일' AS event_type_kr,
  ch.hearing_type::text AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type
      WHEN 'HEARING_MAIN' THEN '변론기일'
      WHEN 'HEARING_INTERIM' THEN '사전·보전처분 심문기일'
      WHEN 'HEARING_MEDIATION' THEN '조정기일'
      WHEN 'HEARING_INVESTIGATION' THEN '조사기일'
      WHEN 'HEARING_PARENTING' THEN '상담·교육·프로그램 기일'
      WHEN 'HEARING_JUDGMENT' THEN '선고기일'
      WHEN 'HEARING_LAWYER_MEETING' THEN '변호사미팅'
      ELSE ch.hearing_type::text
    END,
    ') ', lc.case_name
  ) AS title,
  lc.case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS event_time,
  ch.hearing_date AS event_datetime,
  ch.case_number AS reference_id,
  ch.location,
  ch.notes AS description,
  ch.status::text,
  1 AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id

UNION ALL

-- 2. 사건 데드라인 (DEADLINE)
SELECT
  cd.id,
  'DEADLINE' AS event_type,
  '데드라인' AS event_type_kr,
  cd.deadline_type::text AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type
      WHEN 'DL_APPEAL' THEN '상소기간'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정·화해 이의기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고기간'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서 제출기한'
      WHEN 'DL_RETRIAL' THEN '재심의 소 제기기한'
      ELSE cd.deadline_type::text
    END,
    ') ', lc.case_name
  ) AS title,
  lc.case_name,
  cd.deadline_date AS event_date,
  '00:00' AS event_time,
  (cd.deadline_date || ' 00:00:00')::timestamp AS event_datetime,
  cd.case_number AS reference_id,
  NULL AS location,
  cd.notes AS description,
  cd.status::text,
  2 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id

UNION ALL

-- 3. 상담 (CONSULTATION) - confirmed/pending 구분
-- confirmed 상태: confirmed_date/confirmed_time 사용
-- pending/contacted 상태: preferred_date/preferred_time 사용
SELECT
  c.id,
  'CONSULTATION' AS event_type,
  '상담' AS event_type_kr,
  -- event_subtype: 상태와 유형 조합 (예: confirmed_visit, pending_callback)
  CASE
    WHEN c.status IN ('confirmed', 'in_progress', 'completed') THEN
      'confirmed_' || c.request_type
    ELSE
      'pending_' || c.request_type
  END AS event_subtype,
  CONCAT(
    '(',
    CASE
      WHEN c.status IN ('confirmed', 'in_progress', 'completed') THEN '확정-'
      ELSE '미확정-'
    END,
    CASE c.request_type
      WHEN 'callback' THEN '콜백'
      WHEN 'visit' THEN '방문'
      WHEN 'video' THEN '화상'
      WHEN 'info' THEN '문의'
      ELSE '상담'
    END,
    ') ', c.name
  ) AS title,
  c.name AS case_name,
  -- event_date: confirmed 상태면 confirmed_date, 아니면 preferred_date
  CASE
    WHEN c.status IN ('confirmed', 'in_progress', 'completed') THEN
      c.confirmed_date
    ELSE
      c.preferred_date
  END AS event_date,
  -- event_time: confirmed 상태면 confirmed_time, 아니면 preferred_time
  COALESCE(
    CASE
      WHEN c.status IN ('confirmed', 'in_progress', 'completed') THEN
        c.confirmed_time
      ELSE
        c.preferred_time
    END,
    '00:00'
  ) AS event_time,
  -- event_datetime
  CASE
    WHEN c.status IN ('confirmed', 'in_progress', 'completed') AND c.confirmed_date IS NOT NULL THEN
      (c.confirmed_date || ' ' || COALESCE(c.confirmed_time, '00:00') || ':00')::timestamp
    WHEN c.preferred_date IS NOT NULL THEN
      (c.preferred_date || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::timestamp
    ELSE NULL
  END AS event_datetime,
  c.phone AS reference_id,
  c.office_location AS location,
  c.message AS description,
  c.status::text,
  3 AS sort_priority
FROM consultations c
WHERE
  (c.status IN ('confirmed', 'in_progress', 'completed') AND c.confirmed_date IS NOT NULL)
  OR c.preferred_date IS NOT NULL

UNION ALL

-- 4. 일반 일정 (GENERAL_SCHEDULE)
SELECT
  gs.id,
  'GENERAL_SCHEDULE' AS event_type,
  '일반일정' AS event_type_kr,
  gs.schedule_type AS event_subtype,
  CONCAT('(',
    CASE gs.schedule_type
      WHEN 'meeting' THEN '회의'
      WHEN 'appointment' THEN '약속'
      WHEN 'task' THEN '업무'
      WHEN 'other' THEN '기타'
      ELSE gs.schedule_type
    END,
    ') ', gs.title
  ) AS title,
  gs.title AS case_name,
  gs.schedule_date AS event_date,
  COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00') AS event_time,
  (gs.schedule_date || ' ' || COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00') || ':00')::timestamp AS event_datetime,
  NULL AS reference_id,
  gs.location,
  gs.description,
  gs.status::text,
  4 AS sort_priority
FROM general_schedules gs;

COMMENT ON VIEW unified_calendar IS '통합 캘린더 VIEW: 법원기일, 데드라인, 상담예약(confirmed/pending 구분), 일반일정을 통합';
