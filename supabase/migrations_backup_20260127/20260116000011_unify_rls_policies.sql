-- =====================================================
-- 20260116000002_unify_rls_policies.sql
-- RLS 정책 패턴 통일
-- 작성일: 2026-01-16
-- 설명: 레거시 패턴 current_setting('app.current_tenant_id')을
--       현대적 패턴 get_current_tenant_id()로 통일
-- =====================================================

-- =====================================================
-- 1. case_parties 테이블 RLS 정책 수정
-- =====================================================
DROP POLICY IF EXISTS "case_parties_tenant_isolation" ON case_parties;
DROP POLICY IF EXISTS "case_parties_select_policy" ON case_parties;
DROP POLICY IF EXISTS "case_parties_insert_policy" ON case_parties;
DROP POLICY IF EXISTS "case_parties_update_policy" ON case_parties;
DROP POLICY IF EXISTS "case_parties_delete_policy" ON case_parties;

CREATE POLICY "case_parties_select_policy" ON case_parties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_parties.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "case_parties_insert_policy" ON case_parties
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_parties.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "case_parties_update_policy" ON case_parties
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_parties.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "case_parties_delete_policy" ON case_parties
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = case_parties.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

-- =====================================================
-- 2. case_representatives 테이블 RLS 정책 수정
-- case_representatives는 tenant_id를 직접 가지고 있음
-- =====================================================
DROP POLICY IF EXISTS "case_representatives_tenant_isolation" ON case_representatives;
DROP POLICY IF EXISTS "case_representatives_select_policy" ON case_representatives;
DROP POLICY IF EXISTS "case_representatives_insert_policy" ON case_representatives;
DROP POLICY IF EXISTS "case_representatives_update_policy" ON case_representatives;
DROP POLICY IF EXISTS "case_representatives_delete_policy" ON case_representatives;

CREATE POLICY "case_representatives_select_policy" ON case_representatives
  FOR SELECT
  USING (
    tenant_id = get_current_tenant_id() OR is_super_admin()
  );

CREATE POLICY "case_representatives_insert_policy" ON case_representatives
  FOR INSERT
  WITH CHECK (
    tenant_id = get_current_tenant_id() OR is_super_admin()
  );

CREATE POLICY "case_representatives_update_policy" ON case_representatives
  FOR UPDATE
  USING (
    tenant_id = get_current_tenant_id() OR is_super_admin()
  );

CREATE POLICY "case_representatives_delete_policy" ON case_representatives
  FOR DELETE
  USING (
    tenant_id = get_current_tenant_id() OR is_super_admin()
  );

-- =====================================================
-- 3. dismissed_related_cases 테이블 RLS 정책 수정
-- dismissed_related_cases는 tenant_id가 없으므로 case_id로 조인
-- =====================================================
DROP POLICY IF EXISTS "dismissed_related_cases_tenant_isolation" ON dismissed_related_cases;
DROP POLICY IF EXISTS "dismissed_related_cases_select_policy" ON dismissed_related_cases;
DROP POLICY IF EXISTS "dismissed_related_cases_insert_policy" ON dismissed_related_cases;
DROP POLICY IF EXISTS "dismissed_related_cases_update_policy" ON dismissed_related_cases;
DROP POLICY IF EXISTS "dismissed_related_cases_delete_policy" ON dismissed_related_cases;

CREATE POLICY "dismissed_related_cases_select_policy" ON dismissed_related_cases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = dismissed_related_cases.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "dismissed_related_cases_insert_policy" ON dismissed_related_cases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = dismissed_related_cases.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "dismissed_related_cases_update_policy" ON dismissed_related_cases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = dismissed_related_cases.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

CREATE POLICY "dismissed_related_cases_delete_policy" ON dismissed_related_cases
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM legal_cases lc
      WHERE lc.id = dismissed_related_cases.case_id
      AND (lc.tenant_id = get_current_tenant_id() OR is_super_admin())
    )
  );

-- =====================================================
-- 완료
-- =====================================================
