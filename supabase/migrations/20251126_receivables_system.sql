-- ============================================================
-- 미수금 관리 시스템 마이그레이션
-- ============================================================

-- 1. 미수금 등급 ENUM 타입 생성
DO $$ BEGIN
  CREATE TYPE receivable_grade AS ENUM ('normal', 'watch', 'collection');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. legal_cases 테이블에 receivable_grade 컬럼 추가
ALTER TABLE legal_cases
ADD COLUMN IF NOT EXISTS receivable_grade receivable_grade DEFAULT 'normal';

-- 3. 미수금 포기 이력 테이블
CREATE TABLE IF NOT EXISTS receivable_writeoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_name TEXT NOT NULL,
  client_name TEXT,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  written_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  written_off_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 미수금 메모/체크리스트 테이블
CREATE TABLE IF NOT EXISTS receivable_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_cases_receivable_grade ON legal_cases(receivable_grade);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_case_id ON receivable_writeoffs(case_id);
CREATE INDEX IF NOT EXISTS idx_receivable_writeoffs_written_off_at ON receivable_writeoffs(written_off_at DESC);
CREATE INDEX IF NOT EXISTS idx_receivable_memos_case_id ON receivable_memos(case_id);

-- 6. RLS 정책 (서비스 롤 키로 우회하므로 기본 허용)
ALTER TABLE receivable_writeoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivable_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for receivable_writeoffs" ON receivable_writeoffs;
DROP POLICY IF EXISTS "Allow all for receivable_memos" ON receivable_memos;

CREATE POLICY "Allow all for receivable_writeoffs" ON receivable_writeoffs FOR ALL USING (true);
CREATE POLICY "Allow all for receivable_memos" ON receivable_memos FOR ALL USING (true);

-- 7. 기존 미수금 있는 사건들 기본값 설정 (이미 normal이므로 변경 불필요)
-- UPDATE legal_cases SET receivable_grade = 'normal' WHERE receivable_grade IS NULL;
