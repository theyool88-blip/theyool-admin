require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function updateSampleCaseNumbers() {
  console.log('샘플 데이터에 case_number 추가 중...\n')

  // court_hearings에서 사용 중인 case_number 조회
  const { data: hearings } = await supabase
    .from('court_hearings')
    .select('case_number')
    .limit(5)

  console.log('현재 court_hearings의 case_number:', hearings?.map(h => h.case_number))

  // cases 테이블 업데이트 (첫 번째 사건에 TEST-2024-001 할당)
  const { data: cases } = await supabase
    .from('cases')
    .select('id, title')
    .limit(1)

  if (cases && cases.length > 0) {
    const { error } = await supabase
      .from('cases')
      .update({ case_number: 'TEST-2024-001' })
      .eq('id', cases[0].id)

    if (error) {
      console.error('업데이트 실패:', error)
    } else {
      console.log('\n✅ 업데이트 성공!')
      console.log('사건명:', cases[0].title)
      console.log('사건번호: TEST-2024-001')
    }
  }

  // 검증
  const { data: updated } = await supabase
    .from('unified_calendar')
    .select('title, case_name, event_type_kr')
    .eq('reference_id', 'TEST-2024-001')
    .limit(1)

  console.log('\n검증 결과:')
  console.log(updated)
}

updateSampleCaseNumbers()
