-- 신청사건 유형 필드 추가 (부동산 가압류, 채권 가압류, 가처분 등)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS application_type TEXT;

-- 코멘트 추가
COMMENT ON COLUMN legal_cases.application_type IS '신청사건 유형: 부동산 가압류, 채권 가압류, 부동산 가처분, 채권 가처분 등';

-- 인덱스 추가 (필터링용)
CREATE INDEX IF NOT EXISTS idx_legal_cases_application_type ON legal_cases(application_type);
