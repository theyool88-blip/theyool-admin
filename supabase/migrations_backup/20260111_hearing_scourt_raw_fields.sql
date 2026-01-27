-- court_hearings: SCOURT 원본 기일 데이터 저장 필드 추가
-- 목적: 나의사건검색과 동일한 기일 정보 표시 (회차, 원본 결과 등)

-- 1. 새 컬럼 추가
ALTER TABLE court_hearings
  ADD COLUMN IF NOT EXISTS scourt_type_raw TEXT,      -- SCOURT 원본 기일명 (예: "제1회 변론기일")
  ADD COLUMN IF NOT EXISTS scourt_result_raw TEXT,    -- SCOURT 원본 결과 (예: "다음기일지정(2025.02.15)")
  ADD COLUMN IF NOT EXISTS hearing_sequence INTEGER;  -- 기일 회차 (1, 2, 3...)

COMMENT ON COLUMN court_hearings.scourt_type_raw IS 'SCOURT 원본 기일명 (예: 제1회 변론기일, 조정기일)';
COMMENT ON COLUMN court_hearings.scourt_result_raw IS 'SCOURT 원본 기일 결과 (예: 다음기일지정(2025.02.15), 변론종결)';
COMMENT ON COLUMN court_hearings.hearing_sequence IS '기일 회차 번호 (제N회에서 추출)';

-- 2. 인덱스 추가 (회차별 조회용)
CREATE INDEX IF NOT EXISTS idx_court_hearings_sequence
  ON court_hearings(case_id, hearing_sequence)
  WHERE hearing_sequence IS NOT NULL;

-- 3. 기존 데이터 마이그레이션 (notes 필드에서 원본 추출)
-- notes가 "SCOURT 동기화: ..." 형식인 경우 scourt_type_raw로 복사
UPDATE court_hearings
SET scourt_type_raw = regexp_replace(notes, '^SCOURT 동기화: ', '')
WHERE notes LIKE 'SCOURT 동기화:%'
  AND scourt_type_raw IS NULL;

-- 4. 회차 번호 추출 (제N회 패턴)
UPDATE court_hearings
SET hearing_sequence = (regexp_match(scourt_type_raw, '제(\d+)회'))[1]::INTEGER
WHERE scourt_type_raw ~ '제\d+회'
  AND hearing_sequence IS NULL;
