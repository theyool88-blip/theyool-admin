-- unified_calendar 뷰 수정: 화상 참여자 정보 추가
-- 2026-01-14
--
-- 변경 내용:
-- 1. COURT_HEARING에 video_participant_side 컬럼 추가
-- 2. 화상기일 표시용 정보 제공

DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
-- 1. 법원기일 (COURT_HEARING) - 화상 참여자 정보 포함
SELECT
  ch.id,
  'COURT_HEARING'::TEXT AS event_type,
  '법원기일'::TEXT AS event_type_kr,
  ch.hearing_type::TEXT AS event_subtype,
  -- title: "(기일명) 의뢰인v상대방(사건명)" 형식
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
        ELSE ch.hearing_type::TEXT
      END
    ),
    ') ',
    -- 의뢰인v상대방(사건명) 또는 기존 case_name
    CASE
      WHEN client_party.party_name IS NOT NULL AND opponent_party.party_name IS NOT NULL
        THEN client_party.party_name || 'v' || opponent_party.party_name || '(' || COALESCE(lc.case_name, '') || ')'
      WHEN client_party.party_name IS NOT NULL
        THEN client_party.party_name || '(' || COALESCE(lc.case_name, '') || ')'
      ELSE COALESCE(lc.case_name, ch.case_number, '미지정 사건')
    END
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
  ch.scourt_type_raw::TEXT AS scourt_type_raw,
  ch.scourt_result_raw::TEXT AS scourt_result_raw,
  ch.hearing_sequence AS hearing_sequence,
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority,
  -- 당사자 정보 (COURT_HEARING은 NULL)
  NULL::UUID AS party_id,
  NULL::TEXT AS party_side,
  NULL::TEXT AS deadline_party_name,
  NULL::TEXT AS deadline_party_type_label,
  -- 화상 참여자 정보 (COURT_HEARING 전용)
  ch.video_participant_side::TEXT AS video_participant_side
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN tenant_members tm_attending ON ch.attending_lawyer_id = tm_attending.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id
-- 의뢰인 (is_our_client = true, is_primary 우선)
LEFT JOIN LATERAL (
  SELECT party_name FROM case_parties cp
  WHERE cp.case_id = ch.case_id AND cp.is_our_client = TRUE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) client_party ON TRUE
-- 상대방 (is_our_client = false, is_primary 우선)
LEFT JOIN LATERAL (
  SELECT party_name FROM case_parties cp
  WHERE cp.case_id = ch.case_id AND cp.is_our_client = FALSE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) opponent_party ON TRUE

UNION ALL

-- 2. 사건 데드라인 (DEADLINE) - 당사자 정보 포함
SELECT
  cd.id,
  'DEADLINE'::TEXT AS event_type,
  '데드라인'::TEXT AS event_type_kr,
  cd.deadline_type::TEXT AS event_subtype,
  -- title: "[기한/당사자지위] 기한유형 - 당사자명(사건명)" 형식
  CONCAT(
    -- [기한] 또는 [기한/원고] 또는 [기한/피고]
    CASE
      WHEN cd.party_side = 'plaintiff_side' THEN '[기한/원고] '
      WHEN cd.party_side = 'defendant_side' THEN '[기한/피고] '
      ELSE '[기한] '
    END,
    CASE cd.deadline_type::TEXT
      WHEN 'DL_APPEAL' THEN '항소기간'
      WHEN 'DL_FAMILY_NONLIT' THEN '항고기간'
      WHEN 'DL_CRIMINAL_APPEAL' THEN '형사항소기간'
      WHEN 'DL_IMM_APPEAL' THEN '즉시항고기간'
      WHEN 'DL_APPEAL_BRIEF' THEN '항소이유서제출기한'
      WHEN 'DL_MEDIATION_OBJ' THEN '조정이의기간'
      WHEN 'DL_RETRIAL' THEN '재심기한'
      WHEN 'DL_PAYMENT_ORDER' THEN '지급명령이의기간'
      ELSE cd.deadline_type::TEXT
    END,
    ' - ',
    -- 항상 의뢰인 v 상대방(사건명) 형식
    CASE
      WHEN client_party.party_name IS NOT NULL AND opponent_party.party_name IS NOT NULL
        THEN client_party.party_name || 'v' || opponent_party.party_name || '(' || COALESCE(lc.case_name, '') || ')'
      WHEN client_party.party_name IS NOT NULL
        THEN client_party.party_name || '(' || COALESCE(lc.case_name, '') || ')'
      ELSE COALESCE(lc.case_name, cd.case_number, '미지정 사건')
    END
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
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  1 AS sort_priority,
  -- 당사자 정보
  cd.party_id,
  cd.party_side::TEXT AS party_side,
  deadline_party.party_name::TEXT AS deadline_party_name,
  deadline_party.party_type_label::TEXT AS deadline_party_type_label,
  -- 화상 참여자 정보 (DEADLINE은 NULL)
  NULL::TEXT AS video_participant_side
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id
-- 데드라인 연결 당사자
LEFT JOIN case_parties deadline_party ON cd.party_id = deadline_party.id
-- 의뢰인 (fallback용)
LEFT JOIN LATERAL (
  SELECT party_name FROM case_parties cp
  WHERE cp.case_id = cd.case_id AND cp.is_our_client = TRUE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) client_party ON TRUE
-- 상대방 (fallback용)
LEFT JOIN LATERAL (
  SELECT party_name FROM case_parties cp
  WHERE cp.case_id = cd.case_id AND cp.is_our_client = FALSE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) opponent_party ON TRUE

UNION ALL

-- 3. 상담 (consultations) - 기존 유지
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
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  CASE
    WHEN c.preferred_time IS NULL OR c.preferred_time = '00:00' THEN 1
    ELSE 2
  END AS sort_priority,
  -- 당사자 정보 (CONSULTATION은 NULL)
  NULL::UUID AS party_id,
  NULL::TEXT AS party_side,
  NULL::TEXT AS deadline_party_name,
  NULL::TEXT AS deadline_party_type_label,
  -- 화상 참여자 정보 (CONSULTATION은 NULL)
  NULL::TEXT AS video_participant_side
FROM consultations c
WHERE c.preferred_date IS NOT NULL;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담 통합 캘린더 뷰 (당사자별 데드라인 + 화상기일 지원)';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ unified_calendar VIEW 업데이트 완료';
  RAISE NOTICE '   - video_participant_side 컬럼 추가 (화상기일 참여자 측)';
END $$;
