-- 상담 유입 경로 관리 시스템
--
-- 목적:
-- 1. 유입 경로를 별도 테이블로 관리하여 확장 가능하게 함
-- 2. 기본 유입 경로: 네이버, 홈페이지, 기타
-- 3. 관리자가 유입 경로를 추가/수정/삭제할 수 있음
-- 4. 통계 집계를 위한 색상, 정렬 순서 관리

-- ============================================================================
-- 1. consultation_sources 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유입 경로 정보
  name TEXT NOT NULL UNIQUE,           -- 유입 경로 이름 (예: "네이버", "홈페이지")
  display_order INT DEFAULT 0,         -- 표시 순서
  color TEXT DEFAULT 'gray',           -- 표시 색상 (tailwind color name)
  is_active BOOLEAN DEFAULT true,      -- 활성화 여부
  is_default BOOLEAN DEFAULT false,    -- 기본값 여부

  -- 통계
  usage_count INT DEFAULT 0,           -- 사용 횟수 (denormalized for performance)

  -- 메모
  description TEXT,                    -- 설명

  CONSTRAINT name_not_empty CHECK (char_length(name) > 0)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultation_sources_active ON consultation_sources(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_consultation_sources_usage ON consultation_sources(usage_count DESC);

-- ============================================================================
-- 2. consultations 테이블 source 컬럼 확인 및 외래키 추가 (선택사항)
-- ============================================================================

-- source 컬럼이 없다면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consultations' AND column_name = 'source'
  ) THEN
    ALTER TABLE consultations ADD COLUMN source TEXT;
  END IF;
END $$;

-- ============================================================================
-- 3. 기본 유입 경로 데이터 삽입
-- ============================================================================

INSERT INTO consultation_sources (name, display_order, color, is_active, is_default, description)
VALUES
  ('네이버', 1, 'green', true, false, '네이버 검색 및 광고를 통한 유입'),
  ('홈페이지', 2, 'blue', true, true, '공식 홈페이지를 통한 직접 유입'),
  ('기타', 99, 'gray', true, false, '기타 경로를 통한 유입')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 4. 기존 consultations 데이터 마이그레이션
-- ============================================================================

-- source가 NULL인 경우 '기타'로 설정
UPDATE consultations
SET source = '기타'
WHERE source IS NULL OR source = '';

-- ============================================================================
-- 5. usage_count 업데이트 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consultation_source_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT or UPDATE with source change
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.source IS DISTINCT FROM NEW.source)) THEN
    -- Increment new source count
    IF NEW.source IS NOT NULL AND NEW.source != '' THEN
      UPDATE consultation_sources
      SET usage_count = usage_count + 1
      WHERE name = NEW.source;
    END IF;

    -- Decrement old source count (UPDATE only)
    IF TG_OP = 'UPDATE' AND OLD.source IS NOT NULL AND OLD.source != '' THEN
      UPDATE consultation_sources
      SET usage_count = GREATEST(0, usage_count - 1)
      WHERE name = OLD.source;
    END IF;
  END IF;

  -- DELETE
  IF TG_OP = 'DELETE' AND OLD.source IS NOT NULL AND OLD.source != '' THEN
    UPDATE consultation_sources
    SET usage_count = GREATEST(0, usage_count - 1)
    WHERE name = OLD.source;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_consultation_source_usage ON consultations;
CREATE TRIGGER trigger_update_consultation_source_usage
  AFTER INSERT OR UPDATE OR DELETE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_source_usage_count();

-- ============================================================================
-- 6. 초기 usage_count 계산
-- ============================================================================

UPDATE consultation_sources cs
SET usage_count = (
  SELECT COUNT(*)
  FROM consultations c
  WHERE c.source = cs.name
);

-- ============================================================================
-- 7. RLS (Row Level Security) 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE consultation_sources ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있음
CREATE POLICY "consultation_sources_select_all" ON consultation_sources
  FOR SELECT
  USING (true);

-- 인증된 사용자만 수정 가능 (추후 admin role로 제한 가능)
CREATE POLICY "consultation_sources_admin_all" ON consultation_sources
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 8. 업데이트 timestamp 자동 갱신
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consultation_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_consultation_sources_updated_at ON consultation_sources;
CREATE TRIGGER trigger_consultation_sources_updated_at
  BEFORE UPDATE ON consultation_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_sources_updated_at();

-- ============================================================================
-- 9. 코멘트
-- ============================================================================

COMMENT ON TABLE consultation_sources IS '상담 유입 경로 관리 테이블';
COMMENT ON COLUMN consultation_sources.name IS '유입 경로 이름 (예: 네이버, 홈페이지, 기타)';
COMMENT ON COLUMN consultation_sources.display_order IS '표시 순서 (낮을수록 먼저 표시)';
COMMENT ON COLUMN consultation_sources.color IS 'UI 표시 색상 (tailwind color name)';
COMMENT ON COLUMN consultation_sources.is_active IS '활성화 여부 (비활성화된 항목은 선택 불가)';
COMMENT ON COLUMN consultation_sources.is_default IS '기본값 여부 (신규 상담 시 자동 선택)';
COMMENT ON COLUMN consultation_sources.usage_count IS '사용 횟수 (통계용)';

-- ============================================================================
-- 10. 검증 쿼리 (주석 처리, 필요 시 실행)
-- ============================================================================

/*
-- 생성된 유입 경로 확인
SELECT * FROM consultation_sources ORDER BY display_order;

-- 유입 경로별 상담 건수 확인
SELECT
  cs.name,
  cs.usage_count as cached_count,
  COUNT(c.id) as actual_count,
  cs.color,
  cs.is_active
FROM consultation_sources cs
LEFT JOIN consultations c ON c.source = cs.name
GROUP BY cs.id, cs.name, cs.usage_count, cs.color, cs.is_active
ORDER BY cs.display_order;

-- source가 NULL인 상담 확인
SELECT COUNT(*) as null_source_count
FROM consultations
WHERE source IS NULL OR source = '';
*/
