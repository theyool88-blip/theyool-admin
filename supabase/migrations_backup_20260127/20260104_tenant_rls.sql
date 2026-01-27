-- =====================================================
-- 멀티테넌트 SaaS 시스템 - RLS 정책 업데이트
-- 생성일: 2025-12-31
-- 설명: 테넌트 기반 Row Level Security 정책
-- =====================================================

-- =====================================================
-- 1. 헬퍼 함수들
-- =====================================================

-- 현재 사용자의 테넌트 ID 조회
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 코멘트
COMMENT ON FUNCTION get_current_tenant_id() IS
  '현재 로그인한 사용자의 활성 테넌트 ID 반환';

-- 현재 사용자의 멤버 ID 조회
CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS UUID AS $$
  SELECT id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 코멘트
COMMENT ON FUNCTION get_current_member_id() IS
  '현재 로그인한 사용자의 멤버 ID 반환';

-- 현재 사용자의 역할 조회
CREATE OR REPLACE FUNCTION get_current_member_role()
RETURNS VARCHAR AS $$
  SELECT role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 슈퍼 어드민 확인
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 코멘트
COMMENT ON FUNCTION is_super_admin() IS
  '현재 사용자가 슈퍼 어드민인지 확인';

-- 특정 테넌트의 멤버인지 확인
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 특정 역할 이상인지 확인
CREATE OR REPLACE FUNCTION has_role_or_higher(required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  role_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- 슈퍼 어드민은 모든 역할 접근 가능
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 역할 계층: owner(4) > admin(3) > lawyer(2) > staff(1)
  SELECT CASE user_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO role_hierarchy;

  SELECT CASE required_role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'lawyer' THEN 2
    WHEN 'staff' THEN 1
    ELSE 0
  END INTO required_hierarchy;

  RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- 2. tenants 테이블 RLS 정책
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "super_admin_full_access" ON tenants;
DROP POLICY IF EXISTS "members_view_own_tenant" ON tenants;
DROP POLICY IF EXISTS "admin_modify_tenant" ON tenants;
DROP POLICY IF EXISTS "service_role_full_access_tenants" ON tenants;

-- 슈퍼 어드민: 모든 테넌트 접근
CREATE POLICY "super_admin_tenants" ON tenants
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 테넌트 멤버: 자신의 테넌트만 조회
CREATE POLICY "member_view_tenant" ON tenants
  FOR SELECT
  USING (is_tenant_member(id));

-- 테넌트 owner/admin: 자신의 테넌트 수정
CREATE POLICY "admin_update_tenant" ON tenants
  FOR UPDATE
  USING (is_tenant_member(id) AND has_role_or_higher('admin'))
  WITH CHECK (is_tenant_member(id) AND has_role_or_higher('admin'));

-- =====================================================
-- 3. tenant_members 테이블 RLS 정책
-- =====================================================

DROP POLICY IF EXISTS "service_role_full_access_members" ON tenant_members;

-- 슈퍼 어드민: 모든 멤버 접근
CREATE POLICY "super_admin_members" ON tenant_members
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 같은 테넌트 멤버: 조회
CREATE POLICY "member_view_members" ON tenant_members
  FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- 테넌트 admin 이상: 멤버 관리
CREATE POLICY "admin_manage_members" ON tenant_members
  FOR ALL
  USING (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  WITH CHECK (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'));

-- =====================================================
-- 4. clients 테이블 RLS 정책 (기존 정책 대체)
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Service role has full access" ON clients;
DROP POLICY IF EXISTS "Anyone can view all clients" ON clients;
DROP POLICY IF EXISTS "Staff can insert clients" ON clients;
DROP POLICY IF EXISTS "Staff can update clients" ON clients;

-- 슈퍼 어드민 + 테넌트 격리
CREATE POLICY "tenant_clients" ON clients
  FOR ALL
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- =====================================================
-- 5. legal_cases 테이블 RLS 정책 (기존 정책 대체)
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own cases" ON legal_cases;
DROP POLICY IF EXISTS "Users can insert own cases" ON legal_cases;
DROP POLICY IF EXISTS "Users can update own cases" ON legal_cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON legal_cases;

-- 슈퍼 어드민 + 테넌트 격리
CREATE POLICY "tenant_cases" ON legal_cases
  FOR ALL
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- =====================================================
-- 6. consultations 테이블 RLS 정책
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can create consultations" ON consultations;
DROP POLICY IF EXISTS "Authenticated users can view consultations" ON consultations;
DROP POLICY IF EXISTS "Service role has full access to consultations" ON consultations;

-- 공개 INSERT (웹사이트에서 상담 신청)
CREATE POLICY "public_create_consultations" ON consultations
  FOR INSERT
  WITH CHECK (true);

-- 테넌트 격리 조회
CREATE POLICY "tenant_view_consultations" ON consultations
  FOR SELECT
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- 테넌트 수정/삭제
CREATE POLICY "tenant_manage_consultations" ON consultations
  FOR UPDATE
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

CREATE POLICY "tenant_delete_consultations" ON consultations
  FOR DELETE
  USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- =====================================================
-- 7. payments 테이블 RLS 정책
-- =====================================================

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Service role has full access to payments" ON payments;

-- 슈퍼 어드민 + 테넌트 격리
CREATE POLICY "tenant_payments" ON payments
  FOR ALL
  USING (is_super_admin() OR tenant_id = get_current_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id());

-- =====================================================
-- 8. expenses 테이블 RLS 정책 (admin 이상만 접근)
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "관리자만 expenses 조회" ON expenses;
DROP POLICY IF EXISTS "관리자만 expenses 추가" ON expenses;
DROP POLICY IF EXISTS "관리자만 expenses 수정" ON expenses;
DROP POLICY IF EXISTS "관리자만 expenses 삭제" ON expenses;

-- 테넌트 격리 + admin 이상
CREATE POLICY "tenant_admin_expenses" ON expenses
  FOR ALL
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- =====================================================
-- 9. court_hearings 테이블 RLS 정책 (사건을 통한 간접 격리)
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "court_hearings_select_own_cases" ON court_hearings;
DROP POLICY IF EXISTS "court_hearings_insert_own_cases" ON court_hearings;
DROP POLICY IF EXISTS "court_hearings_update_own_cases" ON court_hearings;
DROP POLICY IF EXISTS "court_hearings_delete_own_cases" ON court_hearings;

-- 슈퍼 어드민 + 사건 기반 테넌트 격리
CREATE POLICY "tenant_court_hearings" ON court_hearings
  FOR ALL
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = court_hearings.case_id
        AND legal_cases.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = court_hearings.case_id
        AND legal_cases.tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- 10. case_deadlines 테이블 RLS 정책 (사건을 통한 간접 격리)
-- =====================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "case_deadlines_select_own_cases" ON case_deadlines;
DROP POLICY IF EXISTS "case_deadlines_insert_own_cases" ON case_deadlines;
DROP POLICY IF EXISTS "case_deadlines_update_own_cases" ON case_deadlines;
DROP POLICY IF EXISTS "case_deadlines_delete_own_cases" ON case_deadlines;

-- 슈퍼 어드민 + 사건 기반 테넌트 격리
CREATE POLICY "tenant_case_deadlines" ON case_deadlines
  FOR ALL
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = case_deadlines.case_id
        AND legal_cases.tenant_id = get_current_tenant_id()
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM legal_cases
      WHERE legal_cases.id = case_deadlines.case_id
        AND legal_cases.tenant_id = get_current_tenant_id()
    )
  );

-- =====================================================
-- 11. scourt 관련 테이블 RLS 정책
-- =====================================================

-- scourt_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profiles') THEN
    DROP POLICY IF EXISTS "service_role_scourt_profiles" ON scourt_profiles;

    EXECUTE 'CREATE POLICY "tenant_scourt_profiles" ON scourt_profiles
      FOR ALL
      USING (is_super_admin() OR tenant_id = get_current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- scourt_user_wmonid
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_user_wmonid') THEN
    DROP POLICY IF EXISTS "service_role_scourt_user_wmonid" ON scourt_user_wmonid;

    EXECUTE 'CREATE POLICY "tenant_scourt_user_wmonid" ON scourt_user_wmonid
      FOR ALL
      USING (is_super_admin() OR tenant_id = get_current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- scourt_profile_cases
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profile_cases') THEN
    DROP POLICY IF EXISTS "service_role_scourt_profile_cases" ON scourt_profile_cases;

    EXECUTE 'CREATE POLICY "tenant_scourt_profile_cases" ON scourt_profile_cases
      FOR ALL
      USING (is_super_admin() OR tenant_id = get_current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- =====================================================
-- 12. bookings 테이블 RLS 정책
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    DROP POLICY IF EXISTS "Service role has full access to bookings" ON bookings;

    EXECUTE 'CREATE POLICY "tenant_bookings" ON bookings
      FOR ALL
      USING (is_super_admin() OR tenant_id = get_current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- =====================================================
-- 13. general_schedules 테이블 RLS 정책
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'general_schedules') THEN
    DROP POLICY IF EXISTS "general_schedules_select" ON general_schedules;
    DROP POLICY IF EXISTS "general_schedules_insert" ON general_schedules;
    DROP POLICY IF EXISTS "general_schedules_update" ON general_schedules;
    DROP POLICY IF EXISTS "general_schedules_delete" ON general_schedules;

    EXECUTE 'CREATE POLICY "tenant_general_schedules" ON general_schedules
      FOR ALL
      USING (is_super_admin() OR tenant_id = get_current_tenant_id())
      WITH CHECK (is_super_admin() OR tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- =====================================================
-- 14. 슈퍼 어드민 테이블 RLS 정책
-- =====================================================

DROP POLICY IF EXISTS "service_role_full_access_super_admins" ON super_admins;

-- 슈퍼 어드민만 조회 가능
CREATE POLICY "super_admin_view_super_admins" ON super_admins
  FOR SELECT
  USING (is_super_admin());

-- 슈퍼 어드민만 관리 가능
CREATE POLICY "super_admin_manage_super_admins" ON super_admins
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================================================
-- 15. 테넌트 초대 RLS 정책
-- =====================================================

DROP POLICY IF EXISTS "service_role_full_access_invitations" ON tenant_invitations;

-- 테넌트 admin 이상: 초대 관리
CREATE POLICY "admin_manage_invitations" ON tenant_invitations
  FOR ALL
  USING (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  )
  WITH CHECK (
    is_super_admin() OR
    (tenant_id = get_current_tenant_id() AND has_role_or_higher('admin'))
  );

-- 초대 토큰으로 조회 (가입 시 사용)
CREATE POLICY "public_view_invitation_by_token" ON tenant_invitations
  FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- =====================================================
-- 완료
-- =====================================================
