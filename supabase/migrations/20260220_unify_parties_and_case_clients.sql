-- ============================================================
-- 스키마 변경: 당사자-대리인 통합 및 의뢰인 관계 분리
-- 1. case_clients 테이블 생성 (M:N 사건-의뢰인 관계)
-- 2. case_parties.representatives JSONB 추가 (대리인 통합)
-- 3. legal_cases 캐시 필드 추가 (primary_client_id, primary_client_name)
-- 4. case_assignees.assignee_role 추가 (담당직원 지원)
-- 5. 레거시 컬럼 삭제 및 case_representatives 테이블 삭제
-- ============================================================

-- ============================================================
-- 1. case_clients 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS case_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- 당사자 연결 (명시적)
  linked_party_id UUID,  -- FK는 아래에서 추가

  -- 의뢰인 정보
  is_primary_client BOOLEAN DEFAULT FALSE,
  retainer_fee BIGINT,
  success_fee_terms TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(case_id, client_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_clients_case ON case_clients(case_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_client ON case_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_case_clients_tenant ON case_clients(tenant_id);

-- ============================================================
-- 2. case_parties 컬럼 수정
-- ============================================================

-- 대리인 JSONB 추가
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS representatives JSONB DEFAULT '[]';

-- ============================================================
-- 3. legal_cases 캐시 필드 추가
-- ============================================================
ALTER TABLE legal_cases
  ADD COLUMN IF NOT EXISTS primary_client_id UUID REFERENCES clients(id),
  ADD COLUMN IF NOT EXISTS primary_client_name TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_primary_client ON legal_cases(primary_client_id);

-- ============================================================
-- 4. 기존 데이터 마이그레이션
-- ============================================================

-- 4-1. case_parties → case_clients (의뢰인 연결 이관)
-- 참고: case_parties에 is_primary, success_fee_terms 컬럼이 없으므로 기본값 사용
INSERT INTO case_clients (
  tenant_id, case_id, client_id, linked_party_id,
  is_primary_client, retainer_fee, notes
)
SELECT
  cp.tenant_id, cp.case_id, cp.client_id, cp.id,
  FALSE,  -- is_primary가 없으므로 기본값 FALSE
  cp.fee_allocation_amount,
  cp.notes
FROM case_parties cp
WHERE cp.is_our_client = TRUE AND cp.client_id IS NOT NULL
ON CONFLICT (case_id, client_id) DO NOTHING;

-- 4-2. case_representatives → case_parties.representatives JSONB
UPDATE case_parties cp
SET representatives = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', cr.representative_name,
    'type_label', cr.representative_type_label,
    'law_firm', cr.law_firm_name,
    'is_our_firm', cr.is_our_firm,
    'scourt_synced', cr.scourt_synced
  ) ORDER BY cr.id), '[]'::jsonb)
  FROM case_representatives cr
  WHERE cr.case_party_id = cp.id
)
WHERE EXISTS (
  SELECT 1 FROM case_representatives cr WHERE cr.case_party_id = cp.id
);

-- 4-3. legal_cases 캐시 필드 초기화
UPDATE legal_cases lc
SET
  primary_client_id = cc.client_id,
  primary_client_name = c.name
FROM case_clients cc
JOIN clients c ON c.id = cc.client_id
WHERE cc.case_id = lc.id AND cc.is_primary_client = TRUE;

-- ============================================================
-- 5. FK 추가 (case_clients.linked_party_id → case_parties)
-- ============================================================
ALTER TABLE case_clients
  ADD CONSTRAINT fk_case_clients_linked_party
  FOREIGN KEY (linked_party_id) REFERENCES case_parties(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_clients_linked_party ON case_clients(linked_party_id);

-- ============================================================
-- 6. 의존 뷰 및 인덱스 삭제 (레거시 컬럼 삭제 전)
-- ============================================================
DROP VIEW IF EXISTS unified_calendar;
DROP VIEW IF EXISTS receivables_summary;
DROP INDEX IF EXISTS idx_case_parties_case_client;
DROP INDEX IF EXISTS idx_case_parties_client_id;
DROP INDEX IF EXISTS idx_case_parties_client;
DROP INDEX IF EXISTS idx_case_parties_is_our_client;

-- ============================================================
-- 6-1. 레거시 컬럼 삭제 (case_parties)
-- ============================================================
ALTER TABLE case_parties
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS is_our_client,
  DROP COLUMN IF EXISTS fee_allocation_amount;
-- 참고: is_primary, success_fee_terms 컬럼은 현재 테이블에 존재하지 않음

-- ============================================================
-- 6-2. unified_calendar 뷰 재생성 (case_clients 기반)
-- ============================================================
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
      WHEN 'HEARING_SENTENCE' THEN '형사 선고'
      WHEN 'HEARING_TRIAL' THEN '공판기일'
      WHEN 'HEARING_EXAMINATION' THEN '증인신문'
      ELSE ch.hearing_type::TEXT
    END,
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
  -- 화상기일 정보
  ch.video_participant_side::TEXT AS video_participant_side,
  -- 당사자 정보 (의뢰인) - 캐시 필드 사용
  lc.primary_client_name::TEXT AS our_client_name,
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
  -- 담당변호사 (사건 담당자)
  lc.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (데드라인에 연결된 당사자 또는 의뢰인) - 캐시 필드 사용
  COALESCE(
    (SELECT cp.party_name FROM case_parties cp WHERE cp.id = cd.case_party_id),
    lc.primary_client_name
  )::TEXT AS our_client_name,
  -- 정렬 우선순위
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
  -- 담당자
  c.assigned_to::TEXT AS attending_lawyer_id,
  tm_assigned.display_name::TEXT AS attending_lawyer_name,
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (상담자 본인)
  c.name::TEXT AS our_client_name,
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
  -- 화상기일 정보 (해당없음)
  NULL::TEXT AS video_participant_side,
  -- 당사자 정보 (해당없음)
  NULL::TEXT AS our_client_name,
  -- 정렬 우선순위
  CASE
    WHEN gs.schedule_time IS NULL THEN 1
    ELSE 2
  END AS sort_priority
FROM general_schedules gs
LEFT JOIN tenant_members tm_assigned ON gs.assigned_to = tm_assigned.id;

COMMENT ON VIEW unified_calendar IS '법원기일, 데드라인, 상담, 일반일정을 통합한 캘린더 뷰 (case_clients 기반)';

-- ============================================================
-- 6-3. receivables_summary 뷰 재생성 (case_clients 기반)
-- ============================================================
CREATE OR REPLACE VIEW receivables_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.case_name,
  lc.court_case_number,
  lc.status as case_status,
  lc.receivable_grade,
  -- 수임료 합계 (case_clients에서 집계)
  COALESCE((
    SELECT SUM(cc.retainer_fee)
    FROM case_clients cc
    WHERE cc.case_id = lc.id
  ), 0) as total_fee,
  -- 입금 합계
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as total_paid,
  -- 미수금 (수임료 - 입금)
  COALESCE((
    SELECT SUM(cc.retainer_fee)
    FROM case_clients cc
    WHERE cc.case_id = lc.id
  ), 0) - COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id AND p.amount > 0
  ), 0) as receivable_amount,
  -- 의뢰인 정보 (캐시 필드 사용)
  lc.primary_client_name as client_name,
  (
    SELECT c.phone
    FROM case_clients cc
    JOIN clients c ON cc.client_id = c.id
    WHERE cc.case_id = lc.id AND cc.is_primary_client = true
    LIMIT 1
  ) as client_phone
FROM legal_cases lc
WHERE lc.status = 'active';

COMMENT ON VIEW receivables_summary IS '사건별 미수금 요약 (case_clients 기반)';

-- ============================================================
-- 7. case_representatives 테이블 삭제
-- ============================================================
DROP TABLE IF EXISTS case_representatives;

-- ============================================================
-- 8. case_assignees 확장 (담당직원 지원)
-- ============================================================
ALTER TABLE case_assignees
  ADD COLUMN IF NOT EXISTS assignee_role VARCHAR(20) DEFAULT 'lawyer';
  -- 'lawyer': 담당변호사
  -- 'staff': 담당직원

-- 기존 데이터는 모두 'lawyer'로 설정 (기본값)
UPDATE case_assignees SET assignee_role = 'lawyer' WHERE assignee_role IS NULL;

-- is_primary 제약조건: staff는 is_primary = false 강제
ALTER TABLE case_assignees
  DROP CONSTRAINT IF EXISTS chk_staff_no_primary;
ALTER TABLE case_assignees
  ADD CONSTRAINT chk_staff_no_primary
  CHECK (assignee_role = 'lawyer' OR is_primary = false);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_assignees_role ON case_assignees(assignee_role);

-- ============================================================
-- 9. RLS 정책
-- ============================================================
ALTER TABLE case_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_case_clients" ON case_clients;
CREATE POLICY "tenant_isolation_case_clients" ON case_clients
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- 10. 캐시 동기화 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION sync_primary_client_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- case_clients 변경 시 legal_cases 캐시 업데이트
  UPDATE legal_cases lc
  SET
    primary_client_id = (
      SELECT cc.client_id FROM case_clients cc
      WHERE cc.case_id = lc.id AND cc.is_primary_client = TRUE
      LIMIT 1
    ),
    primary_client_name = (
      SELECT c.name FROM case_clients cc
      JOIN clients c ON c.id = cc.client_id
      WHERE cc.case_id = lc.id AND cc.is_primary_client = TRUE
      LIMIT 1
    ),
    updated_at = NOW()
  WHERE lc.id = COALESCE(NEW.case_id, OLD.case_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_primary_client ON case_clients;
CREATE TRIGGER trigger_sync_primary_client
  AFTER INSERT OR UPDATE OR DELETE ON case_clients
  FOR EACH ROW
  EXECUTE FUNCTION sync_primary_client_cache();

-- ============================================================
-- 11. updated_at 트리거
-- ============================================================
DROP TRIGGER IF EXISTS update_case_clients_updated_at ON case_clients;
CREATE TRIGGER update_case_clients_updated_at
  BEFORE UPDATE ON case_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
