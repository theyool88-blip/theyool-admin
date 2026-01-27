-- 대법원 사건 동기화 시스템
-- 스냅샷 저장 + 변경 감지
-- 2025-12-30

-- ============================================================
-- 1. 사건 스냅샷 테이블 (매 동기화마다 전체 상태 저장)
-- ============================================================
CREATE TABLE IF NOT EXISTS scourt_case_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES scourt_profiles(id),

  -- 스냅샷 시점
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- 원본 데이터 (구조화)
  basic_info JSONB NOT NULL DEFAULT '{}',      -- 기본정보 (사건번호, 당사자, 재판부 등)
  hearings JSONB NOT NULL DEFAULT '[]',        -- 기일 목록
  progress JSONB NOT NULL DEFAULT '[]',        -- 진행내용 (송달, 제출 등)
  documents JSONB NOT NULL DEFAULT '[]',       -- 제출서류
  lower_court JSONB NOT NULL DEFAULT '[]',     -- 심급내용 (형사)

  -- 메타데이터
  case_type VARCHAR(20),                       -- family, criminal, civil
  court_code VARCHAR(20),
  case_number VARCHAR(50),

  -- 해시 (변경 감지용)
  content_hash VARCHAR(64),                    -- SHA256 of all content

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_legal_case ON scourt_case_snapshots(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_scraped_at ON scourt_case_snapshots(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scourt_snapshots_case_number ON scourt_case_snapshots(case_number);

-- ============================================================
-- 2. 사건 업데이트 테이블 (변경된 내용만 기록)
-- ============================================================
CREATE TABLE IF NOT EXISTS scourt_case_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_case_id UUID REFERENCES legal_cases(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES scourt_case_snapshots(id),

  -- 변경 감지 시점
  detected_at TIMESTAMPTZ DEFAULT NOW(),

  -- 변경 유형
  update_type VARCHAR(50) NOT NULL,
  -- 가능한 값:
  -- hearing_new: 새 기일 추가
  -- hearing_changed: 기일 변경/취소
  -- hearing_result: 기일 결과 (속행, 판결 등)
  -- document_filed: 서류 제출
  -- document_served: 서류 송달
  -- served: 송달 완료 (도달)
  -- result_announced: 판결/결정 선고
  -- status_changed: 상태 변경
  -- party_changed: 당사자 변경
  -- other: 기타

  -- 변경 요약 (한글)
  update_summary TEXT NOT NULL,
  -- 예: "2026.01.28 11:40 변론기일 추가", "준비서면 제출 (피고)"

  -- 상세 정보
  details JSONB NOT NULL DEFAULT '{}',
  -- 예: { "date": "2026.01.28", "time": "11:40", "type": "변론기일", "location": "본관 402호" }

  -- 이전/이후 값 (비교용)
  old_value JSONB,
  new_value JSONB,

  -- 중요도 (정렬, 알림용)
  importance VARCHAR(20) DEFAULT 'normal',
  -- high: 기일, 판결
  -- normal: 서류 제출, 송달
  -- low: 기타

  -- 읽음 상태
  is_read_by_admin BOOLEAN DEFAULT FALSE,
  is_read_by_client BOOLEAN DEFAULT FALSE,
  read_at_admin TIMESTAMPTZ,
  read_at_client TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scourt_updates_legal_case ON scourt_case_updates(legal_case_id);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_detected_at ON scourt_case_updates(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_type ON scourt_case_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_importance ON scourt_case_updates(importance);
CREATE INDEX IF NOT EXISTS idx_scourt_updates_unread_client ON scourt_case_updates(legal_case_id)
  WHERE is_read_by_client = FALSE;

-- ============================================================
-- 3. legal_cases 테이블 확장 (동기화 상태)
-- ============================================================
DO $$
BEGIN
  -- scourt_last_snapshot_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legal_cases' AND column_name = 'scourt_last_snapshot_id'
  ) THEN
    ALTER TABLE legal_cases ADD COLUMN scourt_last_snapshot_id UUID REFERENCES scourt_case_snapshots(id);
  END IF;

  -- scourt_update_count 컬럼 추가 (미읽음 업데이트 수)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legal_cases' AND column_name = 'scourt_unread_updates'
  ) THEN
    ALTER TABLE legal_cases ADD COLUMN scourt_unread_updates INTEGER DEFAULT 0;
  END IF;

  -- scourt_next_hearing 컬럼 추가 (다음 기일)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'legal_cases' AND column_name = 'scourt_next_hearing'
  ) THEN
    ALTER TABLE legal_cases ADD COLUMN scourt_next_hearing JSONB;
  END IF;
END $$;

-- ============================================================
-- 4. 업데이트 유형 정의 테이블 (참조용)
-- ============================================================
CREATE TABLE IF NOT EXISTS scourt_update_types (
  code VARCHAR(50) PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description TEXT,
  importance VARCHAR(20) DEFAULT 'normal',
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 유형 삽입
INSERT INTO scourt_update_types (code, name_ko, importance, icon) VALUES
  ('hearing_new', '기일 지정', 'high', 'calendar-plus'),
  ('hearing_changed', '기일 변경', 'high', 'calendar-edit'),
  ('hearing_canceled', '기일 취소', 'high', 'calendar-x'),
  ('hearing_result', '기일 결과', 'high', 'gavel'),
  ('document_filed', '서류 제출', 'normal', 'file-plus'),
  ('document_served', '서류 송달', 'normal', 'send'),
  ('served', '송달 도달', 'normal', 'check-circle'),
  ('result_announced', '판결/결정', 'high', 'scale'),
  ('appeal_filed', '상소 제기', 'high', 'arrow-up'),
  ('status_changed', '상태 변경', 'normal', 'refresh'),
  ('party_changed', '당사자 변경', 'low', 'users'),
  ('other', '기타', 'low', 'info')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. 뷰: 사건별 최신 업데이트 요약
-- ============================================================
CREATE OR REPLACE VIEW scourt_case_update_summary AS
SELECT
  lc.id as legal_case_id,
  lc.court_case_number as case_number,
  lc.case_name,
  lc.scourt_unread_updates,
  lc.scourt_next_hearing,
  (
    SELECT json_agg(u ORDER BY u.detected_at DESC)
    FROM (
      SELECT id, update_type, update_summary, detected_at, importance, is_read_by_client
      FROM scourt_case_updates
      WHERE legal_case_id = lc.id
      ORDER BY detected_at DESC
      LIMIT 5
    ) u
  ) as recent_updates,
  (
    SELECT MAX(detected_at)
    FROM scourt_case_updates
    WHERE legal_case_id = lc.id
  ) as last_update_at
FROM legal_cases lc
WHERE lc.scourt_last_sync IS NOT NULL;

-- ============================================================
-- 6. 함수: 미읽음 업데이트 수 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION update_scourt_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 해당 사건의 미읽음 업데이트 수 갱신
  UPDATE legal_cases
  SET scourt_unread_updates = (
    SELECT COUNT(*)
    FROM scourt_case_updates
    WHERE legal_case_id = COALESCE(NEW.legal_case_id, OLD.legal_case_id)
      AND is_read_by_client = FALSE
  )
  WHERE id = COALESCE(NEW.legal_case_id, OLD.legal_case_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS trigger_scourt_unread_count ON scourt_case_updates;
CREATE TRIGGER trigger_scourt_unread_count
  AFTER INSERT OR UPDATE OF is_read_by_client OR DELETE
  ON scourt_case_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_scourt_unread_count();
