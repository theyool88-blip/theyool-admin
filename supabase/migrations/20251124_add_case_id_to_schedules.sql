-- court_hearings와 case_deadlines 테이블에 case_id 컬럼 추가
-- 작성일: 2025-11-24

-- 1. court_hearings에 case_id 추가
ALTER TABLE court_hearings
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES legal_cases(id);

-- 2. case_deadlines에 case_id 추가
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES legal_cases(id);

-- 3. 기존 데이터에 case_id 업데이트 (case_number로 매칭)
UPDATE court_hearings ch
SET case_id = lc.id
FROM legal_cases lc
WHERE ch.case_number = lc.case_number
  AND ch.case_id IS NULL;

UPDATE case_deadlines cd
SET case_id = lc.id
FROM legal_cases lc
WHERE cd.case_number = lc.case_number
  AND cd.case_id IS NULL;

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_court_hearings_case_id ON court_hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_case_deadlines_case_id ON case_deadlines(case_id);

-- 5. unified_calendar VIEW 업데이트
DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type::TEXT
      WHEN 'HEARING_MAIN' THEN '변론기일'
      WHEN 'HEARING_INTERIM' THEN '중간심문'
      WHEN 'HEARING_MEDIATION' THEN '조정기일'
      WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
      WHEN 'HEARING_PARENTING' THEN '양육상담'
      WHEN 'HEARING_JUDGMENT' THEN '선고기일'
      WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
      ELSE ch.hearing_type::TEXT
    END,
    ') ', lc.case_name
  )::TEXT AS title,
  lc.case_name::TEXT,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date AS event_datetime,
  ch.case_number::TEXT AS reference_id,
  ch.location::TEXT,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id

UNION ALL

-- 2. 사건 데드라인 (DEADLINE)
SELECT
  cd.id,
  'DEADLINE'::TEXT AS event_type,
  '데드라인'::TEXT AS event_type_kr,
  cd.deadline_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type::TEXT
      WHEN 'DL_APPEAL' THEN '상소기간'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
      WHEN 'DL_RETRIAL' THEN '재심기한'
      ELSE cd.deadline_type::TEXT
    END,
    ') ', lc.case_name
  )::TEXT AS title,
  lc.case_name::TEXT,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  (cd.deadline_date::TEXT || ' 00:00:00')::TIMESTAMP AS event_datetime,
  cd.case_number::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id

UNION ALL

-- 3. 상담 (bookings)
SELECT
  b.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담'::TEXT AS event_type_kr,
  b.request_type::TEXT AS event_subtype,
  ('(상담) ' || b.name)::TEXT AS title,
  b.name::TEXT AS case_name,
  b.preferred_date::DATE AS event_date,
  COALESCE(b.preferred_time, '00:00')::TEXT AS event_time,
  (b.preferred_date::TEXT || ' ' || COALESCE(b.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  b.phone::TEXT AS reference_id,
  b.office_location::TEXT AS location,
  b.message::TEXT AS description,
  b.status::TEXT AS status,
  CASE
    WHEN b.preferred_time IS NULL OR b.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM bookings b
WHERE b.preferred_date IS NOT NULL

UNION ALL

-- 4. 상담 (consultations - 기존 테이블)
SELECT
  c.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담'::TEXT AS event_type_kr,
  c.request_type::TEXT AS event_subtype,
  ('(상담) ' || c.name)::TEXT AS title,
  c.name::TEXT AS case_name,
  c.preferred_date::DATE AS event_date,
  COALESCE(c.preferred_time, '00:00')::TEXT AS event_time,
  (c.preferred_date::TEXT || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  c.phone::TEXT AS reference_id,
  c.office_location::TEXT AS location,
  c.message::TEXT AS description,
  c.status::TEXT AS status,
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations c
WHERE c.preferred_date IS NOT NULL

UNION ALL

-- 5. 일반 일정 (general_schedules)
SELECT
  gs.id,
  'GENERAL_SCHEDULE'::TEXT AS event_type,
  '일반일정'::TEXT AS event_type_kr,
  gs.schedule_type::TEXT AS event_subtype,
  CONCAT('(',
    CASE gs.schedule_type
      WHEN 'meeting' THEN '회의'
      WHEN 'appointment' THEN '약속'
      WHEN 'task' THEN '업무'
      WHEN 'other' THEN '기타'
      ELSE gs.schedule_type::TEXT
    END,
    ') ', gs.title
  )::TEXT AS title,
  gs.title::TEXT AS case_name,
  gs.schedule_date::DATE AS event_date,
  COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00')::TEXT AS event_time,
  (gs.schedule_date::TEXT || ' ' || COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00') || ':00')::TIMESTAMP AS event_datetime,
  NULL::TEXT AS reference_id,
  gs.location::TEXT,
  gs.description::TEXT,
  gs.status::TEXT AS status,
  CASE
    WHEN gs.schedule_time IS NULL OR TO_CHAR(gs.schedule_time, 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs;
