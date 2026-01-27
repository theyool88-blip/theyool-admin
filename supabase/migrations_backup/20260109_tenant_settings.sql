-- ============================================================================
-- 테넌트 설정 테이블 생성
-- 각 테넌트별로 서비스 설정을 저장 (카테고리, 옵션 등)
-- ============================================================================

-- 테넌트 설정 테이블
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- cases, payments, expenses, consultations, clients
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, category)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_category ON tenant_settings(category);

-- RLS 활성화
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 슈퍼 어드민은 모든 설정 접근 가능
CREATE POLICY super_admin_tenant_settings ON tenant_settings
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- RLS 정책: 테넌트 멤버는 자신의 테넌트 설정만 조회/수정 가능 (admin 이상)
CREATE POLICY tenant_member_settings ON tenant_settings
  FOR ALL
  TO authenticated
  USING (
    is_tenant_member(tenant_id) AND
    has_role_or_higher('admin')
  )
  WITH CHECK (
    is_tenant_member(tenant_id) AND
    has_role_or_higher('admin')
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tenant_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_settings_updated_at ON tenant_settings;
CREATE TRIGGER trigger_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_settings_updated_at();

-- ============================================================================
-- 기본 설정 데이터 삽입 (더윤 테넌트)
-- ============================================================================

-- 더윤 테넌트 ID 조회 후 기본 설정 삽입
DO $$
DECLARE
  theyool_tenant_id UUID;
BEGIN
  -- 더윤 테넌트 ID 조회
  SELECT id INTO theyool_tenant_id FROM tenants WHERE slug = 'theyool' LIMIT 1;

  IF theyool_tenant_id IS NOT NULL THEN
    -- 수임료 설정
    INSERT INTO tenant_settings (tenant_id, category, settings)
    VALUES (
      theyool_tenant_id,
      'payments',
      '{
        "categories": [
          {"value": "착수금", "label": "착수금"},
          {"value": "잔금", "label": "잔금"},
          {"value": "성공보수", "label": "성공보수"},
          {"value": "모든 상담", "label": "모든 상담"},
          {"value": "내용증명", "label": "내용증명"},
          {"value": "집행(소송비용)", "label": "집행(소송비용)"},
          {"value": "기타", "label": "기타"},
          {"value": "환불", "label": "환불"}
        ],
        "receiptTypes": [
          {"value": "현금영수증", "label": "현금영수증"},
          {"value": "카드결제", "label": "카드결제"},
          {"value": "세금계산서", "label": "세금계산서"},
          {"value": "현금", "label": "현금"},
          {"value": "네이버페이", "label": "네이버페이"},
          {"value": "자진발급", "label": "자진발급"}
        ],
        "officeLocations": [
          {"value": "평택", "label": "평택"},
          {"value": "천안", "label": "천안"},
          {"value": "소송구조", "label": "소송구조"}
        ]
      }'::jsonb
    )
    ON CONFLICT (tenant_id, category) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = NOW();

    -- 지출 설정
    INSERT INTO tenant_settings (tenant_id, category, settings)
    VALUES (
      theyool_tenant_id,
      'expenses',
      '{
        "categories": [
          {"value": "임대료", "label": "임대료"},
          {"value": "인건비", "label": "인건비"},
          {"value": "필수운영비", "label": "필수운영비"},
          {"value": "마케팅비", "label": "마케팅비"},
          {"value": "광고비", "label": "광고비"},
          {"value": "세금", "label": "세금"},
          {"value": "식대", "label": "식대"},
          {"value": "구독료", "label": "구독료"},
          {"value": "기타", "label": "기타"}
        ],
        "officeLocations": [
          {"value": "평택", "label": "평택"},
          {"value": "천안", "label": "천안"},
          {"value": "공통", "label": "공통"}
        ]
      }'::jsonb
    )
    ON CONFLICT (tenant_id, category) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = NOW();

    -- 상담 설정
    INSERT INTO tenant_settings (tenant_id, category, settings)
    VALUES (
      theyool_tenant_id,
      'consultations',
      '{
        "categories": [
          {"value": "alimony", "label": "위자료"},
          {"value": "property", "label": "재산분할"},
          {"value": "custody", "label": "양육권"},
          {"value": "adultery", "label": "상간사건"},
          {"value": "consultation", "label": "일반 상담"},
          {"value": "other", "label": "기타"}
        ],
        "officeLocations": [
          {"value": "천안", "label": "천안"},
          {"value": "평택", "label": "평택"}
        ],
        "defaultFee": 0,
        "autoAssignLawyer": false
      }'::jsonb
    )
    ON CONFLICT (tenant_id, category) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = NOW();

    -- 사건 설정
    INSERT INTO tenant_settings (tenant_id, category, settings)
    VALUES (
      theyool_tenant_id,
      'cases',
      '{
        "caseTypes": [
          {"value": "이혼", "label": "이혼"},
          {"value": "양육권", "label": "양육권"},
          {"value": "재산분할", "label": "재산분할"},
          {"value": "위자료", "label": "위자료"},
          {"value": "상간", "label": "상간"},
          {"value": "기타가사", "label": "기타가사"}
        ],
        "officeLocations": [
          {"value": "평택", "label": "평택"},
          {"value": "천안", "label": "천안"},
          {"value": "소송구조", "label": "소송구조"}
        ]
      }'::jsonb
    )
    ON CONFLICT (tenant_id, category) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = NOW();

    -- 의뢰인 설정
    INSERT INTO tenant_settings (tenant_id, category, settings)
    VALUES (
      theyool_tenant_id,
      'clients',
      '{
        "requiredFields": ["name", "phone"],
        "clientPortalEnabled": true
      }'::jsonb
    )
    ON CONFLICT (tenant_id, category) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = NOW();

    RAISE NOTICE 'Successfully inserted tenant settings for theyool tenant';
  ELSE
    RAISE NOTICE 'theyool tenant not found, skipping default settings';
  END IF;
END $$;

-- ============================================================================
-- 코멘트 추가
-- ============================================================================
COMMENT ON TABLE tenant_settings IS '테넌트별 서비스 설정 (카테고리, 옵션 등)';
COMMENT ON COLUMN tenant_settings.category IS '설정 카테고리: cases, payments, expenses, consultations, clients';
COMMENT ON COLUMN tenant_settings.settings IS 'JSON 형식의 설정 데이터';
