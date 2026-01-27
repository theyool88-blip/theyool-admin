-- 매칭 실패한 캘린더 이벤트 보관 테이블
CREATE TABLE IF NOT EXISTS pending_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT UNIQUE NOT NULL,

  -- 원본 데이터
  summary TEXT,                    -- 이벤트 제목 (예: "[변론] 2025드합2016 [전자]이혼 등")
  description TEXT,                -- 이벤트 설명
  location TEXT,                   -- 장소 (법원 + 법정)
  start_datetime TIMESTAMPTZ,      -- 시작 일시

  -- 파싱된 데이터
  parsed_case_number TEXT,         -- 파싱된 사건번호 (예: "2025드합2016")
  parsed_hearing_type TEXT,        -- 파싱된 기일 유형 (예: "HEARING_MAIN")
  parsed_hearing_detail TEXT,      -- 파싱된 기일 상세 (예: "변론")
  parsed_court_name TEXT,          -- 파싱된 법원명
  parsed_courtroom TEXT,           -- 파싱된 법정호수

  -- 상태
  status TEXT DEFAULT 'pending',   -- pending, matched, ignored
  match_attempted_at TIMESTAMPTZ,  -- 마지막 매칭 시도 시간
  match_attempts INTEGER DEFAULT 1,-- 매칭 시도 횟수
  matched_case_id UUID REFERENCES legal_cases(id), -- 매칭된 사건 (나중에 매칭되면)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE pending_calendar_events ENABLE ROW LEVEL SECURITY;

-- 관리자 접근 정책
CREATE POLICY "Authenticated users can manage pending_calendar_events"
  ON pending_calendar_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_pending_calendar_events_status ON pending_calendar_events(status);
CREATE INDEX idx_pending_calendar_events_parsed_case_number ON pending_calendar_events(parsed_case_number);
CREATE INDEX idx_pending_calendar_events_google_event_id ON pending_calendar_events(google_event_id);
