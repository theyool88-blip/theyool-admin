-- ============================================================================
-- 법률 사무소 SaaS - 통합 뷰
-- 생성일: 2026-02-01
-- 설명: unified_calendar, upcoming_hearings, urgent_deadlines 등 통합 뷰
-- ============================================================================

-- ============================================================================
-- 1. unified_calendar 뷰 (통합 캘린더)
-- ============================================================================
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
  -- 의뢰인명 (case_parties에서 조회)
  client_party.party_name::TEXT AS client_name,
  -- 데드라인 타입명 (기일은 NULL)
  NULL::TEXT AS deadline_type_label,
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
  -- SCOURT 원본 데이터
  ch.scourt_type_raw::TEXT AS scourt_type_raw,
  ch.scourt_result_raw::TEXT AS scourt_result_raw,
  ch.hearing_sequence AS hearing_sequence,
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 의뢰인 측 (원고/피고)
  CASE
    WHEN client_party.party_type_label ILIKE '%원고%' OR client_party.party_type_label ILIKE '%청구인%' OR client_party.party_type_label ILIKE '%신청인%' THEN 'plaintiff_side'
    WHEN client_party.party_type_label ILIKE '%피고%' OR client_party.party_type_label ILIKE '%상대방%' OR client_party.party_type_label ILIKE '%피신청인%' THEN 'defendant_side'
    ELSE NULL
  END::TEXT AS our_client_side,
  -- 정렬 우선순위
  CASE
    WHEN TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') = '00:00' THEN 1
    ELSE 2
  END AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id
LEFT JOIN tenant_members tm_attending ON ch.attending_lawyer_id = tm_attending.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id
-- 의뢰인 당사자 조회 (party_name 포함)
LEFT JOIN LATERAL (
  SELECT cp.party_name, cp.party_type_label FROM case_parties cp
  WHERE cp.case_id = ch.case_id AND cp.is_our_client = TRUE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) client_party ON TRUE

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
  -- 의뢰인명 (case_parties에서 조회)
  client_party.party_name::TEXT AS client_name,
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
  cd.deadline_date::DATE AS event_date,
  '00:00'::TEXT AS event_time,
  (cd.deadline_date::TEXT || ' 00:00:00')::TIMESTAMP AS event_datetime,
  COALESCE(cd.case_number, lc.court_case_number)::TEXT AS reference_id,
  NULL::TEXT AS location,
  cd.notes::TEXT AS description,
  cd.status::TEXT AS status,
  cd.case_id::TEXT AS case_id,
  lc.tenant_id::TEXT AS tenant_id,
  -- 담당변호사 (사건 담당자)
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- SCOURT 원본 데이터 (데드라인은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 의뢰인 측 (본인/상대방 표시용)
  CASE
    WHEN client_party.party_type_label ILIKE '%원고%' OR client_party.party_type_label ILIKE '%청구인%' OR client_party.party_type_label ILIKE '%신청인%' THEN 'plaintiff_side'
    WHEN client_party.party_type_label ILIKE '%피고%' OR client_party.party_type_label ILIKE '%상대방%' OR client_party.party_type_label ILIKE '%피신청인%' THEN 'defendant_side'
    ELSE NULL
  END::TEXT AS our_client_side,
  -- 정렬 우선순위
  1 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id
LEFT JOIN tenant_members tm_assigned ON lc.assigned_to = tm_assigned.id
-- 의뢰인 당사자 조회 (party_name 포함)
LEFT JOIN LATERAL (
  SELECT cp.party_name, cp.party_type_label FROM case_parties cp
  WHERE cp.case_id = cd.case_id AND cp.is_our_client = TRUE
  ORDER BY cp.is_primary DESC NULLS LAST, cp.party_order ASC
  LIMIT 1
) client_party ON TRUE

UNION ALL

-- 3. 상담 (CONSULTATION)
SELECT
  c.id,
  'CONSULTATION'::TEXT AS event_type,
  '상담'::TEXT AS event_type_kr,
  c.request_type::TEXT AS event_subtype,
  ('(상담) ' || c.name)::TEXT AS title,
  c.name::TEXT AS case_name,
  -- 상담의 경우 상담자 이름이 의뢰인명
  c.name::TEXT AS client_name,
  -- 데드라인 타입명 (상담은 NULL)
  NULL::TEXT AS deadline_type_label,
  c.preferred_date::DATE AS event_date,
  COALESCE(c.preferred_time, '00:00')::TEXT AS event_time,
  (c.preferred_date::TEXT || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  c.phone::TEXT AS reference_id,
  NULL::TEXT AS location,
  c.message::TEXT AS description,
  c.status::TEXT AS status,
  NULL::TEXT AS case_id,
  c.tenant_id::TEXT AS tenant_id,
  -- 담당자
  c.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- SCOURT 원본 데이터 (상담은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 의뢰인 측 (해당없음)
  NULL::TEXT AS our_client_side,
  -- 정렬 우선순위
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
  -- 일반일정은 의뢰인명 없음
  NULL::TEXT AS client_name,
  -- 데드라인 타입명 (일반일정은 NULL)
  NULL::TEXT AS deadline_type_label,
  gs.schedule_date AS event_date,
  COALESCE(gs.schedule_time::TEXT, '00:00') AS event_time,
  (gs.schedule_date::TEXT || ' ' || COALESCE(gs.schedule_time::TEXT, '00:00') || ':00')::TIMESTAMP AS event_datetime,
  NULL::TEXT AS reference_id,
  gs.location::TEXT AS location,
  gs.description::TEXT AS description,
  gs.status::TEXT AS status,
  NULL::TEXT AS case_id,
  gs.tenant_id::TEXT AS tenant_id,
  -- 담당자
  gs.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- SCOURT 원본 데이터 (일반일정은 NULL)
  NULL::TEXT AS scourt_type_raw,
  NULL::TEXT AS scourt_result_raw,
  NULL::INTEGER AS hearing_sequence,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 의뢰인 측 (해당없음)
  NULL::TEXT AS our_client_side,
  -- 정렬 우선순위
  CASE
    WHEN gs.schedule_time IS NULL THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs
LEFT JOIN tenant_members tm_assigned ON gs.assigned_to = tm_assigned.id;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정을 통합한 캘린더 뷰 (의뢰인명, 데드라인타입 포함)';

-- ============================================================================
-- 2. upcoming_hearings 뷰 (7일 이내 기일)
-- ============================================================================
CREATE OR REPLACE VIEW upcoming_hearings AS
SELECT
  ch.*,
  lc.case_name,
  lc.court_case_number,
  lc.tenant_id
FROM court_hearings ch
JOIN legal_cases lc ON ch.case_id = lc.id
WHERE ch.status = 'SCHEDULED'
  AND ch.hearing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY ch.hearing_date, ch.location;

COMMENT ON VIEW upcoming_hearings IS '7일 이내 예정된 기일 목록';

-- ============================================================================
-- 3. urgent_deadlines 뷰 (3일 이내 데드라인)
-- ============================================================================
CREATE OR REPLACE VIEW urgent_deadlines AS
SELECT
  cd.*,
  dt.name as deadline_name,
  lc.case_name,
  lc.court_case_number,
  lc.tenant_id
FROM case_deadlines cd
JOIN deadline_types dt ON cd.deadline_type = dt.type
JOIN legal_cases lc ON cd.case_id = lc.id
WHERE cd.status = 'PENDING'
  AND cd.deadline_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
ORDER BY cd.deadline_date;

COMMENT ON VIEW urgent_deadlines IS '3일 이내 마감 데드라인 목록';

-- ============================================================================
-- 4. receivables_summary 뷰 (미수금 요약)
-- ============================================================================
CREATE OR REPLACE VIEW receivables_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.case_name,
  lc.court_case_number,
  lc.status as case_status,
  lc.receivable_grade,
  -- 수임료 합계 (case_parties에서 집계)
  COALESCE((
    SELECT SUM(cp.fee_allocation_amount)
    FROM case_parties cp
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
  ), 0) as total_fee,
  -- 입금 합계
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as total_paid,
  -- 미수금 (수임료 - 입금)
  COALESCE((
    SELECT SUM(cp.fee_allocation_amount)
    FROM case_parties cp
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
  ), 0) - COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as receivable_amount,
  -- 의뢰인 정보
  (
    SELECT cp.party_name
    FROM case_parties cp
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
    LIMIT 1
  ) as client_name,
  (
    SELECT c.phone
    FROM case_parties cp
    JOIN clients c ON cp.client_id = c.id
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
    LIMIT 1
  ) as client_phone
FROM legal_cases lc
WHERE lc.status = 'active';

COMMENT ON VIEW receivables_summary IS '사건별 미수금 요약';

-- ============================================================================
-- 5. monthly_revenue_summary 뷰 (월별 수입 합계)
-- ============================================================================
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT
  p.tenant_id,
  DATE_TRUNC('month', p.payment_date)::DATE as month,
  COALESCE(p.office_location, '미지정') as office_location,
  p.payment_category,
  COUNT(*) as payment_count,
  SUM(p.amount) as total_amount
FROM payments p
WHERE p.amount > 0
GROUP BY p.tenant_id, DATE_TRUNC('month', p.payment_date), p.office_location, p.payment_category
ORDER BY month DESC, office_location, payment_category;

COMMENT ON VIEW monthly_revenue_summary IS '월별 수입 합계 뷰';

-- ============================================================================
-- 6. monthly_expense_summary 뷰 (월별 지출 합계)
-- ============================================================================
CREATE OR REPLACE VIEW monthly_expense_summary AS
SELECT
  e.tenant_id,
  DATE_TRUNC('month', e.expense_date)::DATE as month,
  COALESCE(e.office_location, '미지정') as office_location,
  e.expense_category,
  COUNT(*) as expense_count,
  SUM(e.amount) as total_amount,
  COUNT(CASE WHEN e.is_recurring = true THEN 1 END) as recurring_count,
  SUM(CASE WHEN e.is_recurring = true THEN e.amount ELSE 0 END) as recurring_total
FROM expenses e
GROUP BY e.tenant_id, DATE_TRUNC('month', e.expense_date), e.office_location, e.expense_category
ORDER BY month DESC, office_location, expense_category;

COMMENT ON VIEW monthly_expense_summary IS '월별 지출 합계 뷰';

-- ============================================================================
-- 완료
-- ============================================================================
