require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function testWeeklyCalendar() {
  console.log('=== Weekly Calendar 데이터 검증 ===\n')

  // 이번 주 범위 계산 (월요일 시작)
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1) // 월요일
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // 일요일

  const startDate = weekStart.toISOString().split('T')[0]
  const endDate = weekEnd.toISOString().split('T')[0]

  console.log('오늘:', today.toISOString().split('T')[0])
  console.log('이번 주 시작 (월):', startDate)
  console.log('이번 주 끝 (일):', endDate)
  console.log()

  // unified_calendar에서 이번 주 데이터 조회
  const { data, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true })

  if (error) {
    console.error('에러:', error)
    return
  }

  console.log('이번 주 일정 개수:', data?.length || 0)
  console.log()

  if (data && data.length > 0) {
    data.forEach((event, index) => {
      console.log('[' + (index + 1) + '] ' + event.event_type)
      console.log('  원본 제목:', event.title)
      console.log('  날짜:', event.event_date)
      console.log('  시간:', event.event_time)
      console.log('  참조ID:', event.reference_id)
      console.log('  위치:', event.location)
      console.log()
    })
  } else {
    console.log('이번 주에 일정이 없습니다.')
  }

  // 오늘만 따로 확인
  const todayStr = today.toISOString().split('T')[0]
  const { data: todayData } = await supabase
    .from('unified_calendar')
    .select('*')
    .eq('event_date', todayStr)

  console.log('오늘(' + todayStr + ') 일정:', todayData?.length || 0, '건')
}

testWeeklyCalendar()
