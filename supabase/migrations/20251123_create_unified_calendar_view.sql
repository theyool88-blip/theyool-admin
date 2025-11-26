-- 통합 캘린더 VIEW 생성 (명시적 타입 캐스팅)
-- 법원 기일, 데드라인, 상담 예약을 하나의 뷰로 통합

CREATE OR REPLACE VIEW unified_calendar AS
-- 법원 기일 (court_hearings)
SELECT
  id,
  'COURT_HEARING'::TEXT AS event_type,
  hearing_type::TEXT AS title,
  hearing_date::DATE AS event_date,
  TO_CHAR(hearing_date, 'HH24:MI:SS')::TEXT AS event_time,
  hearing_date::TIMESTAMP AS event_datetime,
  case_number::TEXT AS reference_id,
  location::TEXT,
  notes::TEXT AS description,
  NULL::TEXT AS status
FROM court_hearings

UNION ALL

-- 데드라인 (case_deadlines)
SELECT
  id,
  'DEADLINE'::TEXT AS event_type,
  deadline_type::TEXT AS title,
  deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  deadline_date::TIMESTAMP AS event_datetime,
  case_number::TEXT AS reference_id,
  NULL::TEXT AS location,
  notes::TEXT AS description,
  status::TEXT AS status
FROM case_deadlines

UNION ALL

-- 상담 예약 (bookings)
SELECT
  id,
  'CONSULTATION'::TEXT AS event_type,
  (name || ' 상담')::TEXT AS title,
  preferred_date::DATE AS event_date,
  preferred_time::TEXT AS event_time,
  (preferred_date::TEXT || ' ' || preferred_time)::TIMESTAMP AS event_datetime,
  phone::TEXT AS reference_id,
  office_location::TEXT AS location,
  message::TEXT AS description,
  status::TEXT AS status
FROM bookings;

-- VIEW에 대한 코멘트 추가
COMMENT ON VIEW unified_calendar IS '법원 기일, 데드라인, 상담 예약을 통합한 캘린더 뷰';
