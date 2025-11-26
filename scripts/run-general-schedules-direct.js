require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('🚀 Starting general_schedules migration...\n')

  try {
    // 1. general_schedules 테이블 생성 (직접 테이블 생성 시도)
    console.log('1️⃣ Creating general_schedules table...')

    // 테이블이 이미 존재하는지 확인
    const { data: existingTable } = await supabase
      .from('general_schedules')
      .select('id')
      .limit(1)

    if (existingTable) {
      console.log('⚠️  general_schedules table already exists, skipping...\n')
    } else {
      console.log('✅ Need to create table via Supabase Dashboard or SQL Editor\n')
      console.log('📋 Please run the following SQL in Supabase Dashboard:\n')
      console.log('---')
      console.log(`
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

CREATE INDEX IF NOT EXISTS idx_general_schedules_date ON general_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_general_schedules_type ON general_schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_general_schedules_status ON general_schedules(status);
CREATE INDEX IF NOT EXISTS idx_general_schedules_created_by ON general_schedules(created_by);

DROP TRIGGER IF EXISTS general_schedules_updated_at ON general_schedules;
CREATE TRIGGER general_schedules_updated_at
  BEFORE UPDATE ON general_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE general_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to general_schedules" ON general_schedules;
CREATE POLICY "Service role has full access to general_schedules"
  ON general_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage general_schedules" ON general_schedules;
CREATE POLICY "Authenticated users can manage general_schedules"
  ON general_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
      `)
      console.log('---\n')
    }

    // 2. unified_calendar VIEW 업데이트 SQL 출력
    console.log('2️⃣ Update unified_calendar VIEW SQL:\n')
    console.log('---')
    console.log(`
DROP VIEW IF EXISTS unified_calendar;

CREATE OR REPLACE VIEW unified_calendar AS
SELECT
  ch.id,
  'COURT_HEARING' AS event_type,
  '법원기일' AS event_type_kr,
  ch.hearing_type AS event_subtype,
  CONCAT('(',
    CASE ch.hearing_type
      WHEN 'FIRST_HEARING' THEN '변론기일'
      WHEN 'SENTENCING' THEN '선고기일'
      WHEN 'MEDIATION' THEN '조정기일'
      WHEN 'PREPARATION' THEN '준비기일'
      WHEN 'EVIDENCE' THEN '증거조사'
      WHEN 'WITNESS' THEN '증인신문'
      WHEN 'OTHER' THEN '기타'
      ELSE ch.hearing_type
    END,
    ') ', lc.case_name
  ) AS title,
  lc.case_name,
  DATE(ch.hearing_date AT TIME ZONE 'Asia/Seoul') AS event_date,
  TO_CHAR(ch.hearing_date AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS event_time,
  ch.hearing_date AS event_datetime,
  ch.case_number AS reference_id,
  ch.location,
  ch.notes AS description,
  ch.status,
  1 AS sort_priority
FROM court_hearings ch
LEFT JOIN legal_cases lc ON ch.case_id = lc.id

UNION ALL

SELECT
  cd.id,
  'DEADLINE' AS event_type,
  '데드라인' AS event_type_kr,
  cd.deadline_type AS event_subtype,
  CONCAT('(',
    CASE cd.deadline_type
      WHEN 'ANSWER_SUBMISSION' THEN '답변서 제출'
      WHEN 'PREP_SUBMISSION' THEN '준비서면 제출'
      WHEN 'EVIDENCE_SUBMISSION' THEN '증거 제출'
      WHEN 'APPEAL_DEADLINE' THEN '항소 기한'
      WHEN 'PAYMENT_DEADLINE' THEN '납부 기한'
      WHEN 'OTHER' THEN '기타'
      ELSE cd.deadline_type
    END,
    ') ', lc.case_name
  ) AS title,
  lc.case_name,
  cd.deadline_date AS event_date,
  '00:00' AS event_time,
  (cd.deadline_date || ' 00:00:00')::timestamp AS event_datetime,
  cd.case_number AS reference_id,
  NULL AS location,
  cd.notes AS description,
  cd.status,
  2 AS sort_priority
FROM case_deadlines cd
LEFT JOIN legal_cases lc ON cd.case_id = lc.id

UNION ALL

SELECT
  c.id,
  'CONSULTATION' AS event_type,
  '상담' AS event_type_kr,
  c.request_type AS event_subtype,
  CONCAT('(상담) ', c.name) AS title,
  c.name AS case_name,
  c.preferred_date AS event_date,
  COALESCE(c.preferred_time, '00:00') AS event_time,
  (c.preferred_date || ' ' || COALESCE(c.preferred_time, '00:00') || ':00')::timestamp AS event_datetime,
  c.phone AS reference_id,
  c.office_location AS location,
  c.message AS description,
  c.status,
  3 AS sort_priority
FROM consultations c
WHERE c.preferred_date IS NOT NULL

UNION ALL

SELECT
  gs.id,
  'GENERAL_SCHEDULE' AS event_type,
  '일반일정' AS event_type_kr,
  gs.schedule_type AS event_subtype,
  CONCAT('(',
    CASE gs.schedule_type
      WHEN 'meeting' THEN '회의'
      WHEN 'appointment' THEN '약속'
      WHEN 'task' THEN '업무'
      WHEN 'other' THEN '기타'
      ELSE gs.schedule_type
    END,
    ') ', gs.title
  ) AS title,
  gs.title AS case_name,
  gs.schedule_date AS event_date,
  COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00') AS event_time,
  (gs.schedule_date || ' ' || COALESCE(TO_CHAR(gs.schedule_time, 'HH24:MI'), '00:00') || ':00')::timestamp AS event_datetime,
  NULL AS reference_id,
  gs.location,
  gs.description,
  gs.status,
  4 AS sort_priority
FROM general_schedules gs;
    `)
    console.log('---\n')

    console.log('✅ Migration SQL generated!')
    console.log('\n📋 Next Steps:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Copy and run the SQL above')
    console.log('   3. Verify the tables and VIEW are created')
    console.log('\n💡 Or use the migration files directly:')
    console.log('   - supabase/migrations/20251124_add_general_schedules.sql')
    console.log('   - supabase/migrations/20251124_update_unified_calendar_with_general.sql')

  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

runMigration()
