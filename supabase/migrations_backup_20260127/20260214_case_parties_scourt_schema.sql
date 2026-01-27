-- case_parties: SCOURT 당사자 원본 라벨/이름 및 대표 표시용 컬럼 추가

ALTER TABLE case_parties
  ADD COLUMN IF NOT EXISTS scourt_label_raw TEXT,
  ADD COLUMN IF NOT EXISTS scourt_name_raw TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN case_parties.scourt_label_raw IS 'SCOURT 당사자 원본 지위 라벨';
COMMENT ON COLUMN case_parties.scourt_name_raw IS 'SCOURT 당사자 원본 이름(마스킹 포함)';
COMMENT ON COLUMN case_parties.is_primary IS '측 대표 당사자 표시(히어로/기본내용용)';

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

-- SCOURT 인덱스 기준 유니크 보장 (1:1 매칭)
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_parties_case_scourt_index
  ON case_parties (case_id, scourt_party_index)
  WHERE scourt_party_index IS NOT NULL;
