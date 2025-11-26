require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

// Supabase 연결 정보 파싱
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.')
  process.exit(1)
}

// URL에서 프로젝트 ID 추출
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectId) {
  console.error('Supabase URL에서 프로젝트 ID를 추출할 수 없습니다.')
  process.exit(1)
}

console.log(`프로젝트 ID: ${projectId}`)

// PostgreSQL 연결 설정 (직접 연결)
const pool = new Pool({
  host: `db.${projectId}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Soofm9856!',
  ssl: { rejectUnauthorized: false }
})

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

async function runMigration() {
  let client
  try {
    console.log('PostgreSQL 연결 중...')
    client = await pool.connect()
    console.log('✓ 연결 성공\n')

    console.log('unified_calendar VIEW 생성 중...')
    await client.query(sql)
    console.log('✓ VIEW 생성 완료\n')

    // VIEW 테스트
    console.log('VIEW 테스트 중...')
    const result = await client.query('SELECT COUNT(*) FROM unified_calendar')
    console.log(`✓ VIEW 정상 작동 확인 (총 ${result.rows[0].count}개 일정)\n`)

    console.log('✅ 마이그레이션 성공!')
    console.log('페이지를 새로고침하면 통합 캘린더가 정상 작동합니다.\n')

  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    if (error.code) console.error('오류 코드:', error.code)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

runMigration()
