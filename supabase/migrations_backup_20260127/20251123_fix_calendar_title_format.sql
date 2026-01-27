-- 통합 캘린더 VIEW 제목 형식 수정
-- 변경: (종류) 사건명 → 사건명만 표시
-- 이유: 캘린더에서 이미 schedule_type으로 "변론", "상담" 등 표시되므로 중복 제거

DROP VIEW IF EXISTS unified_calendar CASCADE;

CREATE OR REPLACE VIEW unified_calendar AS

-- 법원 기일 (court_hearings) - cases 테이블과 JOIN
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  CASE ch.hearing_type
    WHEN 'HEARING_MAIN' THEN '변론기일'
    WHEN 'HEARING_INTERIM' THEN '중간심문'
    WHEN 'HEARING_MEDIATION' THEN '조정기일'
    WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
    WHEN 'HEARING_PARENTING' THEN '양육상담'
    WHEN 'HEARING_JUDGMENT' THEN '선고기일'
    WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
    ELSE ch.hearing_type::TEXT
  END AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  -- 사건명만 표시 (종류 제거)
  COALESCE(c.title, ch.case_number) AS title,
  c.title AS case_name,
  ch.hearing_date::DATE AS event_date,
  TO_CHAR(ch.hearing_date, 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date::TIMESTAMP AS event_datetime,
  ch.case_number::TEXT AS reference_id,
  ch.location::TEXT,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  CASE
    WHEN TO_CHAR(ch.hearing_date, 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN cases c ON ch.case_number = c.case_number

UNION ALL

-- 데드라인 (case_deadlines) - cases 테이블과 JOIN
SELECT
  cd.id,
  'DEADLINE'::TEXT AS event_type,
  CASE cd.deadline_type
    WHEN 'DL_APPEAL' THEN '상소기간'
    WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
    WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
    WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
    WHEN 'DL_RETRIAL' THEN '재심기한'
    ELSE cd.deadline_type::TEXT
  END AS event_type_kr,
  cd.deadline_type::TEXT AS event_subtype,
  -- 사건명만 표시 (종류 제거)
  COALESCE(c.title, cd.case_number) AS title,
  c.title AS case_name,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  cd.deadline_date::TIMESTAMP AS event_datetime,
  cd.case_number::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN cases c ON cd.case_number = c.case_number

UNION ALL

-- 상담 예약 (bookings)
SELECT
  b.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담예약'::TEXT AS event_type_kr,
  NULL::TEXT AS event_subtype,
  -- 상담은 이름만 표시
  b.name::TEXT AS title,
  b.name AS case_name,
  b.preferred_date::DATE AS event_date,
  b.preferred_time::TEXT AS event_time,
  (b.preferred_date::TEXT || ' ' || COALESCE(b.preferred_time, '00:00'))::TIMESTAMP AS event_datetime,
  b.phone::TEXT AS reference_id,
  b.office_location::TEXT AS location,
  b.message::TEXT AS description,
  b.status::TEXT AS status,
  CASE
    WHEN b.preferred_time IS NULL OR b.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM bookings b;

COMMENT ON VIEW unified_calendar IS '법원 기일, 데드라인, 상담 예약을 통합한 캘린더 뷰 (사건명만 표시, 정렬 최적화)';
