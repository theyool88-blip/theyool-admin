-- 테넌트 로고 필드 추가
-- 2025-12-31

-- tenants 테이블에 로고 필드 추가
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;  -- 다크모드용 (선택)

-- 로고 저장용 스토리지 버킷 생성 (Supabase Dashboard에서 수동 생성 필요)
-- 버킷명: tenant-logos
-- 공개 설정: public

COMMENT ON COLUMN tenants.logo_url IS '테넌트 로고 URL (밝은 배경용)';
COMMENT ON COLUMN tenants.logo_dark_url IS '테넌트 로고 URL (어두운 배경용, 선택)';
