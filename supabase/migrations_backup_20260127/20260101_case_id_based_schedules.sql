-- 사건번호 없는 사건 지원을 위한 스키마 수정
-- 작성일: 2026-01-01
-- 설명: case_number를 선택적으로, case_id를 필수로 변경

-- 1. court_hearings: case_number를 NULL 허용으로 변경
ALTER TABLE court_hearings ALTER COLUMN case_number DROP NOT NULL;

-- 2. case_deadlines: case_number를 NULL 허용으로 변경
ALTER TABLE case_deadlines ALTER COLUMN case_number DROP NOT NULL;

-- 3. court_hearings: case_id 필수로 변경 (기존 데이터 정리 후)
-- 먼저 case_id가 NULL인 데이터에 대해 case_number로 매칭 시도
UPDATE court_hearings ch
SET case_id = lc.id
FROM legal_cases lc
WHERE ch.case_id IS NULL
  AND ch.case_number = lc.court_case_number;

-- 4. case_deadlines: case_id 필수로 변경 (기존 데이터 정리 후)
UPDATE case_deadlines cd
SET case_id = lc.id
FROM legal_cases lc
WHERE cd.case_id IS NULL
  AND cd.case_number = lc.court_case_number;

-- 5. case_id에 NOT NULL 제약조건 추가 (새로 생성되는 레코드에만 적용)
-- 주의: 기존 데이터 중 매칭 안 된 것이 있을 수 있으므로 ALTER로 NOT NULL 추가하지 않음
-- 대신 application level에서 case_id 필수로 처리

-- 6. unified_calendar VIEW 업데이트 (case_id 기반, case_number 없어도 동작)
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
    ') ', COALESCE(lc.case_name, ch.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, ch.case_number)::TEXT AS case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date AS event_datetime,
  COALESCE(ch.case_number, lc.court_case_number)::TEXT AS reference_id,
  ch.location::TEXT,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  ch.case_id::TEXT AS case_id,
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
      WHEN 'DL_CRIMINAL_APPEAL' THEN '형사상소기간'
      WHEN 'DL_FAMILY_NONLIT' THEN '가사비송즉시항고'
      WHEN 'DL_PAYMENT_ORDER' THEN '지급명령이의'
      ELSE cd.deadline_type::TEXT
    END,
    ') ', COALESCE(lc.case_name, cd.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, cd.case_number)::TEXT AS case_name,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  (cd.deadline_date::TEXT || ' 00:00:00')::TIMESTAMP AS event_datetime,
  COALESCE(cd.case_number, lc.court_case_number)::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  cd.case_id::TEXT AS case_id,
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id

UNION ALL

-- 3. 상담 (bookings)
SELECT
  b.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담예약'::TEXT AS event_type_kr,
  NULL::TEXT AS event_subtype,
  ('(상담예약) ' || b.name)::TEXT AS title,
  b.name::TEXT AS case_name,
  b.preferred_date::DATE AS event_date,
  COALESCE(b.preferred_time, '00:00')::TEXT AS event_time,
  (b.preferred_date::TEXT || ' ' || COALESCE(b.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  b.phone::TEXT AS reference_id,
  b.office_location::TEXT AS location,
  b.message::TEXT AS description,
  b.status::TEXT AS status,
  NULL::TEXT AS case_id,
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
  NULL::TEXT AS case_id,
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
  NULL::TEXT AS case_id,
  CASE
    WHEN gs.schedule_time IS NULL OR TO_CHAR(gs.schedule_time, 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs;

-- 7. 코멘트 추가
COMMENT ON COLUMN court_hearings.case_number IS '사건번호 (선택적, case_id로 사건 연결 권장)';
COMMENT ON COLUMN court_hearings.case_id IS '사건 ID (legal_cases 참조, 필수 권장)';
COMMENT ON COLUMN case_deadlines.case_number IS '사건번호 (선택적, case_id로 사건 연결 권장)';
COMMENT ON COLUMN case_deadlines.case_id IS '사건 ID (legal_cases 참조, 필수 권장)';
