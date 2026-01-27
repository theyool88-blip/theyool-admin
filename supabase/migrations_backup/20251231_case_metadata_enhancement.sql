-- 사건 메타데이터 개선
-- 2025-12-31
--
-- 목적: 나의사건검색 데이터와 연동하기 위한 스키마 개선
-- - 사건유형 코드 표준화
-- - 법원 코드 표준화
-- - 관련사건 유형 세분화

-- ============================================================
-- 1. legal_cases 테이블 확장
-- ============================================================

-- 사건유형 코드 (가단, 드단, 고단 등)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_type_code VARCHAR(10);

-- 법원 코드 (나의사건검색 드롭다운 값)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS court_code VARCHAR(50);

-- 사건 심급 (1심, 항소심, 상고심 등)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_level VARCHAR(20);

-- 사건 카테고리 (민사, 가사, 형사, 행정 등)
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_category VARCHAR(20);

-- 사건번호 파싱된 필드들
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_year VARCHAR(4);

ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS case_serial VARCHAR(20);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_type_code ON legal_cases(case_type_code);
CREATE INDEX IF NOT EXISTS idx_legal_cases_court_code ON legal_cases(court_code);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_level ON legal_cases(case_level);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_category ON legal_cases(case_category);
CREATE INDEX IF NOT EXISTS idx_legal_cases_case_year ON legal_cases(case_year);

-- ============================================================
-- 2. case_relations 테이블 개선
-- ============================================================

-- relation_type 값 표준화를 위한 체크 제약조건
-- 기존 데이터 호환성을 위해 ALTER 대신 새 컬럼 추가
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS relation_type_code VARCHAR(20);

-- relation_type_code 값:
-- appeal: 상소 관계 (1심 → 항소심 → 상고심)
-- provisional: 보전처분 관계 (본안 → 가압류/가처분)
-- execution: 집행 관계 (본안 → 압류/경매)
-- preliminary: 사전처분 관계 (가사본안 → 사전처분)
-- retrial: 재심 관계
-- related: 기타 관련사건
-- same_party: 동일 당사자 사건

-- 방향 필드 추가
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS direction VARCHAR(10);
-- parent: case_id가 상위 (1심, 본안 등)
-- child: case_id가 하위 (항소심, 보전처분 등)
-- sibling: 동급 관계

-- 자동 감지 여부
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT FALSE;

-- 감지 일시
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;

-- 확인 여부 (관리자가 확인함)
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT FALSE;

-- 확인 일시
ALTER TABLE case_relations
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_case_relations_relation_type_code ON case_relations(relation_type_code);
CREATE INDEX IF NOT EXISTS idx_case_relations_auto_detected ON case_relations(auto_detected);
CREATE INDEX IF NOT EXISTS idx_case_relations_confirmed ON case_relations(confirmed);

-- ============================================================
-- 3. 관련사건 유형 참조 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS case_relation_types (
  code VARCHAR(20) PRIMARY KEY,
  name_ko VARCHAR(50) NOT NULL,
  name_en VARCHAR(50),
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 데이터 삽입
INSERT INTO case_relation_types (code, name_ko, description, icon, sort_order) VALUES
  ('appeal', '상소', '상소 관계 (1심→항소심→상고심)', 'arrow-up', 1),
  ('provisional', '보전처분', '본안→가압류/가처분', 'shield', 2),
  ('execution', '집행', '본안→채권압류/경매', 'gavel', 3),
  ('preliminary', '사전처분', '가사본안→사전처분', 'clock', 4),
  ('retrial', '재심', '재심 관계', 'refresh', 5),
  ('related', '관련사건', '기타 관련 사건', 'link', 6),
  ('same_party', '동일당사자', '같은 당사자의 다른 사건', 'users', 7)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 4. 사건번호 파싱 함수
-- ============================================================

-- 사건번호에서 메타데이터 추출 함수
CREATE OR REPLACE FUNCTION parse_case_number(case_number TEXT)
RETURNS TABLE (
  court TEXT,
  year TEXT,
  case_type TEXT,
  serial TEXT
) AS $$
DECLARE
  cleaned TEXT;
  pattern1_match TEXT[];
  pattern2_match TEXT[];
BEGIN
  -- 공백 정리
  cleaned := TRIM(regexp_replace(case_number, '\s+', ' ', 'g'));

  -- 패턴 1: 법원명 + 연도 + 사건유형 + 일련번호
  -- 예: "서울중앙지방법원 2024가단123456"
  pattern1_match := regexp_matches(cleaned, '^(.+?)\s*(\d{4})([가-힣]+)(\d+)$');

  IF pattern1_match IS NOT NULL THEN
    court := TRIM(pattern1_match[1]);
    year := pattern1_match[2];
    case_type := pattern1_match[3];
    serial := pattern1_match[4];
    RETURN NEXT;
    RETURN;
  END IF;

  -- 패턴 2: 연도 + 사건유형 + 일련번호 (법원 없음)
  -- 예: "2024가단123456"
  pattern2_match := regexp_matches(cleaned, '^(\d{4})([가-힣]+)(\d+)$');

  IF pattern2_match IS NOT NULL THEN
    court := NULL;
    year := pattern2_match[1];
    case_type := pattern2_match[2];
    serial := pattern2_match[3];
    RETURN NEXT;
    RETURN;
  END IF;

  -- 매칭 실패
  RETURN;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 5. 기존 데이터 마이그레이션 (사건번호 파싱)
-- ============================================================

-- 기존 legal_cases의 court_case_number를 파싱하여 메타데이터 채우기
UPDATE legal_cases
SET
  case_year = parsed.year,
  case_type_code = parsed.case_type,
  case_serial = parsed.serial
FROM (
  SELECT
    id,
    (parse_case_number(court_case_number)).*
  FROM legal_cases
  WHERE court_case_number IS NOT NULL
    AND case_type_code IS NULL
) AS parsed
WHERE legal_cases.id = parsed.id;

-- ============================================================
-- 6. 뷰: 사건 메타데이터 포함 조회
-- ============================================================

CREATE OR REPLACE VIEW legal_cases_with_metadata AS
SELECT
  lc.*,
  -- 관련사건 수
  (
    SELECT COUNT(*)
    FROM case_relations cr
    WHERE cr.case_id = lc.id OR cr.related_case_id = lc.id
  ) as related_case_count,
  -- 상소심 여부
  (
    SELECT EXISTS(
      SELECT 1
      FROM case_relations cr
      WHERE (cr.case_id = lc.id OR cr.related_case_id = lc.id)
        AND cr.relation_type_code = 'appeal'
    )
  ) as has_appeal,
  -- 보전처분 여부
  (
    SELECT EXISTS(
      SELECT 1
      FROM case_relations cr
      WHERE (cr.case_id = lc.id OR cr.related_case_id = lc.id)
        AND cr.relation_type_code = 'provisional'
    )
  ) as has_provisional
FROM legal_cases lc;

-- ============================================================
-- 7. 트리거: 사건 생성/수정 시 메타데이터 자동 파싱
-- ============================================================

CREATE OR REPLACE FUNCTION auto_parse_case_number()
RETURNS TRIGGER AS $$
DECLARE
  parsed RECORD;
BEGIN
  -- court_case_number가 있고 case_type_code가 비어있으면 파싱
  IF NEW.court_case_number IS NOT NULL AND NEW.case_type_code IS NULL THEN
    SELECT * INTO parsed FROM parse_case_number(NEW.court_case_number) LIMIT 1;

    IF parsed IS NOT NULL THEN
      NEW.case_year := parsed.year;
      NEW.case_type_code := parsed.case_type;
      NEW.case_serial := parsed.serial;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_parse_case_number ON legal_cases;
CREATE TRIGGER trigger_auto_parse_case_number
  BEFORE INSERT OR UPDATE OF court_case_number
  ON legal_cases
  FOR EACH ROW
  EXECUTE FUNCTION auto_parse_case_number();

-- ============================================================
-- 8. RLS 정책 (case_relation_types)
-- ============================================================

ALTER TABLE case_relation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "모든 사용자는 관계 유형을 조회할 수 있습니다"
ON case_relation_types FOR SELECT
USING (true);

-- 관리자만 수정 가능
CREATE POLICY "관리자는 관계 유형을 수정할 수 있습니다"
ON case_relation_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users_profiles
    WHERE users_profiles.auth_user_id = auth.uid()
    AND users_profiles.role = 'admin'
  )
);
