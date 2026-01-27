-- ================================================================
-- 당사자별 불변기한 관리 지원
-- 2026-01-14
--
-- 변경 내용:
-- 1. case_deadlines에 party_id, party_side 컬럼 추가
-- 2. 인덱스 추가
-- ================================================================

-- 1. party_id 컬럼 추가 (당사자 직접 연결)
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES case_parties(id) ON DELETE SET NULL;

-- 2. party_side 컬럼 추가 (당사자 측 구분)
-- 'plaintiff_side' = 원고측, 'defendant_side' = 피고측, NULL = 전체/미지정
ALTER TABLE case_deadlines
ADD COLUMN IF NOT EXISTS party_side VARCHAR(30);

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_id
ON case_deadlines(party_id)
WHERE party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_deadlines_party_side
ON case_deadlines(party_side)
WHERE party_side IS NOT NULL;

-- 4. 코멘트
COMMENT ON COLUMN case_deadlines.party_id IS '연관된 당사자 ID (NULL이면 사건 전체 적용)';
COMMENT ON COLUMN case_deadlines.party_side IS '당사자 측: plaintiff_side(원고측), defendant_side(피고측), NULL(전체)';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 당사자별 불변기한 관리 컬럼 추가 완료';
  RAISE NOTICE '   - party_id: 개별 당사자 연결';
  RAISE NOTICE '   - party_side: 당사자 측 구분';
END $$;
