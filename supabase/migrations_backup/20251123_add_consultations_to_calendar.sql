-- Unified Calendar VIEW에 consultations 테이블 추가
-- 기존 VIEW를 DROP하고 consultations를 포함하여 재생성

DROP VIEW IF EXISTS unified_calendar;

CREATE VIEW unified_calendar AS

-- 1. 법원 기일 (court_hearings)
SELECT
  ch.id,
  'COURT_HEARING' as event_type,
  CASE ch.hearing_type
    WHEN 'HEARING_MAIN' THEN '변론기일'
    WHEN 'HEARING_INTERIM' THEN '사전·보전처분 심문기일'
    WHEN 'HEARING_MEDIATION' THEN '조정기일'
    WHEN 'HEARING_INVESTIGATION' THEN '조사기일'
    WHEN 'HEARING_PARENTING' THEN '상담·교육·프로그램 기일'
    WHEN 'HEARING_JUDGMENT' THEN '선고기일'
    WHEN 'HEARING_LAWYER_MEETING' THEN '변호사미팅'
    ELSE '법원기일'
  END as event_type_kr,
  ch.hearing_type as event_subtype,
  CONCAT('(',
    CASE ch.hearing_type
      WHEN 'HEARING_MAIN' THEN '변론기일'
      WHEN 'HEARING_INTERIM' THEN '사전·보전처분 심문기일'
      WHEN 'HEARING_MEDIATION' THEN '조정기일'
      WHEN 'HEARING_INVESTIGATION' THEN '조사기일'
      WHEN 'HEARING_PARENTING' THEN '상담·교육·프로그램 기일'
      WHEN 'HEARING_JUDGMENT' THEN '선고기일'
      WHEN 'HEARING_LAWYER_MEETING' THEN '변호사미팅'
      ELSE '법원기일'
    END,
    ') ', ch.case_number) as title,
  ch.case_number as case_name,
  (ch.hearing_date AT TIME ZONE 'UTC')::date as event_date,
  TO_CHAR((ch.hearing_date AT TIME ZONE 'UTC'), 'HH24:MI') as event_time,
  ch.hearing_date as event_datetime,
  ch.case_number as reference_id,
  ch.location,
  ch.notes as description,
  ch.status,
  CASE WHEN TO_CHAR((ch.hearing_date AT TIME ZONE 'UTC'), 'HH24:MI') IS NULL THEN 1 ELSE 2 END as sort_priority,
  ch.created_at,
  ch.updated_at
FROM court_hearings ch

UNION ALL

-- 2. 데드라인 (case_deadlines)
SELECT
  cd.id,
  'DEADLINE' as event_type,
  CASE cd.deadline_type
    WHEN 'DL_APPEAL' THEN '상소기간'
    WHEN 'DL_MEDIATION_OBJ' THEN '조정·화해 이의기간'
    WHEN 'DL_IMM_APPEAL' THEN '즉시항고기간'
    WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서 제출기한'
    WHEN 'DL_RETRIAL' THEN '재심의 소 제기기한'
    ELSE '데드라인'
  END as event_type_kr,
  cd.deadline_type as event_subtype,
  CONCAT('(',
    CASE cd.deadline_type
      WHEN 'DL_APPEAL' THEN '상소기간'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정·화해 이의기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고기간'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서 제출기한'
      WHEN 'DL_RETRIAL' THEN '재심의 소 제기기한'
      ELSE '데드라인'
    END,
    ') ', cd.case_number) as title,
  cd.case_number as case_name,
  cd.deadline_date as event_date,
  TO_CHAR((cd.deadline_datetime AT TIME ZONE 'UTC'), 'HH24:MI') as event_time,
  cd.deadline_datetime as event_datetime,
  cd.case_number as reference_id,
  NULL as location,
  cd.notes as description,
  cd.status,
  1 as sort_priority,
  cd.created_at,
  cd.updated_at
FROM case_deadlines cd

UNION ALL

-- 3. 상담 예약 (consultations) - 신규 추가
SELECT
  c.id,
  'CONSULTATION' as event_type,
  CASE c.request_type
    WHEN 'callback' THEN '회신요청'
    WHEN 'visit' THEN '방문상담'
    WHEN 'video' THEN '화상상담'
    WHEN 'info' THEN '정보요청'
    ELSE '상담'
  END as event_type_kr,
  c.request_type as event_subtype,
  CONCAT('(',
    CASE c.request_type
      WHEN 'callback' THEN '회신요청'
      WHEN 'visit' THEN '방문상담'
      WHEN 'video' THEN '화상상담'
      WHEN 'info' THEN '정보요청'
      ELSE '상담'
    END,
    ') ', c.name) as title,
  c.name as case_name,
  c.preferred_date as event_date,
  c.preferred_time as event_time,
  CASE
    WHEN c.preferred_date IS NOT NULL AND c.preferred_time IS NOT NULL
    THEN (c.preferred_date::text || ' ' || c.preferred_time::text)::timestamp
    ELSE NULL
  END as event_datetime,
  c.phone as reference_id,
  c.office_location as location,
  c.message as description,
  c.status,
  CASE WHEN c.preferred_time IS NULL THEN 1 ELSE 2 END as sort_priority,
  c.created_at,
  c.updated_at
FROM consultations c
WHERE c.preferred_date IS NOT NULL;

COMMENT ON VIEW unified_calendar IS '통합 캘린더 VIEW: 법원기일, 데드라인, 상담예약을 하나로 통합';
