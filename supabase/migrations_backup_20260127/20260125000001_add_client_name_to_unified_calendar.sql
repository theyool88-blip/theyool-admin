-- ============================================================================
-- unified_calendar 뷰 수정: client_name, deadline_type_label 컬럼 추가
-- 생성일: 2026-01-25
--
-- 변경 사항:
-- 1. our_client_name을 client_name으로도 출력 (프론트엔드 호환)
-- 2. deadline_type_label 추가 (마감일 뱃지 표시용)
-- 3. scourt_type_raw, scourt_result_raw 추가 (연기 판단용)
-- ============================================================================

DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING)
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  CONCAT('(',
    COALESCE(
      ch.scourt_type_raw,
      CASE ch.hearing_type::TEXT
        WHEN 'HEARING_MAIN' THEN '변론기일'
        WHEN 'HEARING_INTERIM' THEN '중간심문'
        WHEN 'HEARING_MEDIATION' THEN '조정기일'
        WHEN 'HEARING_INVESTIGATION' THEN '심문기일'
        WHEN 'HEARING_PARENTING' THEN '양육상담'
        WHEN 'HEARING_JUDGMENT' THEN '선고기일'
        WHEN 'HEARING_LAWYER_MEETING' THEN '변호사 미팅'
        WHEN 'HEARING_SENTENCE' THEN '형사 선고'
        WHEN 'HEARING_TRIAL' THEN '공판기일'
        WHEN 'HEARING_EXAMINATION' THEN '증인신문'
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
  COALESCE(ch.attending_lawyer_id, lc.assigned_to)::TEXT AS attending_lawyer_id,
  COALESCE(tm_attending.display_name, tm_assigned.display_name)::TEXT AS attending_lawyer_name,
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 의뢰인명 (두 컬럼 모두 출력)
  lc.primary_client_name::TEXT AS our_client_name,
  lc.primary_client_name::TEXT AS client_name,
  -- SCOURT 원본 데이터 (scourt_raw_data.result에 "기일변경" 등 원본 텍스트 저장)
  ch.scourt_type_raw::TEXT AS scourt_type_raw,
  COALESCE(ch.scourt_raw_data->>'result', ch.result::TEXT)::TEXT AS scourt_result_raw,
  -- 데드라인 타입명 (기일은 NULL)
  NULL::TEXT AS deadline_type_label,
  -- 의뢰인 측 (원고/피고)
  (SELECT
    CASE
      WHEN cp.party_type IN ('plaintiff', 'creditor', 'applicant') THEN 'plaintiff_side'
      WHEN cp.party_type IN ('defendant', 'debtor', 'respondent') THEN 'defendant_side'
      ELSE NULL
    END
  FROM case_parties cp
  WHERE cp.case_id = ch.case_id
  ORDER BY cp.party_order ASC
  LIMIT 1)::TEXT AS our_client_side,
  -- 정렬 우선순위
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
      WHEN 'DL_APPEAL_BRIEF_HIGH' THEN '상고이유서'
      WHEN 'DL_RETRIAL' THEN '재심기한'
      WHEN 'DL_CRIMINAL_APPEAL' THEN '형사상소기간'
      WHEN 'DL_FAMILY_NONLIT' THEN '비송즉시항고'
      WHEN 'DL_PAYMENT_ORDER' THEN '지급명령이의'
      WHEN 'DL_ELEC_SERVICE' THEN '전자송달'
      WHEN 'DL_CUSTOM' THEN COALESCE(cd.custom_deadline_name, '사용자정의')
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
  NULL::TEXT AS video_participant_side,
  -- 의뢰인명 (두 컬럼 모두 출력)
  COALESCE(
    (SELECT cp.party_name FROM case_parties cp WHERE cp.id = cd.case_party_id),
    lc.primary_client_name
  )::TEXT AS our_client_name,
  COALESCE(
    (SELECT cp.party_name FROM case_parties cp WHERE cp.id = cd.case_party_id),
    lc.primary_client_name
  )::TEXT AS client_name,
  -- SCOURT 원본 데이터 (데드라인은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  -- 데드라인 타입명 (뱃지 표시용)
  CASE cd.deadline_type::TEXT
    WHEN 'DL_APPEAL' THEN '항소기한'
    WHEN 'DL_MEDIATION_OBJ' THEN '조정이의'
    WHEN 'DL_IMM_APPEAL' THEN '즉시항고'
    WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서'
    WHEN 'DL_APPEAL_BRIEF_HIGH' THEN '상고이유서'
    WHEN 'DL_RETRIAL' THEN '재심기한'
    WHEN 'DL_CRIMINAL_APPEAL' THEN '형사항소'
    WHEN 'DL_FAMILY_NONLIT' THEN '비송항고'
    WHEN 'DL_PAYMENT_ORDER' THEN '지명이의'
    WHEN 'DL_ELEC_SERVICE' THEN '전자송달'
    WHEN 'DL_CUSTOM' THEN COALESCE(cd.custom_deadline_name, '기한')
    ELSE '기한'
  END::TEXT AS deadline_type_label,
  -- 의뢰인 측 (원고/피고)
  (SELECT
    CASE
      WHEN cp.party_type IN ('plaintiff', 'creditor', 'applicant') THEN 'plaintiff_side'
      WHEN cp.party_type IN ('defendant', 'debtor', 'respondent') THEN 'defendant_side'
      ELSE NULL
    END
  FROM case_parties cp
  WHERE cp.case_id = cd.case_id
  ORDER BY cp.party_order ASC
  LIMIT 1)::TEXT AS our_client_side,
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id

UNION ALL

-- 3. 상담 (CONSULTATION)
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
  c.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  NULL::TEXT AS video_participant_side,
  -- 의뢰인명 (상담자 이름)
  c.name::TEXT AS our_client_name,
  c.name::TEXT AS client_name,
  -- SCOURT 원본 데이터 (상담은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  -- 데드라인 타입명 (상담은 NULL)
  NULL::TEXT AS deadline_type_label,
  -- 의뢰인 측 (상담은 NULL)
  NULL::TEXT AS our_client_side,
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM consultations c
LEFT JOIN tenant_members tm_assigned ON c.assigned_to = tm_assigned.id
WHERE c.preferred_date IS NOT NULL

UNION ALL

-- 4. 일반 일정 (GENERAL_SCHEDULE)
SELECT
  gs.id,
  'GENERAL_SCHEDULE'::TEXT AS event_type,
  '일반일정'::TEXT AS event_type_kr,
  gs.schedule_type::TEXT AS event_subtype,
  gs.title::TEXT AS title,
  NULL::TEXT AS case_name,
  gs.schedule_date AS event_date,
  COALESCE(gs.schedule_time::TEXT, '00:00') AS event_time,
  (gs.schedule_date::TEXT || ' ' || COALESCE(gs.schedule_time::TEXT, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  NULL::TEXT AS reference_id,
  gs.location::TEXT AS location,
  gs.description::TEXT AS description,
  gs.status::TEXT AS status,
  NULL::TEXT AS case_id,
  gs.tenant_id::TEXT AS tenant_id,
  gs.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  NULL::TEXT AS video_participant_side,
  -- 의뢰인명 (일반일정은 NULL)
  NULL::TEXT AS our_client_name,
  NULL::TEXT AS client_name,
  -- SCOURT 원본 데이터 (일반일정은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  -- 데드라인 타입명 (일반일정은 NULL)
  NULL::TEXT AS deadline_type_label,
  -- 의뢰인 측 (일반일정은 NULL)
  NULL::TEXT AS our_client_side,
  CASE
    WHEN gs.schedule_time IS NULL THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs
LEFT JOIN tenant_members tm_assigned ON gs.assigned_to = tm_assigned.id;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정 통합 뷰 (client_name, deadline_type_label 추가)';
