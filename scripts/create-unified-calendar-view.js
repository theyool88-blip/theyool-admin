require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', supabaseUrl ? '✓' : '✗')
console.log('Service Key:', supabaseServiceKey ? '✓' : '✗')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function createUnifiedCalendarView() {
  console.log('\n통합 캘린더 VIEW 생성 중...\n')

  const sql = `
CREATE OR REPLACE VIEW unified_calendar AS
-- 법원 기일 (court_hearings)
SELECT
  id,
  'COURT_HEARING' AS event_type,
  hearing_type::TEXT AS title,
  hearing_date::DATE AS event_date,
  TO_CHAR(hearing_date, 'HH24:MI:SS') AS event_time,
  hearing_date AS event_datetime,
  case_number AS reference_id,
  location,
  notes AS description,
  NULL AS status
FROM court_hearings

UNION ALL

-- 데드라인 (case_deadlines)
SELECT
  id,
  'DEADLINE' AS event_type,
  deadline_type::TEXT AS title,
  deadline_date AS event_date,
  '00:00' AS event_time,
  deadline_date::TIMESTAMP AS event_datetime,
  case_number AS reference_id,
  NULL AS location,
  notes AS description,
  status
FROM case_deadlines

UNION ALL

-- 상담 예약 (bookings)
SELECT
  id,
  'CONSULTATION' AS event_type,
  name || ' 상담' AS title,
  booking_date AS event_date,
  booking_time AS event_time,
  (booking_date::TEXT || ' ' || booking_time)::TIMESTAMP AS event_datetime,
  phone AS reference_id,
  office_location AS location,
  message AS description,
  status
FROM bookings;
`

  console.log('다음 SQL을 Supabase Dashboard의 SQL Editor에서 실행해주세요:')
  console.log('='.repeat(80))
  console.log(sql)
  console.log('='.repeat(80))
  console.log('\n실행 후, 페이지를 새로고침하면 통합 캘린더가 정상 작동합니다.\n')
}

createUnifiedCalendarView()
