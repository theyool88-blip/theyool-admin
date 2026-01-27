-- ============================================================================
-- 마이그레이션: application_type 컬럼 추가
-- 신청사건(가압류, 가처분, 조정 등)의 유형을 저장
-- ============================================================================

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS application_type TEXT;

COMMENT ON COLUMN legal_cases.application_type IS '신청사건 유형 (가압류, 가처분, 조정신청 등)';
