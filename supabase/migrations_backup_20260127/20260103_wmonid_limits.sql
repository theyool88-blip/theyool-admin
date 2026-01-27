-- =====================================================
-- 멀티테넌트 SaaS 시스템 - WMONID 50건 제한
-- 생성일: 2025-12-31
-- 설명: WMONID당 50건 제한을 DB 레벨에서 강제
-- =====================================================

-- =====================================================
-- 1. WMONID 50건 제한 체크 함수
-- =====================================================
CREATE OR REPLACE FUNCTION check_wmonid_case_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_cases INTEGER := 50;  -- WMONID당 최대 사건 수
BEGIN
  -- user_wmonid_id가 없으면 체크하지 않음
  IF NEW.user_wmonid_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 현재 WMONID의 사건 수 조회
  SELECT case_count INTO current_count
  FROM scourt_user_wmonid
  WHERE id = NEW.user_wmonid_id;

  -- 제한 초과 확인
  IF current_count >= max_cases THEN
    RAISE EXCEPTION 'WMONID case limit exceeded. Maximum % cases allowed per WMONID. Current: %',
      max_cases, current_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 코멘트
COMMENT ON FUNCTION check_wmonid_case_limit() IS
  'WMONID당 50건 제한을 체크하는 트리거 함수';

-- =====================================================
-- 2. scourt_profile_cases INSERT 전 트리거
-- =====================================================
DROP TRIGGER IF EXISTS check_wmonid_limit_before_insert ON scourt_profile_cases;

CREATE TRIGGER check_wmonid_limit_before_insert
  BEFORE INSERT ON scourt_profile_cases
  FOR EACH ROW
  WHEN (NEW.user_wmonid_id IS NOT NULL)
  EXECUTE FUNCTION check_wmonid_case_limit();

-- =====================================================
-- 3. WMONID 잔여 용량 확인 함수 (API에서 사용)
-- =====================================================
CREATE OR REPLACE FUNCTION get_wmonid_remaining_capacity(p_wmonid_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
  max_cases INTEGER := 50;
BEGIN
  SELECT case_count INTO current_count
  FROM scourt_user_wmonid
  WHERE id = p_wmonid_id;

  IF current_count IS NULL THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, max_cases - current_count);
END;
$$ LANGUAGE plpgsql STABLE;

-- 코멘트
COMMENT ON FUNCTION get_wmonid_remaining_capacity(UUID) IS
  'WMONID의 남은 사건 등록 용량 반환 (최대 50건)';

-- =====================================================
-- 4. 멤버별 사용 가능한 WMONID 찾기 함수
-- =====================================================
CREATE OR REPLACE FUNCTION find_available_wmonid_for_member(p_member_id UUID)
RETURNS TABLE (
  wmonid_id UUID,
  wmonid VARCHAR(20),
  case_count INTEGER,
  remaining_capacity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id AS wmonid_id,
    w.wmonid,
    w.case_count,
    GREATEST(0, 50 - w.case_count) AS remaining_capacity
  FROM scourt_user_wmonid w
  WHERE w.member_id = p_member_id
    AND w.status = 'active'
    AND w.case_count < 50
  ORDER BY w.case_count ASC  -- 가장 여유있는 WMONID 먼저
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;

-- 코멘트
COMMENT ON FUNCTION find_available_wmonid_for_member(UUID) IS
  '멤버에게 할당된 사용 가능한 WMONID 목록 반환 (50건 미만인 것만)';

-- =====================================================
-- 5. 테넌트별 WMONID 사용 현황 뷰
-- =====================================================
CREATE OR REPLACE VIEW tenant_wmonid_usage AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  tm.id AS member_id,
  tm.display_name AS member_name,
  tm.role AS member_role,
  COUNT(w.id) AS wmonid_count,
  COALESCE(SUM(w.case_count), 0) AS total_cases,
  COALESCE(SUM(GREATEST(0, 50 - w.case_count)), 0) AS total_remaining_capacity,
  COUNT(CASE WHEN w.status = 'active' THEN 1 END) AS active_wmonid_count,
  COUNT(CASE WHEN w.status = 'expiring' THEN 1 END) AS expiring_wmonid_count
FROM tenants t
LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
LEFT JOIN scourt_user_wmonid w ON w.member_id = tm.id
WHERE tm.role IN ('owner', 'admin', 'lawyer')  -- 변호사 역할만
GROUP BY t.id, t.name, tm.id, tm.display_name, tm.role
ORDER BY t.name, tm.display_name;

-- 코멘트
COMMENT ON VIEW tenant_wmonid_usage IS
  '테넌트별/멤버별 WMONID 사용 현황';

-- =====================================================
-- 6. WMONID 자동 할당 함수 (새 사건 등록 시)
-- =====================================================
CREATE OR REPLACE FUNCTION auto_assign_wmonid(p_member_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wmonid_id UUID;
BEGIN
  -- 가장 여유있는 활성 WMONID 찾기
  SELECT id INTO v_wmonid_id
  FROM scourt_user_wmonid
  WHERE member_id = p_member_id
    AND status = 'active'
    AND case_count < 50
  ORDER BY case_count ASC
  LIMIT 1;

  -- 찾지 못하면 NULL 반환 (새 WMONID 발급 필요)
  RETURN v_wmonid_id;
END;
$$ LANGUAGE plpgsql;

-- 코멘트
COMMENT ON FUNCTION auto_assign_wmonid(UUID) IS
  '멤버에게 가장 여유있는 WMONID 자동 할당. 없으면 NULL 반환.';

-- =====================================================
-- 7. WMONID 통계 함수 (대시보드용)
-- =====================================================
CREATE OR REPLACE FUNCTION get_wmonid_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_wmonids INTEGER,
  active_wmonids INTEGER,
  expiring_wmonids INTEGER,
  expired_wmonids INTEGER,
  total_cases INTEGER,
  total_capacity INTEGER,
  remaining_capacity INTEGER,
  usage_percent NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total_wmonids,
    COUNT(CASE WHEN w.status = 'active' THEN 1 END)::INTEGER AS active_wmonids,
    COUNT(CASE WHEN w.status = 'expiring' THEN 1 END)::INTEGER AS expiring_wmonids,
    COUNT(CASE WHEN w.status = 'expired' THEN 1 END)::INTEGER AS expired_wmonids,
    COALESCE(SUM(w.case_count), 0)::INTEGER AS total_cases,
    (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50)::INTEGER AS total_capacity,
    (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50 -
      COALESCE(SUM(CASE WHEN w.status IN ('active', 'expiring') THEN w.case_count ELSE 0 END), 0))::INTEGER AS remaining_capacity,
    CASE
      WHEN COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) > 0
      THEN ROUND(
        COALESCE(SUM(CASE WHEN w.status IN ('active', 'expiring') THEN w.case_count ELSE 0 END), 0)::NUMERIC /
        (COUNT(CASE WHEN w.status IN ('active', 'expiring') THEN 1 END) * 50) * 100,
        2
      )
      ELSE 0
    END AS usage_percent
  FROM scourt_user_wmonid w
  WHERE (p_tenant_id IS NULL OR w.tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- 코멘트
COMMENT ON FUNCTION get_wmonid_stats(UUID) IS
  'WMONID 사용 통계 반환. tenant_id가 NULL이면 전체 통계.';

-- =====================================================
-- 8. WMONID 제한 초과 시 알림용 함수 (선택적)
-- =====================================================
CREATE OR REPLACE FUNCTION notify_wmonid_limit_warning()
RETURNS TRIGGER AS $$
BEGIN
  -- 45건 이상(90%)이면 경고 로그
  IF NEW.case_count >= 45 THEN
    -- 향후 알림 시스템과 연동 가능
    RAISE NOTICE 'WMONID % is reaching capacity: %/50 cases',
      NEW.wmonid, NEW.case_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- UPDATE 시 경고 트리거
DROP TRIGGER IF EXISTS wmonid_limit_warning_trigger ON scourt_user_wmonid;
CREATE TRIGGER wmonid_limit_warning_trigger
  AFTER UPDATE OF case_count ON scourt_user_wmonid
  FOR EACH ROW
  WHEN (NEW.case_count >= 45)
  EXECUTE FUNCTION notify_wmonid_limit_warning();

-- =====================================================
-- 완료
-- =====================================================
