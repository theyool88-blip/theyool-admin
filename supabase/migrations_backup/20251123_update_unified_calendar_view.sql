-- 통합 캘린더 VIEW 업데이트
-- 작성일: 2025-11-23
-- 개선사항:
--   1. cases 테이블과 JOIN하여 사건명 포함
--   2. 한글 종류명 추가 (event_type_kr)
--   3. 정렬 순서 개선 (시간 없는 일정 우선, 그 다음 시간순)
--   4. 표시 제목 형식: (종류) 사건명

-- 기존 VIEW 삭제
DROP VIEW IF EXISTS unified_calendar CASCADE;

-- 개선된 unified_calendar VIEW 생성
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
  CASE
    WHEN c.title IS NOT NULL THEN
      '(' ||
      CASE ch.hearing_type
        WHEN 'HEARING_MAIN' THEN '변론기일'
        WHEN 'HEARING_INTERIM' THEN '중간심문'
        WHEN 'HEARING_MEDIATION' THEN '조정기일'
        WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
        WHEN 'HEARING_PARENTING' THEN '양육상담'
        WHEN 'HEARING_JUDGMENT' THEN '선고기일'
        WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
        ELSE ch.hearing_type::TEXT
      END || ') ' || c.title
    ELSE ch.hearing_type::TEXT || ' - ' || ch.case_number
  END AS title,
  c.title AS case_name,
  ch.hearing_date::DATE AS event_date,
  TO_CHAR(ch.hearing_date, 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date::TIMESTAMP AS event_datetime,
  ch.case_number::TEXT AS reference_id,
  ch.location::TEXT,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  -- 정렬용 필드 추가
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
  CASE
    WHEN c.title IS NOT NULL THEN
      '(' ||
      CASE cd.deadline_type
        WHEN 'DL_APPEAL' THEN '상소기간'
        WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
        WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
        WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
        WHEN 'DL_RETRIAL' THEN '재심기한'
        ELSE cd.deadline_type::TEXT
      END || ') ' || c.title
    ELSE cd.deadline_type::TEXT || ' - ' || cd.case_number
  END AS title,
  c.title AS case_name,
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  cd.deadline_date::TIMESTAMP AS event_datetime,
  cd.case_number::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  1 AS sort_priority  -- 데드라인은 항상 시간 없음 (우선 정렬)
FROM case_deadlines cd
LEFT JOIN cases c ON cd.case_number = c.case_number

UNION ALL

-- 상담 예약 (bookings)
SELECT
  b.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담예약'::TEXT AS event_type_kr,
  NULL::TEXT AS event_subtype,
  ('(상담예약) ' || b.name)::TEXT AS title,
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
FROM bookings b

UNION ALL

-- 상담 내역 (consultations) - 신규 추가
SELECT
  cons.id,
  'CONSULTATION'::TEXT AS event_type,
  CASE cons.request_type
    WHEN 'callback' THEN '회신요청'
    WHEN 'visit' THEN '방문상담'
    WHEN 'video' THEN '화상상담'
    WHEN 'info' THEN '정보요청'
    ELSE '상담'
  END::TEXT AS event_type_kr,
  cons.request_type::TEXT AS event_subtype,
  ('(' ||
    CASE cons.request_type
      WHEN 'callback' THEN '회신요청'
      WHEN 'visit' THEN '방문상담'
      WHEN 'video' THEN '화상상담'
      WHEN 'info' THEN '정보요청'
      ELSE '상담'
    END || ') ' || cons.name)::TEXT AS title,
  cons.name AS case_name,
  cons.preferred_date::DATE AS event_date,
  cons.preferred_time::TEXT AS event_time,
  CASE
    WHEN cons.preferred_date IS NOT NULL AND cons.preferred_time IS NOT NULL
    THEN (cons.preferred_date::TEXT || ' ' || cons.preferred_time)::TIMESTAMP
    WHEN cons.preferred_date IS NOT NULL
    THEN (cons.preferred_date::TEXT || ' 00:00')::TIMESTAMP
    ELSE NULL
  END AS event_datetime,
  cons.phone::TEXT AS reference_id,
  cons.office_location::TEXT AS location,
  cons.message::TEXT AS description,
  cons.status::TEXT AS status,
  CASE
    WHEN cons.preferred_time IS NULL OR cons.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations cons
WHERE cons.preferred_date IS NOT NULL;  -- 날짜가 있는 상담만 캘린더에 표시

-- VIEW에 대한 코멘트 추가
COMMENT ON VIEW unified_calendar IS '법원 기일, 데드라인, 상담 예약(bookings + consultations)을 통합한 캘린더 뷰 (사건명 포함, 정렬 최적화)';

-- 정렬 예시 쿼리
-- SELECT * FROM unified_calendar
-- WHERE event_date >= CURRENT_DATE
-- ORDER BY event_date ASC, sort_priority ASC, event_time ASC
-- LIMIT 20;
