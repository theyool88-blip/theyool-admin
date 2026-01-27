-- SCOURT XML 캐시 테이블
-- 사건 등록 시 필요한 XML 파일을 자동으로 다운로드하여 캐시

CREATE TABLE IF NOT EXISTS scourt_xml_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xml_path TEXT NOT NULL UNIQUE,      -- 'ssgo003/SSGO003F70.xml'
  xml_content TEXT NOT NULL,           -- XML 원본 내용
  case_type TEXT,                      -- 'ssgo102', 'ssgo101' 등 (참고용)
  data_list_id TEXT,                   -- 'dlt_agntCttLst' 등 (참고용)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_xml_cache_path ON scourt_xml_cache(xml_path);
CREATE INDEX IF NOT EXISTS idx_scourt_xml_cache_case_type ON scourt_xml_cache(case_type);

-- 코멘트
COMMENT ON TABLE scourt_xml_cache IS 'SCOURT XML 파일 캐시 (일반내용 렌더링용)';
COMMENT ON COLUMN scourt_xml_cache.xml_path IS 'XML 파일 경로 (예: ssgo003/SSGO003F70.xml)';
COMMENT ON COLUMN scourt_xml_cache.xml_content IS 'XML 파일 원본 내용';
COMMENT ON COLUMN scourt_xml_cache.case_type IS '사건유형 코드 (ssgo102=가사, ssgo101=민사 등)';
COMMENT ON COLUMN scourt_xml_cache.data_list_id IS '데이터 리스트 ID (dlt_agntCttLst 등)';

-- RLS 정책 (public 읽기 허용, 시스템만 쓰기)
ALTER TABLE scourt_xml_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scourt_xml_cache_read" ON scourt_xml_cache
  FOR SELECT USING (true);

CREATE POLICY "scourt_xml_cache_write" ON scourt_xml_cache
  FOR ALL USING (auth.role() = 'service_role');
