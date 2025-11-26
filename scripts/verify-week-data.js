require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyWeekData() {
  console.log('=== 이번 주 데이터 검증 (수정된 로직) ===\n')

  const today = new Date()
  const dayOfWeek = today.getDay()
  const weekStart = new Date(today)

  if (dayOfWeek === 0) {
    weekStart.setDate(today.getDate() - 6)
  } else {
    weekStart.setDate(today.getDate() - (dayOfWeek - 1))
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const startDate = weekStart.toISOString().split('T')[0]
  const endDate = weekEnd.toISOString().split('T')[0]

  console.log('오늘:', today.toISOString().split('T')[0])
  console.log('이번 주:', startDate, '~', endDate)
  console.log()

  const { data, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate)

  if (error) {
    console.error('에러:', error)
    return
  }

  console.log('조회된 일정:', data?.length || 0, '건\n')
  
  if (data && data.length > 0) {
    data.forEach(event => {
      console.log('-', event.event_type, ':', event.title)
      console.log('  날짜:', event.event_date, event.event_time)
    })
  }
}

verifyWeekData()
