-- =====================================================
-- 기존 Google Calendar 토큰 마이그레이션
-- 생성일: 2025-12-31
-- 설명: app_settings의 토큰을 theyool 테넌트의 tenant_integrations로 이전
-- =====================================================

DO $$
DECLARE
  v_theyool_tenant_id UUID;
  v_existing_tokens JSONB;
  v_existing_watch JSONB;
  v_owner_user_id UUID;
BEGIN
  -- 1. theyool 테넌트 ID 조회
  SELECT id INTO v_theyool_tenant_id
  FROM tenants
  WHERE slug = 'theyool';

  IF v_theyool_tenant_id IS NULL THEN
    RAISE NOTICE 'theyool 테넌트를 찾을 수 없습니다. 마이그레이션을 건너뜁니다.';
    RETURN;
  END IF;

  -- 2. theyool 테넌트의 owner 조회
  SELECT user_id INTO v_owner_user_id
  FROM tenant_members
  WHERE tenant_id = v_theyool_tenant_id
    AND role = 'owner'
    AND status = 'active'
  LIMIT 1;

  -- 3. 기존 Google Calendar 토큰 조회
  SELECT value::jsonb INTO v_existing_tokens
  FROM app_settings
  WHERE key = 'google_calendar_tokens';

  -- 4. 기존 웹훅 정보 조회
  SELECT value::jsonb INTO v_existing_watch
  FROM app_settings
  WHERE key = 'google_calendar_watch';

  -- 5. 토큰이 있으면 마이그레이션
  IF v_existing_tokens IS NOT NULL THEN
    -- 기존 연동이 있으면 업데이트, 없으면 삽입
    INSERT INTO tenant_integrations (
      tenant_id,
      provider,
      access_token,
      refresh_token,
      token_expiry,
      settings,
      status,
      connected_at,
      connected_by,
      webhook_channel_id,
      webhook_resource_id,
      webhook_expiry
    )
    VALUES (
      v_theyool_tenant_id,
      'google_calendar',
      v_existing_tokens->>'access_token',
      v_existing_tokens->>'refresh_token',
      CASE
        WHEN v_existing_tokens->>'expiry_date' IS NOT NULL
        THEN to_timestamp((v_existing_tokens->>'expiry_date')::bigint / 1000)
        ELSE NULL
      END,
      jsonb_build_object(
        'calendarId', 'c9c4c72938d6a219203535e47a8c4bbf70aa8b87f88ff16889e33e224cf8bcd1@group.calendar.google.com',
        'calendarName', '케이스노트'
      ),
      'connected',
      NOW(),
      v_owner_user_id,
      -- 웹훅 정보
      CASE WHEN v_existing_watch IS NOT NULL THEN v_existing_watch->>'channelId' ELSE NULL END,
      CASE WHEN v_existing_watch IS NOT NULL THEN v_existing_watch->>'resourceId' ELSE NULL END,
      CASE WHEN v_existing_watch IS NOT NULL AND v_existing_watch->>'expiration' IS NOT NULL
        THEN to_timestamp((v_existing_watch->>'expiration')::bigint / 1000)
        ELSE NULL
      END
    )
    ON CONFLICT (tenant_id, provider) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expiry = EXCLUDED.token_expiry,
      settings = EXCLUDED.settings,
      status = EXCLUDED.status,
      connected_at = EXCLUDED.connected_at,
      webhook_channel_id = EXCLUDED.webhook_channel_id,
      webhook_resource_id = EXCLUDED.webhook_resource_id,
      webhook_expiry = EXCLUDED.webhook_expiry,
      updated_at = NOW();

    RAISE NOTICE 'Google Calendar 토큰이 theyool 테넌트로 마이그레이션되었습니다.';
  ELSE
    RAISE NOTICE '마이그레이션할 Google Calendar 토큰이 없습니다.';
  END IF;

END $$;

-- =====================================================
-- 검증 쿼리 (마이그레이션 후 확인용)
-- =====================================================
-- SELECT
--   t.name as tenant_name,
--   ti.provider,
--   ti.status,
--   ti.settings->>'calendarId' as calendar_id,
--   ti.settings->>'calendarName' as calendar_name,
--   ti.connected_at
-- FROM tenant_integrations ti
-- JOIN tenants t ON t.id = ti.tenant_id
-- WHERE ti.provider = 'google_calendar';
