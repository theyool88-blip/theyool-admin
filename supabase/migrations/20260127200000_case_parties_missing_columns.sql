-- case_parties 누락 컬럼 추가 (스키마-코드 정합성)

-- 1. manual_override: 사용자 수동 수정 보존 플래그
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT FALSE;

-- 2. SCOURT 원본 데이터 컬럼
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS scourt_label_raw TEXT,
  ADD COLUMN IF NOT EXISTS scourt_name_raw TEXT;

-- 3. is_primary: 측 대표 당사자 표시
ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- 코멘트
COMMENT ON COLUMN case_parties.manual_override IS '사용자 수동 수정 보존 (SCOURT 동기화 시 덮어쓰기 방지)';
COMMENT ON COLUMN case_parties.scourt_label_raw IS 'SCOURT 당사자 원본 지위 라벨';
COMMENT ON COLUMN case_parties.scourt_name_raw IS 'SCOURT 당사자 원본 이름 (마스킹 포함)';
COMMENT ON COLUMN case_parties.is_primary IS '측 대표 당사자 표시 (히어로/기본내용용)';

-- SCOURT 연동 레코드의 원본값 백필
UPDATE case_parties
SET scourt_name_raw = party_name
WHERE scourt_name_raw IS NULL
  AND scourt_synced = TRUE;

UPDATE case_parties
SET scourt_label_raw = party_type_label
WHERE scourt_label_raw IS NULL
  AND scourt_synced = TRUE
  AND party_type_label IS NOT NULL;

-- SCOURT 인덱스 기준 유니크 인덱스 (1:1 매칭)
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_parties_case_scourt_index
  ON case_parties (case_id, scourt_party_index)
  WHERE scourt_party_index IS NOT NULL;
