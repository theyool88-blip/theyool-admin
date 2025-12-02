-- 의뢰인 포털용 파일 공개 컬럼 추가
-- drive_file_classifications 테이블에 의뢰인 공개 관련 컬럼 추가

-- 의뢰인 공개 여부
ALTER TABLE drive_file_classifications
ADD COLUMN IF NOT EXISTS client_visible BOOLEAN DEFAULT FALSE;

-- 의뢰인용 문서 유형
-- brief_client: 의뢰인 서류 (01_서면)
-- brief_defendant: 피고 서류
-- evidence: 증거 서류 (02_증거/갑, 을)
-- third_party: 제3자 제출 서류 (04_AI참고)
-- judgment: 판결문 (03_법원문서 중 판결/결정)
ALTER TABLE drive_file_classifications
ADD COLUMN IF NOT EXISTS client_doc_type VARCHAR(50);

-- 고용량 파일 플래그 (40MB 이상)
ALTER TABLE drive_file_classifications
ADD COLUMN IF NOT EXISTS is_large_file BOOLEAN DEFAULT FALSE;

-- 파일 크기 (bytes)
ALTER TABLE drive_file_classifications
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 인덱스: 의뢰인 공개 파일만 조회
CREATE INDEX IF NOT EXISTS idx_dfc_client_visible
ON drive_file_classifications(client_visible)
WHERE client_visible = TRUE;

-- 인덱스: 사건별 공개 파일 조회
CREATE INDEX IF NOT EXISTS idx_dfc_case_client_visible
ON drive_file_classifications(case_id, client_visible)
WHERE client_visible = TRUE;

-- 인덱스: 의뢰인용 문서 유형별 조회
CREATE INDEX IF NOT EXISTS idx_dfc_client_doc_type
ON drive_file_classifications(client_doc_type)
WHERE client_visible = TRUE;

-- 코멘트
COMMENT ON COLUMN drive_file_classifications.client_visible IS '의뢰인 포털에 공개 여부';
COMMENT ON COLUMN drive_file_classifications.client_doc_type IS '의뢰인용 문서 유형: brief_client, brief_defendant, evidence, third_party, judgment';
COMMENT ON COLUMN drive_file_classifications.is_large_file IS '40MB 이상 고용량 파일 여부';
COMMENT ON COLUMN drive_file_classifications.file_size IS '파일 크기 (bytes)';
