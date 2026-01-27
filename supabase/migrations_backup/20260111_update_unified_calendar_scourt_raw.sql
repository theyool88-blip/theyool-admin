-- unified_calendar 뷰 수정: SCOURT 원본 기일명 표시
-- 2026-01-11
-- scourt_type_raw 필드가 있으면 원본 기일명 사용, 없으면 ENUM 라벨 사용

DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  -- SCOURT 원본 기일명이 있으면 사용, 없으면 ENUM 라벨 사용
  CONCAT('(',
    COALESCE(
      ch.scourt_type_raw,  -- 원본: "제1회 변론기일"
      CASE ch.hearing_type::TEXT
        WHEN 'HEARING_MAIN' THEN '변론기일'
        WHEN 'HEARING_INTERIM' THEN '중간심문'
        WHEN 'HEARING_MEDIATION' THEN '조정기일'
        WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
        WHEN 'HEARING_PARENTING' THEN '양육상담'
        WHEN 'HEARING_JUDGMENT' THEN '선고기일'
        WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
        ELSE ch.hearing_type::TEXT
      END
    ),
    ') ', COALESCE(lc.case_name, ch.case_number, '미지정 사건')
  )::TEXT AS title,
  COALESCE(lc.case_name, ch.case_number)::TEXT AS case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI')::TEXT AS event_time,
  ch.hearing_date AS event_datetime,
  COALESCE(ch.case_number, lc.court_case_number)::TEXT AS reference_id,
  CASE
    WHEN lc.court_name IS NOT NULL AND ch.location IS NOT NULL THEN lc.court_name || ' ' || ch.location
    WHEN lc.court_name IS NOT NULL THEN lc.court_name
    ELSE ch.location
  END::TEXT AS location,
  ch.notes::TEXT AS description,
  ch.status::TEXT AS status,
  ch.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 출석변호사 정보
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  -- SCOURT 원본 데이터 (UI에서 직접 사용 가능)
  ch.scourt_type_raw::TEXT AS scourt_type_raw,
  ch.scourt_result_raw::TEXT AS scourt_result_raw,
  ch.hearing_sequence AS hearing_sequence,
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN tenant_members tm_attending ON ch.attending_lawyer_id = tm_attending.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

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
  lc.tenant_id::TEXT AS tenant_id,
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 데드라인은 SCOURT 원본 없음
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 3. 상담 (consultations)
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
  NULL::TEXT AS location,
  c.message::TEXT AS description,
  c.status::TEXT AS status,
  NULL::TEXT AS case_id,
  c.tenant_id::TEXT AS tenant_id,
  NULL::TEXT AS attending_lawyer_id,
  NULL::TEXT AS attending_lawyer_name,
  -- 상담은 SCOURT 원본 없음
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations c
WHERE c.preferred_date IS NOT NULL;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담을 통합한 캘린더 뷰 (SCOURT 원본 데이터 포함)';
