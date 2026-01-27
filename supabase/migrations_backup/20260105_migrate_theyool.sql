-- =====================================================
-- 멀티테넌트 SaaS 시스템 - 기존 더율 데이터 마이그레이션
-- 생성일: 2025-12-31
-- 설명: 기존 법무법인 더율 데이터를 첫 번째 테넌트로 마이그레이션
-- 주의: 이 마이그레이션은 되돌릴 수 없음. 백업 후 실행할 것.
-- =====================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_owner_id UUID;
  v_member_id UUID;
  v_migrated_count INTEGER;
BEGIN
  -- =====================================================
  -- 1. 기존 관리자 찾기 (users_profiles에서)
  -- =====================================================
  SELECT auth_user_id INTO v_owner_id
  FROM users_profiles
  WHERE role = 'admin' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No admin user found in users_profiles. Checking auth.users...';

    -- auth.users에서 첫 번째 사용자를 관리자로 설정
    SELECT id INTO v_owner_id
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'No users found. Cannot proceed with migration.';
    END IF;
  END IF;

  RAISE NOTICE 'Owner user ID: %', v_owner_id;

  -- =====================================================
  -- 2. 법무법인 더율 테넌트 생성
  -- =====================================================
  INSERT INTO tenants (
    name,
    slug,
    type,
    phone,
    email,
    address,
    has_homepage,
    homepage_subdomain,
    plan,
    plan_started_at,
    features,
    status,
    is_verified
  )
  VALUES (
    '법무법인 더율',
    'theyool',
    'firm',
    '02-123-4567',  -- 실제 번호로 수정 필요
    'admin@theyool.kr',  -- 실제 이메일로 수정 필요
    '서울특별시',  -- 실제 주소로 수정 필요
    true,  -- 홈페이지 연결됨
    'theyool',
    'enterprise',  -- 기존 사용자이므로 엔터프라이즈
    NOW(),
    '{
      "maxCases": -1,
      "maxClients": -1,
      "maxMembers": -1,
      "scourtSync": true,
      "clientPortal": true,
      "homepage": true
    }'::jsonb,
    'active',
    true
  )
  RETURNING id INTO v_tenant_id;

  RAISE NOTICE 'Created tenant: % (ID: %)', '법무법인 더율', v_tenant_id;

  -- =====================================================
  -- 3. 기존 사용자들을 tenant_members로 마이그레이션
  -- =====================================================

  -- 먼저 관리자(owner)를 추가
  INSERT INTO tenant_members (
    tenant_id,
    user_id,
    role,
    display_name,
    status,
    joined_at
  )
  VALUES (
    v_tenant_id,
    v_owner_id,
    'owner',
    '관리자',  -- 실제 이름으로 수정 필요
    'active',
    NOW()
  )
  RETURNING id INTO v_member_id;

  RAISE NOTICE 'Created owner member: %', v_member_id;

  -- 나머지 users_profiles 사용자들 추가 (owner 제외)
  INSERT INTO tenant_members (
    tenant_id,
    user_id,
    role,
    display_name,
    status,
    joined_at
  )
  SELECT
    v_tenant_id,
    up.auth_user_id,
    CASE
      WHEN up.role = 'admin' THEN 'admin'
      WHEN up.role = 'lawyer' THEN 'lawyer'
      ELSE 'staff'
    END,
    COALESCE(up.name, '직원'),
    CASE WHEN up.is_active THEN 'active' ELSE 'suspended' END,
    COALESCE(up.created_at, NOW())
  FROM users_profiles up
  WHERE up.auth_user_id != v_owner_id
    AND up.auth_user_id IS NOT NULL
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % additional members', v_migrated_count;

  -- =====================================================
  -- 4. 슈퍼 어드민 등록 (현재 관리자)
  -- =====================================================
  INSERT INTO super_admins (user_id, created_by)
  VALUES (v_owner_id, v_owner_id)
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Registered super admin: %', v_owner_id;

  -- =====================================================
  -- 5. 기존 데이터에 tenant_id 설정
  -- =====================================================

  -- clients
  UPDATE clients SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % clients', v_migrated_count;

  -- legal_cases
  UPDATE legal_cases SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % legal_cases', v_migrated_count;

  -- consultations
  UPDATE consultations SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % consultations', v_migrated_count;

  -- payments
  UPDATE payments SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % payments', v_migrated_count;

  -- expenses
  UPDATE expenses SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % expenses', v_migrated_count;

  -- bookings (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    UPDATE bookings SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % bookings', v_migrated_count;
  END IF;

  -- general_schedules (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'general_schedules') THEN
    UPDATE general_schedules SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % general_schedules', v_migrated_count;
  END IF;

  -- consultation_weekly_schedule (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultation_weekly_schedule') THEN
    UPDATE consultation_weekly_schedule SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % consultation_weekly_schedule', v_migrated_count;
  END IF;

  -- consultation_date_exceptions (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consultation_date_exceptions') THEN
    UPDATE consultation_date_exceptions SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % consultation_date_exceptions', v_migrated_count;
  END IF;

  -- receivable_writeoffs (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receivable_writeoffs') THEN
    UPDATE receivable_writeoffs SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % receivable_writeoffs', v_migrated_count;
  END IF;

  -- receivable_memos (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receivable_memos') THEN
    UPDATE receivable_memos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % receivable_memos', v_migrated_count;
  END IF;

  -- scourt 관련 테이블
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profiles') THEN
    UPDATE scourt_profiles SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_profiles', v_migrated_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_user_wmonid') THEN
    UPDATE scourt_user_wmonid SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_user_wmonid', v_migrated_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_profile_cases') THEN
    UPDATE scourt_profile_cases SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_profile_cases', v_migrated_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_case_snapshots') THEN
    UPDATE scourt_case_snapshots SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_case_snapshots', v_migrated_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_case_updates') THEN
    UPDATE scourt_case_updates SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_case_updates', v_migrated_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_sync_logs') THEN
    UPDATE scourt_sync_logs SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % scourt_sync_logs', v_migrated_count;
  END IF;

  -- case_files (존재하는 경우)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'case_files') THEN
    UPDATE case_files SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % case_files', v_migrated_count;
  END IF;

  -- =====================================================
  -- 6. WMONID를 첫 번째 멤버에게 할당
  -- =====================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scourt_user_wmonid') THEN
    UPDATE scourt_user_wmonid
    SET member_id = v_member_id
    WHERE member_id IS NULL AND tenant_id = v_tenant_id;

    GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
    RAISE NOTICE 'Assigned % WMONIDs to owner member', v_migrated_count;
  END IF;

  -- =====================================================
  -- 완료
  -- =====================================================
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tenant ID: %', v_tenant_id;
  RAISE NOTICE 'Owner User ID: %', v_owner_id;
  RAISE NOTICE 'Owner Member ID: %', v_member_id;
  RAISE NOTICE '==============================================';

END $$;

-- =====================================================
-- 7. NOT NULL 제약 추가 (마이그레이션 후)
-- 주의: 이 부분은 모든 데이터가 마이그레이션된 후 실행
-- =====================================================

-- 안전을 위해 NULL이 남아있는지 확인
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- clients
  SELECT COUNT(*) INTO null_count FROM clients WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'clients 테이블에 tenant_id가 NULL인 레코드 % 개 있음', null_count;
  ELSE
    ALTER TABLE clients ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'clients.tenant_id NOT NULL 제약 추가됨';
  END IF;

  -- legal_cases
  SELECT COUNT(*) INTO null_count FROM legal_cases WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'legal_cases 테이블에 tenant_id가 NULL인 레코드 % 개 있음', null_count;
  ELSE
    ALTER TABLE legal_cases ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'legal_cases.tenant_id NOT NULL 제약 추가됨';
  END IF;

  -- payments
  SELECT COUNT(*) INTO null_count FROM payments WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'payments 테이블에 tenant_id가 NULL인 레코드 % 개 있음', null_count;
  ELSE
    ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'payments.tenant_id NOT NULL 제약 추가됨';
  END IF;

  -- expenses
  SELECT COUNT(*) INTO null_count FROM expenses WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'expenses 테이블에 tenant_id가 NULL인 레코드 % 개 있음', null_count;
  ELSE
    ALTER TABLE expenses ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'expenses.tenant_id NOT NULL 제약 추가됨';
  END IF;

  -- consultations는 공개 INSERT가 있으므로 NOT NULL 추가하지 않음
  -- 새 상담 신청 시 tenant_id가 어떻게 설정될지 결정 필요

END $$;

-- =====================================================
-- 8. 마이그레이션 검증 쿼리 (수동 확인용)
-- =====================================================

-- 마이그레이션 결과 확인
SELECT
  'tenants' AS table_name,
  COUNT(*) AS count
FROM tenants
UNION ALL
SELECT 'tenant_members', COUNT(*) FROM tenant_members
UNION ALL
SELECT 'super_admins', COUNT(*) FROM super_admins
UNION ALL
SELECT 'clients (migrated)', COUNT(*) FROM clients WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 'legal_cases (migrated)', COUNT(*) FROM legal_cases WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 'consultations (migrated)', COUNT(*) FROM consultations WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 'payments (migrated)', COUNT(*) FROM payments WHERE tenant_id IS NOT NULL;

-- =====================================================
-- 완료
-- =====================================================
