-- unified_calendar VIEW 수정: consultations 테이블 제대로 연결
-- 날짜가 있는 모든 상담(callback, visit, video, info)을 캘린더에 표시
--
-- 핵심 수정사항:
-- 1. enum 타입을 ::text로 명시적 캐스팅하여 CASE 문에서 한글 변환 시 오류 방지
-- 2. consultations 테이블의 모든 타입(callback, visit, video, info) 포함
-- 3. preferred_date가 있는 상담만 캘린더에 표시

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

-- 3. 상담 (CONSULTATION) - consultations 테이블 사용
-- request_type: callback, visit, video, info 모두 포함
SELECT
  c.id,
  'CONSULTATION' AS event_type,
  '상담' AS event_type_kr,
  c.request_type AS event_subtype,
  CONCAT('(',
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
  c.preferred_date AS event_date,
  COALESCE(c.preferred_time, '00:00') AS event_time,
  CASE
    WHEN c.preferred_date IS NOT NULL AND c.preferred_time IS NOT NULL
    THEN (c.preferred_date || ' ' || c.preferred_time || ':00')::timestamp
    WHEN c.preferred_date IS NOT NULL
    THEN (c.preferred_date || ' 00:00:00')::timestamp
    ELSE NULL
  END AS event_datetime,
  c.phone AS reference_id,
  c.office_location AS location,
  c.message AS description,
  c.status::text,
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
  gs.status::text,
  4 AS sort_priority
FROM general_schedules gs;

COMMENT ON VIEW unified_calendar IS '통합 캘린더 VIEW: 법원기일, 데드라인, 상담예약(모든 타입), 일반일정을 통합';

-- 테스트 쿼리 (VIEW 생성 후 실행하여 검증)
-- SELECT event_type, event_type_kr, event_subtype, title, event_date, event_time
-- FROM unified_calendar
-- ORDER BY event_date DESC, event_time DESC
-- LIMIT 20;
