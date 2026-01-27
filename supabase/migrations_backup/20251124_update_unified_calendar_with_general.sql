-- unified_calendar VIEW를 general_schedules 포함하도록 업데이트

DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING' AS event_type,
  '법원기일' AS event_type_kr,
  ch.hearing_type AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type
      WHEN 'FIRST_HEARING' THEN '변론기일'
      WHEN 'SENTENCING' THEN '선고기일'
      WHEN 'MEDIATION' THEN '조정기일'
      WHEN 'PREPARATION' THEN '준비기일'
      WHEN 'EVIDENCE' THEN '증거조사'
      WHEN 'WITNESS' THEN '증인신문'
      WHEN 'OTHER' THEN '기타'
      ELSE ch.hearing_type
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
  ch.status,
  1 AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id

UNION ALL

-- 2. 사건 데드라인 (DEADLINE)
SELECT
  cd.id,
  'DEADLINE' AS event_type,
  '데드라인' AS event_type_kr,
  cd.deadline_type AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type
      WHEN 'ANSWER_SUBMISSION' THEN '답변서 제출'
      WHEN 'PREP_SUBMISSION' THEN '준비서면 제출'
      WHEN 'EVIDENCE_SUBMISSION' THEN '증거 제출'
      WHEN 'APPEAL_DEADLINE' THEN '항소 기한'
      WHEN 'PAYMENT_DEADLINE' THEN '납부 기한'
      WHEN 'OTHER' THEN '기타'
      ELSE cd.deadline_type
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
  cd.status,
  2 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id

UNION ALL

-- 3. 상담 (CONSULTATION)
SELECT
  c.id,
  'CONSULTATION' AS event_type,
  '상담' AS event_type_kr,
  c.request_type AS event_subtype,
  CONCAT('(상담) ', c.name) AS title,
  c.name AS case_name,
  c.preferred_date AS event_date,
  COALESCE(c.preferred_time, '00:00') AS event_time,
  (c.preferred_date || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::timestamp AS event_datetime,
  c.phone AS reference_id,
  c.office_location AS location,
  c.message AS description,
  c.status,
  3 AS sort_priority
FROM consultations c
WHERE c.preferred_date IS NOT NULL

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
  gs.status,
  4 AS sort_priority
FROM general_schedules gs;
