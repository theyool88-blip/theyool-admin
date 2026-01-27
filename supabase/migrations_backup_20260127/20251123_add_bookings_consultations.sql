-- 더율 프로젝트의 상담 및 예약 테이블 추가

-- 1. Consultations 테이블 (간단한 상담 신청)
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_category ON consultations(category);

-- 2. Bookings 테이블 (날짜/시간 예약)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('visit', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category TEXT,
  message TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  office_location TEXT CHECK (office_location IN ('천안', '평택')),
  video_link TEXT,
  admin_notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings(preferred_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status_date ON bookings(status, preferred_date);

-- 3. Updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consultations_updated_at ON consultations;
CREATE TRIGGER consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. RLS 정책
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 권한
DROP POLICY IF EXISTS "Service role has full access to consultations" ON consultations;
CREATE POLICY "Service role has full access to consultations"
  ON consultations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to bookings" ON bookings;
CREATE POLICY "Service role has full access to bookings"
  ON bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated 사용자는 읽기만
DROP POLICY IF EXISTS "Authenticated users can view consultations" ON consultations;
CREATE POLICY "Authenticated users can view consultations"
  ON consultations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view bookings" ON bookings;
CREATE POLICY "Authenticated users can view bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (true);

-- Public은 INSERT만 (웹사이트에서 상담 신청)
DROP POLICY IF EXISTS "Anyone can create consultations" ON consultations;
CREATE POLICY "Anyone can create consultations"
  ON consultations
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create bookings" ON bookings;
CREATE POLICY "Anyone can create bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (true);
