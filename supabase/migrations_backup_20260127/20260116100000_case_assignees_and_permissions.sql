-- ============================================================================
-- 사건 담당변호사 다중 지정 및 권한 시스템
-- 생성일: 2026-01-16
-- 설명:
--   1. case_assignees 테이블 (사건 담당변호사 다중 지정)
--   2. staff_lawyer_assignments 테이블 (직원-변호사 매핑)
--   3. 기존 assigned_to 데이터 마이그레이션
--   4. is_primary 변경 시 assigned_to 동기화 트리거
--   5. 권한 체크 함수 추가
--   6. RLS 정책 개선 (역할 기반 접근 제어)
-- ============================================================================

-- ============================================================================
-- 1. case_assignees 테이블 (사건 담당변호사 다중 지정)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,  -- 주 담당 변호사
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 한 사건에 한 멤버는 한 번만 지정
  UNIQUE(case_id, member_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_assignees_tenant_id ON case_assignees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_assignees_case_id ON case_assignees(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignees_member_id ON case_assignees(member_id);
CREATE INDEX IF NOT EXISTS idx_case_assignees_is_primary ON case_assignees(is_primary) WHERE is_primary = true;

-- 코멘트
COMMENT ON TABLE case_assignees IS '사건 담당 변호사 (다중 지정 가능)';
COMMENT ON COLUMN case_assignees.is_primary IS '주 담당 변호사 여부 (legal_cases.assigned_to와 동기화)';

-- ============================================================================
-- 2. staff_lawyer_assignments 테이블 (직원-변호사 매핑)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_lawyer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  lawyer_member_id UUID NOT NULL REFERENCES tenant_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 같은 직원-변호사 쌍은 한 번만
  UNIQUE(staff_member_id, lawyer_member_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_staff_lawyer_assignments_tenant_id ON staff_lawyer_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_lawyer_assignments_staff_member_id ON staff_lawyer_assignments(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_lawyer_assignments_lawyer_member_id ON staff_lawyer_assignments(lawyer_member_id);

-- 코멘트
COMMENT ON TABLE staff_lawyer_assignments IS '직원-변호사 담당 매핑';
COMMENT ON COLUMN staff_lawyer_assignments.staff_member_id IS '직원 (role=staff)';
COMMENT ON COLUMN staff_lawyer_assignments.lawyer_member_id IS '담당 변호사 (role=lawyer)';

-- ============================================================================
-- 3. 트리거: tenant_id 자동 설정
-- ============================================================================
DROP TRIGGER IF EXISTS set_case_assignees_tenant_id ON case_assignees;
CREATE TRIGGER set_case_assignees_tenant_id
  BEFORE INSERT ON case_assignees
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS set_staff_lawyer_assignments_tenant_id ON staff_lawyer_assignments;
CREATE TRIGGER set_staff_lawyer_assignments_tenant_id
  BEFORE INSERT ON staff_lawyer_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id_on_insert();

-- ============================================================================
-- 4. 기존 assigned_to 데이터를 case_assignees로 마이그레이션
-- ============================================================================
INSERT INTO case_assignees (tenant_id, case_id, member_id, is_primary)
SELECT
  lc.tenant_id,
  lc.id AS case_id,
  lc.assigned_to AS member_id,
  true AS is_primary
FROM legal_cases lc
WHERE lc.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM case_assignees ca
    WHERE ca.case_id = lc.id AND ca.member_id = lc.assigned_to
  );

-- ============================================================================
-- 5. is_primary 변경 시 legal_cases.assigned_to 동기화 트리거
-- ============================================================================

-- 트리거 함수: case_assignees에서 is_primary 변경 시 legal_cases.assigned_to 업데이트
CREATE OR REPLACE FUNCTION sync_assigned_to_on_primary_change()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT 또는 UPDATE로 is_primary = true 설정 시
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_primary = true THEN
    -- 다른 assignee의 is_primary를 false로 설정
    UPDATE case_assignees
    SET is_primary = false
    WHERE case_id = NEW.case_id
      AND id != NEW.id
      AND is_primary = true;

    -- legal_cases.assigned_to 업데이트
    UPDATE legal_cases
    SET assigned_to = NEW.member_id
    WHERE id = NEW.case_id;
  END IF;

  -- DELETE 또는 is_primary = false로 변경 시
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_primary = false AND OLD.is_primary = true) THEN
    -- 삭제/변경된 row가 primary였다면, 다른 assignee 중 하나를 primary로 설정
    DECLARE
      v_case_id UUID;
      v_next_primary_member UUID;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        v_case_id := OLD.case_id;
      ELSE
        v_case_id := NEW.case_id;
      END IF;

      -- 다음 primary 후보 선택 (가장 먼저 생성된 assignee)
      SELECT member_id INTO v_next_primary_member
      FROM case_assignees
      WHERE case_id = v_case_id AND (TG_OP != 'DELETE' OR id != OLD.id)
      ORDER BY created_at
      LIMIT 1;

      IF v_next_primary_member IS NOT NULL THEN
        UPDATE case_assignees
        SET is_primary = true
        WHERE case_id = v_case_id AND member_id = v_next_primary_member;

        UPDATE legal_cases
        SET assigned_to = v_next_primary_member
        WHERE id = v_case_id;
      ELSE
        -- assignee가 없으면 assigned_to를 NULL로 설정
        UPDATE legal_cases
        SET assigned_to = NULL
        WHERE id = v_case_id;
      END IF;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_assigned_to_on_primary_change() IS
  'case_assignees.is_primary 변경 시 legal_cases.assigned_to 자동 동기화';

-- 트리거 생성
DROP TRIGGER IF EXISTS sync_assigned_to_trigger ON case_assignees;
CREATE TRIGGER sync_assigned_to_trigger
  AFTER INSERT OR UPDATE OR DELETE ON case_assignees
  FOR EACH ROW
  EXECUTE FUNCTION sync_assigned_to_on_primary_change();

-- ============================================================================
-- 6. legal_cases.assigned_to 변경 시 case_assignees 동기화 트리거
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_case_assignees_on_assigned_to_change()
RETURNS TRIGGER AS $$
BEGIN
  -- assigned_to가 변경된 경우
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- 새 assigned_to가 NULL이 아닌 경우
    IF NEW.assigned_to IS NOT NULL THEN
      -- 기존 primary assignee의 is_primary를 false로
      UPDATE case_assignees
      SET is_primary = false
      WHERE case_id = NEW.id AND is_primary = true;

      -- 새 assigned_to를 case_assignees에 추가 (없으면) 및 primary 설정
      INSERT INTO case_assignees (tenant_id, case_id, member_id, is_primary)
      VALUES (NEW.tenant_id, NEW.id, NEW.assigned_to, true)
      ON CONFLICT (case_id, member_id)
      DO UPDATE SET is_primary = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_case_assignees_on_assigned_to_change() IS
  'legal_cases.assigned_to 변경 시 case_assignees 자동 동기화';

-- 트리거 생성
DROP TRIGGER IF EXISTS sync_case_assignees_trigger ON legal_cases;
CREATE TRIGGER sync_case_assignees_trigger
  AFTER UPDATE OF assigned_to ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION sync_case_assignees_on_assigned_to_change();

-- ============================================================================
-- 7. 권한 체크 함수
-- ============================================================================

-- 현재 사용자가 특정 권한을 가지고 있는지 확인
-- permissions JSONB 필드에서 권한 체크
CREATE OR REPLACE FUNCTION has_permission(p_permission VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_permissions JSONB;
  v_role VARCHAR;
BEGIN
  -- 슈퍼 어드민은 모든 권한
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- 현재 사용자의 역할과 권한 조회
  SELECT role, permissions INTO v_role, v_permissions
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- owner/admin은 모든 권한
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 권한 체크 (JSONB 배열에서 검색)
  -- 예: permissions = '["finance:view", "client:manage"]'
  IF v_permissions IS NOT NULL AND v_permissions @> to_jsonb(p_permission) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION has_permission(VARCHAR) IS '현재 사용자가 특정 권한을 가지고 있는지 확인';

-- 현재 사용자가 특정 사건에 접근 권한이 있는지 확인
CREATE OR REPLACE FUNCTION can_access_case(p_case_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
  v_member_id UUID;
  v_tenant_id UUID;
  v_case_tenant_id UUID;
BEGIN
  -- 슈퍼 어드민은 모든 사건 접근
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- 현재 사용자 정보 조회
  SELECT id, role, tenant_id INTO v_member_id, v_role, v_tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 사건의 테넌트 확인
  SELECT tenant_id INTO v_case_tenant_id
  FROM legal_cases
  WHERE id = p_case_id;

  -- 다른 테넌트의 사건은 접근 불가
  IF v_case_tenant_id IS NULL OR v_case_tenant_id != v_tenant_id THEN
    RETURN FALSE;
  END IF;

  -- owner/admin은 모든 사건 접근
  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- case:all 권한이 있으면 모든 사건 접근
  IF has_permission('case:all') THEN
    RETURN TRUE;
  END IF;

  -- lawyer: 본인이 담당하는 사건만 접근
  IF v_role = 'lawyer' THEN
    RETURN EXISTS (
      SELECT 1 FROM case_assignees
      WHERE case_id = p_case_id AND member_id = v_member_id
    );
  END IF;

  -- staff: 담당 변호사들의 사건만 접근
  IF v_role = 'staff' THEN
    RETURN EXISTS (
      SELECT 1
      FROM staff_lawyer_assignments sla
      JOIN case_assignees ca ON ca.member_id = sla.lawyer_member_id
      WHERE sla.staff_member_id = v_member_id
        AND ca.case_id = p_case_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION can_access_case(UUID) IS '현재 사용자가 특정 사건에 접근 권한이 있는지 확인';

-- 현재 사용자가 접근 가능한 변호사 ID 목록 반환
CREATE OR REPLACE FUNCTION get_accessible_lawyer_ids()
RETURNS UUID[] AS $$
DECLARE
  v_role VARCHAR;
  v_member_id UUID;
  v_lawyer_ids UUID[];
BEGIN
  -- 슈퍼 어드민은 모든 변호사 접근
  IF is_super_admin() THEN
    RETURN ARRAY(
      SELECT id FROM tenant_members
      WHERE tenant_id = get_current_tenant_id()
        AND role IN ('owner', 'admin', 'lawyer')
        AND status = 'active'
    );
  END IF;

  -- 현재 사용자 정보 조회
  SELECT id, role INTO v_member_id, v_role
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- owner/admin은 모든 변호사 접근
  IF v_role IN ('owner', 'admin') THEN
    RETURN ARRAY(
      SELECT id FROM tenant_members
      WHERE tenant_id = get_current_tenant_id()
        AND role IN ('owner', 'admin', 'lawyer')
        AND status = 'active'
    );
  END IF;

  -- lawyer: 본인만
  IF v_role = 'lawyer' THEN
    RETURN ARRAY[v_member_id];
  END IF;

  -- staff: 담당 변호사들
  IF v_role = 'staff' THEN
    RETURN ARRAY(
      SELECT lawyer_member_id
      FROM staff_lawyer_assignments
      WHERE staff_member_id = v_member_id
    );
  END IF;

  RETURN ARRAY[]::UUID[];
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_accessible_lawyer_ids() IS '현재 사용자가 접근 가능한 변호사 ID 목록';

-- ============================================================================
-- 8. RLS 정책 설정
-- ============================================================================

-- case_assignees RLS 활성화
ALTER TABLE case_assignees ENABLE ROW LEVEL SECURITY;

-- case_assignees: 테넌트 격리 + 역할 기반 접근
CREATE POLICY "case_assignees_select_policy" ON case_assignees
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND can_access_case(case_id)
    )
  );

CREATE POLICY "case_assignees_insert_policy" ON case_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
    OR (
      tenant_id = get_current_tenant_id()
      AND can_access_case(case_id)
    )
  );

CREATE POLICY "case_assignees_update_policy" ON case_assignees
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
  );

CREATE POLICY "case_assignees_delete_policy" ON case_assignees
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
  );

-- staff_lawyer_assignments RLS 활성화
ALTER TABLE staff_lawyer_assignments ENABLE ROW LEVEL SECURITY;

-- staff_lawyer_assignments: 테넌트 격리 + admin 이상만 관리
CREATE POLICY "staff_lawyer_assignments_select_policy" ON staff_lawyer_assignments
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR tenant_id = get_current_tenant_id()
  );

CREATE POLICY "staff_lawyer_assignments_insert_policy" ON staff_lawyer_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
  );

CREATE POLICY "staff_lawyer_assignments_update_policy" ON staff_lawyer_assignments
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
  );

CREATE POLICY "staff_lawyer_assignments_delete_policy" ON staff_lawyer_assignments
  FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR (
      tenant_id = get_current_tenant_id()
      AND has_role_or_higher('admin')
    )
  );

-- ============================================================================
-- 완료
-- ============================================================================
