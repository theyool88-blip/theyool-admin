require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: 'public' }
})

async function createView() {
  console.log('통합 캘린더 VIEW 생성 시도 중...\n')

  // Supabase의 REST API를 통해 직접 실행할 수 없으므로,
  // PostgreSQL 연결을 통해 실행해야 합니다.
  
  const sql = `
CREATE OR REPLACE VIEW unified_calendar AS
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

  console.log('Supabase Dashboard에서 다음 단계를 따라주세요:\n')
  console.log('1. https://supabase.com/dashboard 접속')
  console.log('2. luseed 프로젝트 선택')
  console.log('3. 왼쪽 메뉴에서 "SQL Editor" 클릭')
  console.log('4. "New query" 클릭')
  console.log('5. 아래 SQL을 복사해서 붙여넣기\n')
  console.log('='.repeat(80))
  console.log(sql)
  console.log('='.repeat(80))
  console.log('\n6. "RUN" 버튼 클릭')
  console.log('7. "Success. No rows returned" 메시지 확인\n')
  console.log('완료 후 개발 서버를 재시작하거나 페이지를 새로고침하세요.\n')
}

createView()
