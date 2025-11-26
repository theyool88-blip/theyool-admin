require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verifyTitleFormat() {
  console.log('제목 형식 검증\n')

  const { data } = await supabase
    .from('unified_calendar')
    .select('event_type, event_type_kr, title, case_name')
    .order('event_date')
    .limit(5)

  console.log('샘플 일정:\n')
  data?.forEach((event, idx) => {
    console.log((idx + 1) + '. [' + event.event_type_kr + ']')
    console.log('   제목: ' + event.title)
    console.log('   사건명: ' + (event.case_name || '(없음)'))
    console.log()
  })
}

verifyTitleFormat()
