-- ============================================================================
-- 보안 취약점 수정 마이그레이션
-- 생성일: 2026-01-17
-- 설명: Cross-tenant 권한 상승, 초대 데이터 노출, 환불 계산 누락 등 수정
-- ============================================================================

BEGIN;

-- ============================================================================
-- FIX 1: get_current_tenant_id() - ORDER BY 추가로 결정적 선택
-- 문제: LIMIT 1 without ORDER BY는 비결정적 결과 반환
-- 해결: created_at ASC로 가장 먼저 가입한 테넌트 반환
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC  -- 가장 먼저 가입한 테넌트 반환 (결정적)
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_tenant_id() IS '현재 로그인한 사용자의 활성 테넌트 ID 반환 (가장 먼저 가입한 테넌트)';

-- ============================================================================
-- FIX 2: get_current_member_id() - ORDER BY 추가
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS UUID AS $$
  SELECT id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_member_id() IS '현재 로그인한 사용자의 멤버 ID 반환 (가장 먼저 가입한 테넌트)';

-- ============================================================================
-- FIX 3: get_current_member_role() - ORDER BY 추가
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_member_role()
RETURNS VARCHAR AS $$
  SELECT role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_current_member_role() IS '현재 로그인한 사용자의 역할 반환 (가장 먼저 가입한 테넌트)';

-- ============================================================================
-- FIX 4: has_role_or_higher() - 현재 테넌트 컨텍스트 사용
-- 문제: 테넌트 필터 없이 아무 테넌트의 역할로 권한 검사
-- 해결: get_current_tenant_id()로 현재 테넌트 역할만 확인
-- ============================================================================
CREATE OR REPLACE FUNCTION has_role_or_higher(required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  current_tenant UUID;
  role_hierarchy INTEGER;
  required_hierarchy INTEGER;
BEGIN
  -- 슈퍼 어드민은 모든 역할 접근 가능
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- 현재 테넌트 ID 가져오기 (결정적)
  current_tenant := get_current_tenant_id();

  IF current_tenant IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 현재 테넌트에서의 역할만 확인
  SELECT role INTO user_role
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND tenant_id = current_tenant  -- 테넌트 범위 추가!
    AND status = 'active'
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

COMMENT ON FUNCTION has_role_or_higher(VARCHAR) IS '현재 사용자가 현재 테넌트에서 특정 역할 이상인지 확인 (cross-tenant 권한 상승 방지)';

-- ============================================================================
-- FIX 5: tenant_invitations SELECT 정책 - 테넌트 격리 추가
-- 문제: 모든 authenticated 사용자가 모든 테넌트의 pending 초대 조회 가능
-- 해결: 자신의 테넌트이거나 자신의 이메일로 초대된 경우만 허용
-- ============================================================================
DROP POLICY IF EXISTS "public_view_invitation_by_token" ON tenant_invitations;

CREATE POLICY "secure_view_invitation" ON tenant_invitations
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR
    tenant_id = get_current_tenant_id() OR
    -- 자신의 이메일로 초대된 경우만 허용 (가입 시 사용)
    (email = auth.jwt()->>'email' AND status = 'pending' AND expires_at > NOW())
  );

COMMENT ON POLICY "secure_view_invitation" ON tenant_invitations
  IS '초대 조회: 슈퍼어드민, 자신의 테넌트, 또는 자신에게 온 초대만 허용';

-- ============================================================================
-- FIX 6: consultations INSERT 정책 - tenant_id 검증 트리거
-- 문제: WITH CHECK(true)로 임의 tenant_id 삽입 가능
-- 해결: 유효한 tenant_id인지 검증하는 트리거 추가
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_consultation_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- tenant_id가 유효한지 확인
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Invalid tenant_id: %', NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_consultation_tenant() IS '상담 INSERT 시 유효한 tenant_id인지 검증';

DROP TRIGGER IF EXISTS trg_validate_consultation_tenant ON consultations;
CREATE TRIGGER trg_validate_consultation_tenant
  BEFORE INSERT ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION validate_consultation_tenant();

-- ============================================================================
-- FIX 7: bookings INSERT 정책 - tenant_id 검증 트리거
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_booking_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- tenant_id가 유효한지 확인
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'Invalid tenant_id: %', NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_booking_tenant() IS '예약 INSERT 시 유효한 tenant_id인지 검증';

DROP TRIGGER IF EXISTS trg_validate_booking_tenant ON bookings;
CREATE TRIGGER trg_validate_booking_tenant
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_tenant();

-- ============================================================================
-- FIX 8: receivables_summary 뷰 - 환불(음수) 포함
-- 문제: amount > 0 필터로 환불(음수 금액) 무시됨
-- 해결: 필터 제거하여 총 입금액에 환불 반영
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
  -- 입금 합계 (환불 포함 - amount > 0 필터 제거)
  COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id
  ), 0) as total_paid,
  -- 미수금 (수임료 - 입금)
  COALESCE((
    SELECT SUM(cp.fee_allocation_amount)
    FROM case_parties cp
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
  ), 0) - COALESCE((
    SELECT SUM(p.amount)
    FROM payments p
    WHERE p.case_id = lc.id  -- amount > 0 필터 제거!
  ), 0) as receivable_amount,
  -- 의뢰인 정보 (결정적 선택)
  (
    SELECT cp.party_name
    FROM case_parties cp
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
    ORDER BY cp.created_at ASC
    LIMIT 1
  ) as client_name,
  (
    SELECT c.phone
    FROM case_parties cp
    JOIN clients c ON cp.client_id = c.id
    WHERE cp.case_id = lc.id AND cp.is_our_client = true
    ORDER BY cp.created_at ASC
    LIMIT 1
  ) as client_phone
FROM legal_cases lc
WHERE lc.status = 'active';

COMMENT ON VIEW receivables_summary IS '사건별 미수금 요약 (환불 반영)';

-- ============================================================================
-- FIX 9: case_payment_summary 뷰 - 환불 분리 표시
-- 문제: 환불 금액이 따로 표시되지 않음
-- 해결: total_payments(입금), total_refunds(환불) 분리
-- ============================================================================
CREATE OR REPLACE VIEW case_payment_summary AS
SELECT
  lc.id as case_id,
  lc.tenant_id,
  lc.court_case_number,
  lc.case_name,
  COUNT(p.id) as payment_count,
  -- 순 금액 (환불 포함)
  COALESCE(SUM(p.amount), 0) as total_amount,
  -- 양수 입금만 (정상 결제)
  COALESCE(SUM(CASE WHEN p.amount > 0 THEN p.amount ELSE 0 END), 0) as total_payments,
  -- 환불 금액 (음수의 절대값)
  COALESCE(SUM(CASE WHEN p.amount < 0 THEN ABS(p.amount) ELSE 0 END), 0) as total_refunds,
  -- 레거시 호환: 기본 카테고리별 금액
  COALESCE(SUM(CASE WHEN p.payment_category = '착수금' THEN p.amount ELSE 0 END), 0) as retainer_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '잔금' THEN p.amount ELSE 0 END), 0) as balance_amount,
  COALESCE(SUM(CASE WHEN p.payment_category = '성공보수' THEN p.amount ELSE 0 END), 0) as success_fee_amount,
  MIN(p.payment_date) as first_payment_date,
  MAX(p.payment_date) as last_payment_date
FROM legal_cases lc
LEFT JOIN payments p ON lc.id = p.case_id
GROUP BY lc.id, lc.tenant_id, lc.court_case_number, lc.case_name;

COMMENT ON VIEW case_payment_summary IS '사건별 입금 합계 뷰 (환불 분리 표시)';

COMMIT;
