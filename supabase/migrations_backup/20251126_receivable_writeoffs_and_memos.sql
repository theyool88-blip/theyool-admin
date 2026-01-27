-- 미수금 포기 이력 테이블
CREATE TABLE IF NOT EXISTS receivable_writeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_name TEXT NOT NULL,
  client_name TEXT,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  written_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  written_off_by TEXT, -- 담당자
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 미수금 메모/체크리스트 테이블
CREATE TABLE IF NOT EXISTS receivable_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_case_id ON receivable_writeoffs(case_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_written_off_at ON receivable_writeoffs(written_off_at DESC);
CREATE INDEX IF NOT EXISTS idx_receivable_memos_case_id ON receivable_memos(case_id);

-- RLS 비활성화 (관리자 전용)
ALTER TABLE receivable_writeoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_memos ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 정책 (서비스 롤 키 사용)
CREATE POLICY "Allow all for service role" ON receivable_writeoffs FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON receivable_memos FOR ALL USING (true);
