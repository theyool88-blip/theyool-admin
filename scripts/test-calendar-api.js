require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function testCalendar() {
  console.log('=== 통합 캘린더 VIEW 테스트 ===\n')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  console.log('오늘 날짜:', todayStr)
  console.log()

  // 오늘 날짜의 모든 일정 조회
  const { data, error } = await supabase
    .from('unified_calendar')
    .select('*')
    .eq('event_date', todayStr)

  if (error) {
    console.error('에러:', error)
    return
  }

  console.log('오늘(' + todayStr + ') 일정 개수:', data?.length || 0)
  console.log()

  if (data && data.length > 0) {
    data.forEach((event, index) => {
      console.log('[' + (index + 1) + '] ' + event.event_type)
      console.log('  제목:', event.title)
      console.log('  날짜:', event.event_date)
      console.log('  시간:', event.event_time)
      console.log('  참조ID:', event.reference_id)
      console.log('  위치:', event.location)
      console.log('  상태:', event.status)
      console.log()
    })
  } else {
    console.log('오늘 일정이 없습니다.')
  }

  // 전체 일정 개수도 확인
  const { count } = await supabase
    .from('unified_calendar')
    .select('*', { count: 'exact', head: true })

  console.log('전체 일정 개수:', count)
}

testCalendar()
