-- 사건번호 없는 일반 일정 테이블 생성
CREATE TABLE IF NOT EXISTS general_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('meeting', 'appointment', 'task', 'other')),
  schedule_date DATE NOT NULL,
  schedule_time TIME,
  location TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_by UUID REFERENCES users_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_general_schedules_date ON general_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_general_schedules_type ON general_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_general_schedules_status ON general_schedules(status);
CREATE INDEX IF NOT EXISTS idx_general_schedules_created_by ON general_schedules(created_by);

-- Updated_at 트리거
DROP TRIGGER IF EXISTS general_schedules_updated_at ON general_schedules;
CREATE TRIGGER general_schedules_updated_at
  BEFORE UPDATE ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책
ALTER TABLE general_schedules ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 권한
DROP POLICY IF EXISTS "Service role has full access to general_schedules" ON general_schedules;
CREATE POLICY "Service role has full access to general_schedules"
  ON general_schedules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated 사용자는 모든 권한
DROP POLICY IF EXISTS "Authenticated users can manage general_schedules" ON general_schedules;
CREATE POLICY "Authenticated users can manage general_schedules"
  ON general_schedules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
